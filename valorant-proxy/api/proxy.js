const fetch = require('node-fetch');

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
    res.status(200).json(data);

  } catch (error) {
    console.error('Proxy server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};