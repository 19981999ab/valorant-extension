const fetch = require('node-fetch');
const { createClient } = require('redis');

// Initialize Redis client
const getRedisClient = async () => {
  try {
    const client = createClient({
      url: process.env.REDIS_URL
    });
    await client.connect();
    return client;
  } catch (error) {
    console.error('Redis connection error:', error);
    return null;
  }
};

// Function to extract and save tournament icons
const updateTournamentIcons = async (matches) => {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.error('Failed to connect to Redis');
      return [];
    }

    // Get existing icons from Redis
    let existingIcons = [];
    try {
      const storedIcons = await redis.get('tournament_icons');
      existingIcons = storedIcons ? JSON.parse(storedIcons) : [];
    } catch (error) {
      console.error('Error parsing stored icons:', error);
    }

    let hasNewIcons = false;

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
        }
      }
    }

    // Save if we found new icons
    if (hasNewIcons) {
      console.log('Saving new tournament icons to Redis...');
      await redis.set('tournament_icons', JSON.stringify(existingIcons));
      console.log('Tournament icons saved successfully');
    }

    await redis.quit();
    return existingIcons;
  } catch (error) {
    console.error('Error updating tournament icons:', error);
    return [];
  }
};

// Function to get all tournament icons
const getTournamentIcons = async () => {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.error('Failed to connect to Redis');
      return [];
    }

    const storedIcons = await redis.get('tournament_icons');
    await redis.quit();
    
    return storedIcons ? JSON.parse(storedIcons) : [];
  } catch (error) {
    console.error('Error getting tournament icons:', error);
    return [];
  }
};

module.exports = async (req, res) => {
  try {
    // Set CORS headers for Chrome extension
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle OPTIONS request (preflight)
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { q = 'upcoming' } = req.query;

    // Special endpoint for getting tournament icons
    if (q === 'tournament_icons') {
      const icons = await getTournamentIcons();
      return res.status(200).json({ icons });
    }

    const targetUrl = `https://vlrggapi.vercel.app/match?q=${encodeURIComponent(q)}`;
    
    console.log('Proxy request:', { 
      method: req.method, 
      query: req.query,
      targetUrl: targetUrl
    });

    const apiResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!apiResponse.ok) {
      const error = await apiResponse.text();
      console.error('API error:', apiResponse.status, error);
      return res.status(apiResponse.status).json({
        error: 'Error from vlrggapi',
        status: apiResponse.status,
        message: error
      });
    }

    const data = await apiResponse.json();

    // If this is a results query, update tournament icons
    if (q === 'results' && data.data && data.data.segments) {
      const icons = await updateTournamentIcons(data.data.segments);
      // Add icons to the response
      data.tournament_icons = icons;
    }

    res.status(200).json(data);

  } catch (error) {
    console.error('Proxy server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};