const fs = require('fs');
const path = require('path');

// Path to JSON file in the public directory
const ICONS_FILE = path.join(process.cwd(), 'public', 'tournament_icons.json');

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Read icons from JSON file
    const readIcons = () => {
      try {
        return JSON.parse(fs.readFileSync(ICONS_FILE, 'utf8'));
      } catch (error) {
        return { icons: [] };
      }
    };

    // Write icons to JSON file
    const writeIcons = (icons) => {
      fs.writeFileSync(ICONS_FILE, JSON.stringify({ icons }, null, 2), 'utf8');
    };

    if (req.method === 'GET') {
      const data = readIcons();
      return res.status(200).json(data);
    }
    
    if (req.method === 'POST') {
      const { icons } = req.body;
      
      if (!icons || !Array.isArray(icons)) {
        return res.status(400).json({ error: 'Invalid request body' });
      }

      // Merge new icons with existing ones
      const existing = readIcons().icons;
      const merged = [...existing];
      
      icons.forEach(newIcon => {
        const exists = existing.some(e => e.name === newIcon.name);
        if (!exists) {
          merged.push(newIcon);
        }
      });

      writeIcons(merged);
      return res.status(200).json({ message: 'Icons updated successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Tournament icons API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}; 