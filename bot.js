const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const logger = require('./utils/logger');
const client = require('./client'); // Import the client
const { saveAttendance, cleanupOldImages, attendanceLog } = require('./utils'); // Import utility functions
const { getNames } = require('./utils/state');
const { Client } = require('pg');

// Create a new PostgreSQL client
const dbClient = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

dbClient.connect();

// const CONFIG_FILE = path.join(__dirname, 'config.json');

// // Load Existing Configuration or Create a new one
// let config = {};
// if (fs.existsSync(CONFIG_FILE)) {
//     config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
// }
// // End

async function loadConfig(guildId) {
    if (!guildId || isNaN(guildId)) {
        logger.error('Invalid guild ID:', guildId);
        return null;
    }

    const query = 'SELECT * FROM guilds WHERE guild = $1';
    const values = [guildId];
    try {
        const res = await dbClient.query(query, values);
        if (res.rows.length > 0) {
            return res.rows[0];
        } else {
            logger.error('Config not found for guild:', guildId);
            return null;
        }
    } catch (error) {
        logger.error('Error loading config from database:', error);
        return null;
    }
}

// Ensure images directory exists
const IMAGES_DIR = path.join(__dirname, 'images');
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}
// End

logger.log('Starting bot...');

const app = express();
app.use(cors());
app.use(express.json());

// Store attendance in file instead of memory
const ATTENDANCE_FILE = path.join(__dirname, 'data', 'attendance.json');
if (!fs.existsSync(path.dirname(ATTENDANCE_FILE))) {
    fs.mkdirSync(path.dirname(ATTENDANCE_FILE), { recursive: true });
}

try {
    if (fs.existsSync(ATTENDANCE_FILE)) {
        const fileData = JSON.parse(fs.readFileSync(ATTENDANCE_FILE, 'utf8'));
        attendanceLog.length = 0;
        attendanceLog.push(...fileData);
    }
} catch (error) {
    logger.error('Error loading attendance log:', error);
}
// End

// Run cleanup every hour
setInterval(cleanupOldImages, 3600000);
// End

// API routes with basic security
const API_KEY = process.env.API_KEY || Math.random().toString(36).substring(7);
logger.log(`API Key: ${API_KEY}`); // Log this only on startup

app.use((req, res, next) => {
    const providedKey = req.headers['x-api-key'];
    if (!providedKey || providedKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

app.get('/names', (req, res) => {
    res.json(getNames());
});

app.get('/attendance', (req, res) => {
    res.json(attendanceLog);
});

app.get('/config/:guildId', async (req, res) => {
    const guildId = req.params.guildId;
    if (!guildId || isNaN(guildId)) {
        return res.status(400).json({ error: 'Invalid guild ID' });
    }
    const config = await loadConfig(guildId);
    if (config) {
        res.json(config);
    } else {
        res.status(404).json({ error: 'Config not found' });
    }
    // try {
    //     if (fs.existsSync(CONFIG_FILE)) {
    //         config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    //     }
    //     res.setHeader('Content-Type', 'application/json');   
    //     res.setHeader('Cache-Control', 'no-store');
    //     res.json(config);
    // } catch (error) {
    //     logger.error('Error fetching config:', error);
    //     res.status(500).json({ error: 'Internal Server Error' });
    // }
});
// End


// Graceful shutdown
process.on('SIGTERM', () => {
    logger.log('SIGTERM received. Shutting down gracefully...');
    saveAttendance();
    client.destroy();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled Rejection:', error);
});
// End

// Start the bot and API server
const PORT = process.env.PORT || 5001;
app.listen(PORT, '127.0.0.1', () => { // Listen only on localhost
    logger.log(`Server running on port ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN).catch(error => {
    logger.error('Failed to login to Discord:', error);
    process.exit(1);
});
// End