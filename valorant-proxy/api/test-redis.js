const { createClient } = require('redis');

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    console.log('Testing Redis connection...');
    const redis = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: false
      }
    });

    redis.on('error', (err) => console.error('Redis Client Error:', err));
    redis.on('connect', () => console.log('Successfully connected to Redis'));

    await redis.connect();

    // Test data
    const testIcons = [
      {
        name: "VCT Americas League",
        url: "https://www.vlr.gg/img/vlr/tmp/vlr.png"
      },
      {
        name: "VCT EMEA League",
        url: "https://www.vlr.gg/img/vlr/tmp/vlr.png"
      }
    ];

    console.log('Setting test data in Redis...');
    await redis.set('tournament_icons', JSON.stringify(testIcons));
    
    console.log('Reading back test data...');
    const stored = await redis.get('tournament_icons');
    
    res.status(200).json({
      success: true,
      written: testIcons,
      read: JSON.parse(stored)
    });

  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({
      error: 'Test failed',
      message: error.message
    });
  }
}; 