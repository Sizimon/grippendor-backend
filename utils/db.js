const { Client } = require('pg');

const dbClient = new Client({
    user: process.env.DB_USER,
    host: process.env.GRIPPENDOR_DB_HOST,
    database: process.env.GRIPPENDOR_DB_NAME,
    password: process.env.GRIPPENDOR_DB_PASSWORD,
    port: process.env.DB_PORT,
});

dbClient.connect();

async function query(text, params) {
    try {
        const result = await dbClient.query(text, params);
        return result;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

module.exports = { query };