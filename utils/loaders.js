const { Client } = require('pg');
const logger = require('./logger');

const dbClient = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

dbClient.connect();

async function loadConfig(guildId) {
    if (!guildId || isNaN(guildId)) {
        logger.error('Invalid guild ID:', guildId);
        return null;
    }
    try {
        const query = 'SELECT * FROM guilds WHERE id = $1';
        const values = [guildId];
        const result = await dbClient.query(query, values);
        if (result.rows.length > 0) {
            return result.rows[0];
        } else {
            logger.error('No configuration found for guild ID:', guildId);
            return null;
        }
    } catch (error) {
        logger.error('Error loading config:', error);
        return null;
    }
}

async function loadAttendanceLog(guildId) {
    if (!guildId || isNaN(guildId)) {
        logger.error('Invalid guild ID:', guildId);
        return null;
    }

    const query = 'SELECT * FROM Attendance WHERE guild_id = $1';
    const values = [guildId];

    try {
        const res = await dbClient.query(query, values);
        if (res.rows.length > 0) {
            return res.rows;
        } else {
            logger.error('Attendance log not found for guild:', guildId);
            return null;
        }
    } catch (error) {
        logger.error('Error loading attendance log from database:', error);
        return null;
    }
}

async function loadGuildUsers(guildId) {
    if (!guildId || isNaN(guildId)) {
        logger.error('Invalid guild ID:', guildId);
        return null;
    }

    const query = 'SELECT * FROM GuildUsers WHERE guild_id = $1';
    const values = [guildId];

    try {
        const res = await dbClient.query(query, values);
        if (res.rows.length > 0) {
            return res.rows;
        } else {
            logger.error('Guild members not found for guild:', guildId);
            return null;
        }
    } catch (error) {
        logger.error('Error loading names from database:', error);
        return null;
    }
}

module.exports = {
    loadConfig,
    loadAttendanceLog,
    loadGuildUsers,
};