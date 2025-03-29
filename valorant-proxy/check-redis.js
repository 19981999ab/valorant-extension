const { createClient } = require('redis');
require('dotenv').config({ path: '.env.development.local' });

async function checkRedis() {
  try {
    console.log('Connecting to Redis...');
    const redis = createClient({
      url: process.env.REDIS_URL
    });

    redis.on('error', (err) => console.error('Redis Client Error:', err));
    redis.on('connect', () => console.log('Successfully connected to Redis'));

    await redis.connect();

    // Get all keys
    console.log('\nAll Redis keys:');
    const keys = await redis.keys('*');
    console.log(keys);

    // Get tournament icons
    console.log('\nTournament Icons:');
    const icons = await redis.get('tournament_icons');
    console.log(JSON.parse(icons));

    await redis.quit();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRedis(); 