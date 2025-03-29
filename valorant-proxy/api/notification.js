const { createClient } = require('redis');

// Initialize Redis client with connection retry options
const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      // Exponential backoff with max delay of 10 seconds
      return Math.min(retries * 100, 10000);
    }
  }
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    // Don't crash the app, we'll retry on demand
  }
})();

// Handle connection errors
redisClient.on('error', (err) => {
  console.error('Redis client error:', err);
});

// Add a reconnection helper
async function ensureRedisConnection() {
  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
      console.log('Reconnected to Redis');
      return true;
    } catch (error) {
      console.error('Failed to reconnect to Redis:', error);
      return false;
    }
  }
  return true;
}

// Helper function to set CORS headers
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
};

// Helper function to send JSON response
const sendJsonResponse = (res, statusCode, data) => {
  res.status(statusCode).json(data);
};

module.exports = async (req, res) => {
  try {
    // Set CORS headers for all requests
    setCorsHeaders(res);
    
    // Handle OPTIONS request (preflight)
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Ensure Redis is connected with our improved helper
    if (!await ensureRedisConnection()) {
      return sendJsonResponse(res, 500, { 
        error: 'Failed to connect to database',
        notifiedMatches: {} 
      });
    }

    // Get notification for a user
    if (req.method === 'GET') {
      const { userId } = req.query;
      
      if (!userId) {
        return sendJsonResponse(res, 400, { 
          error: 'Missing userId parameter',
          notifiedMatches: {} 
        });
      }
      
      const notificationsKey = `notifications:${userId}`;
      const notificationsData = await redisClient.get(notificationsKey);
      
      let notifiedMatches = {};
      if (notificationsData) {
        try {
          notifiedMatches = JSON.parse(notificationsData);
        } catch (error) {
          console.error('Error parsing notifications data:', error);
        }
      }
      
      return sendJsonResponse(res, 200, { notifiedMatches });
    }
    
    // Save notifications for a user
    if (req.method === 'POST') {
      const { userId, notifiedMatches } = req.body;
      
      if (!userId || !notifiedMatches) {
        return sendJsonResponse(res, 400, { 
          error: 'Missing userId or notifiedMatches in request body' 
        });
      }
      
      const notificationsKey = `notifications:${userId}`;
      await redisClient.set(notificationsKey, JSON.stringify(notifiedMatches));
      
      return sendJsonResponse(res, 200, { 
        success: true,
        message: 'Notifications saved successfully' 
      });
    }
    
    // Delete a notification for a user
    if (req.method === 'DELETE') {
      const { userId, matchId } = req.body;
      
      if (!userId || !matchId) {
        return sendJsonResponse(res, 400, { 
          error: 'Missing userId or matchId in request body' 
        });
      }
      
      const notificationsKey = `notifications:${userId}`;
      const notificationsData = await redisClient.get(notificationsKey);
      
      let notifiedMatches = {};
      if (notificationsData) {
        try {
          notifiedMatches = JSON.parse(notificationsData);
          delete notifiedMatches[matchId];
          await redisClient.set(notificationsKey, JSON.stringify(notifiedMatches));
        } catch (error) {
          console.error('Error updating notifications data:', error);
          return sendJsonResponse(res, 500, { 
            error: 'Failed to update notifications' 
          });
        }
      }
      
      return sendJsonResponse(res, 200, { 
        success: true,
        message: 'Notification deleted successfully' 
      });
    }
    
    // If we reach here, method not supported
    return sendJsonResponse(res, 405, { error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Error in notification endpoint:', error);
    return sendJsonResponse(res, 500, { 
      error: 'Internal server error',
      message: error.message
    });
  }
};
