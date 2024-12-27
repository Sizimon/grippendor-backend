const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const logger = require('./utils/logger');
const client = require('./client'); // Import the client
const { cleanupOldImages } = require('./utils'); // Import utility functions
const { getNames } = require('./utils/state');
const { Client } = require('pg');
const exp = require('constants');

// Create a new PostgreSQL client
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

const JWT_SECRET = process.env.SECRET_KEY || Math.random().toString(36).substring(7);

// Run cleanup every hour
setInterval(cleanupOldImages, 3600000);
// End

// API routes with basic security
// const API_KEY = process.env.API_KEY || Math.random().toString(36).substring(7);
// logger.log(`API Key: ${API_KEY}`); // Log this only on startup

// app.use((req, res, next) => {
//     const providedKey = req.headers['x-api-key'];
//     if (!providedKey || providedKey !== API_KEY) {
//         return res.status(401).json({ error: 'Unauthorized' });
//     }
//     next();
// });

app.post('/login', async (req, res) => {
    const { guildId, password } = req.body;
    try {
        const query = 'SELECT password FROM guilds WHERE guild = $1';
        const values = [guildId];
        const result = await dbClient.query(query, values);
        if (result.rows.length > 0) {
            const hashedPassword = result.rows[0].password;
            const isMatch = await bcrypt.compare(password, hashedPassword);
            if (isMatch) {
                const token = jwt.sign({ guildId }, JWT_SECRET, { expiresIn: '1h' });
                res.json({ success: true, token });
            } else {
                res.json({ success: false });
            }
        } else {
            res.json({ success: false });
        }
    } catch (error) {
        logger.error('Error during login:', error);
        res.status(500).json({ success: false });
    }
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
}

app.get('/names/:guildId', authenticateToken, (req, res) => {
    const guildId = req.params.guildId;
    if (!guildId || isNaN(guildId)) {
        return res.status(400).json({ error: 'Invalid guild ID' });
    }
    const names = getNames(guildId);
    if (names) {
        res.json(names);
    } else {
        res.status(404).json({ error: 'Names not found' });
    } 
});

app.get('/attendance/:guildId', authenticateToken, async (req, res) => {
    const guildId = req.params.guildId;
    if (!guildId || isNaN(guildId)) {
        return res.status(400).json({ error: 'Invalid guild ID' });
    }
    const attendance = await loadAttendanceLog(guildId);
    if (attendance) {
        res.json(attendance);
    } else {
        res.status(404).json({ error: 'Attendance log not found' });
    }
});

app.get('/config/:guildId', authenticateToken, async (req, res) => {
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