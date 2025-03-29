const fetch = require('node-fetch');
const { createClient } = require('redis');

let redisClient = null;

// Initialize Redis client
const getRedisClient = async () => {
  if (redisClient !== null) {
    return redisClient;
  }

  try {
    console.log('Connecting to Redis...');
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: false
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      redisClient = null;
    });

    redisClient.on('connect', () => {
      console.log('Successfully connected to Redis');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Redis connection error:', error);
    redisClient = null;
    return null;
  }
};

// Function to get all tournament icons
const getTournamentIcons = async () => {
  try {
    console.log('Getting tournament icons from Redis...');
    const redis = await getRedisClient();
    if (!redis) {
      console.error('Failed to connect to Redis');
      return [];
    }

    const storedIcons = await redis.get('tournament_icons');
    console.log('Raw stored icons:', storedIcons);
    
    if (!storedIcons) {
      console.log('No icons found in Redis');
      return [];
    }

    const icons = JSON.parse(storedIcons);
    console.log('Retrieved icons count:', icons.length);
    return icons;
  } catch (error) {
    console.error('Error getting tournament icons:', error);
    return [];
  }
};

// Function to update tournament icons
const updateTournamentIcons = async (matches) => {
  try {
    console.log('Updating tournament icons...');
    const redis = await getRedisClient();
    if (!redis) {
      console.error('Failed to connect to Redis');
      return [];
    }

    // Get existing icons from Redis
    let existingIcons = [];
    try {
      console.log('Fetching existing icons from Redis...');
      const storedIcons = await redis.get('tournament_icons');
      existingIcons = storedIcons ? JSON.parse(storedIcons) : [];
      console.log('Current stored icons count:', existingIcons.length);
    } catch (error) {
      console.error('Error parsing stored icons:', error);
    }

    let hasNewIcons = false;
    let newIconsCount = 0;

    // Process new matches
    for (const match of matches) {
      const tournamentName = match.tournament_name || match.match_event;
      if (tournamentName && match.tournament_icon) {
        // Check if this icon already exists
        const exists = existingIcons.some(icon => icon.name === tournamentName);
        if (!exists) {
          console.log('Found new tournament icon:', tournamentName);
          existingIcons.push({
            name: tournamentName,
            url: match.tournament_icon
          });
          hasNewIcons = true;
          newIconsCount++;
        }
      }
    }

    // Save if we found new icons
    if (hasNewIcons) {
      console.log(`Saving ${newIconsCount} new tournament icons to Redis...`);
      await redis.set('tournament_icons', JSON.stringify(existingIcons));
      console.log('Tournament icons saved successfully. Total icons:', existingIcons.length);
    } else {
      console.log('No new icons found to save');
    }

    return existingIcons;
  } catch (error) {
    console.error('Error updating tournament icons:', error);
    return [];
  }
};

// Function to fetch results and update icons
const fetchAndUpdateIcons = async () => {
  try {
    console.log('Fetching results to update icons...');
    const resultsUrl = 'https://vlrggapi.vercel.app/match?q=results';
    const apiResponse = await fetch(resultsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('API error response:', errorText);
      throw new Error(`API error: ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    console.log('Results data received, segments count:', data.data?.segments?.length || 0);
    
    if (data.data && data.data.segments) {
      await updateTournamentIcons(data.data.segments);
    }
  } catch (error) {
    console.error('Error fetching results for icons:', error);
  }
};

// Function to set CORS headers
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.setHeader('Content-Type', 'application/json');
};

// Function to send JSON response
const sendJsonResponse = (res, status, data) => {
  try {
    res.status(status).json(data);
  } catch (error) {
    console.error('Error sending JSON response:', error);
    // Fallback response if JSON serialization fails
    res.status(status).send(JSON.stringify(data));
  }
};

module.exports = async (req, res) => {
  try {
    // Set CORS headers for all requests
    setCorsHeaders(res);
    
    // Handle OPTIONS request (preflight)
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { q = 'upcoming' } = req.query;
    console.log('Received request with query:', q);

    // Special endpoint for getting tournament icons
    if (q === 'tournament_icons') {
      console.log('Tournament icons endpoint called');
      try {
        // First fetch and update icons from results
        await fetchAndUpdateIcons();
        // Then return the current icons
        const icons = await getTournamentIcons();
        console.log('Returning icons:', icons);
        return sendJsonResponse(res, 200, { icons });
      } catch (error) {
        console.error('Error in tournament_icons endpoint:', error);
        return sendJsonResponse(res, 500, { 
          error: 'Failed to fetch tournament icons',
          icons: []
        });
      }
    }

    const targetUrl = `https://vlrggapi.vercel.app/match?q=${encodeURIComponent(q)}`;
    console.log('Proxying request to:', targetUrl);
    
    const apiResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('API error response:', errorText);
      return sendJsonResponse(res, apiResponse.status, {
        error: 'Error from vlrggapi',
        status: apiResponse.status,
        message: errorText
      });
    }

    const data = await apiResponse.json();
    console.log('Received data from API');

    // If this is a results query, update tournament icons
    if (q === 'results' && data.data && data.data.segments) {
      console.log('Results query detected, updating tournament icons...');
      await updateTournamentIcons(data.data.segments);
    }

    return sendJsonResponse(res, 200, data);

  } catch (error) {
    console.error('Proxy server error:', error);
    return sendJsonResponse(res, 500, {
      error: 'Internal server error',
      message: error.message
    });
  }
};