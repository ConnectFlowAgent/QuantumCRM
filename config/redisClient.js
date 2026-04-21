const redis = require('redis');
require('dotenv').config();

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => console.log('Redis Client Error', err));

// Auto connect
(async () => {
    await client.connect();
    console.log('Connected to Redis');
})();

module.exports = client;
