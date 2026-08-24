require("dotenv").config();
const { createClient } = require('redis');

const client = createClient({
    url: process.env.REDIS_URL,
});

client.on('error', (err) => {
    console.error('❌ Redis Client Error:', err.message);
});

// Reusable Redis connect function
const connectRedis = async () => {
    if (!client.isOpen) {
        try {
            await client.connect();
            console.log('✅ Redis connected');
        } catch (err) {
            console.error('❌ Redis connection failed:', err.message);
        }
    }
};

module.exports = {
    redisClient: client,
    connectRedis,
};
