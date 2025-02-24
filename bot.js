const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const logger = require('./utils/logger');
const client = require('./client'); // Import the client
const { cleanupOldImages } = require('./utils');
const { initializeBot } = require('./utils/index.js');
const { loadConfig, loadAttendanceLog, loadGuildUsers, loadGuildUserRoles, loadEventUserData, loadEventData } = require('./utils/loaders.js')
const { Client } = require('pg');

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json()); // Parse JSON bodies

// Create a new PostgreSQL client
const dbClient = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

dbClient.connect();

// Ensure images directory exists
const IMAGES_DIR = path.join(__dirname, 'images');
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}
// End

logger.log('Starting bot...');
const JWT_SECRET = process.env.SECRET_KEY || Math.random().toString(36).substring(7);

// Run cleanup every hour
setInterval(cleanupOldImages, 3600000);
// End

app.post('/login', async (req, res) => {
    logger.log('Login request received');
    const { guildId, password } = req.body;

    try {
        const query = 'SELECT password FROM guilds WHERE id = $1';
        const values = [guildId];
        const result = await dbClient.query(query, values);
        if (result.rows.length > 0) {
            const hashedPassword = result.rows[0].password;
            const isMatch = await bcrypt.compare(password, hashedPassword);
            if (isMatch) {
                const config = await loadConfig(guildId);
                if (!config) {
                    logger.error('Config not found for guild:', guildId);
                    return res.status(500).json({ success: false, error: 'Config failed.' });
                }
                // Initialize bot for the guild
                await initializeBot(client, config);
                //console.log(`Bot initialized for guild ${guildId}`);
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

app.get('/userdata/:guildId', authenticateToken, async (req, res) => {
    const guildId = req.params.guildId;
    if (!guildId || isNaN(guildId)) {
        return res.status(400).json({ error: 'Invalid guild ID' });
    }
    try {
        const guildUsers = await loadGuildUsers(guildId);
        const guildUserRoles = await loadGuildUserRoles(guildId);
        //console.log('Guild Users:', guildUsers);
        //console.log('Guild User Roles:', guildUserRoles)
        if (guildUsers && guildUserRoles) {
            const userdata = guildUsers.map(user => {
                const roles = guildUserRoles
                    .filter(role => role.user_id === user.user_id && role.has_role)
                    .map(role => role.role_name);
                return {
                    name: user.username,
                    counter: user.total_count,
                    roles: roles
                };
            });
            res.json(userdata);
            //console.log('Names and roles fetched:', userdata);
        } else {
            res.status(404).json({ error: 'Names or roles not found' });
        }
    } catch (error) {
        logger.error('Error fetching names and roles:', error);
        res.status(500).json({ error: 'Failed to fetch names and roles' });
    }
});

app.get('/eventdata/:guildId', authenticateToken, async (req, res) => {
    const guildId = req.params.guildId;
    if (!guildId || isNaN(guildId)) {
        return res.status(400).json({ error: 'Invalid guild ID' });
    }

    try {
        const events = await loadEventData(guildId);
        if (events && events.length > 0) {
            const latestEvent = events[events.length - 1];
            const eventUserData = await loadEventUserData(latestEvent.id, guildId);
            res.json({ events, latestEventUserData: eventUserData });
        } else {
            res.status(404).json({ error: 'Events not found' });
        }
    } catch (error) {
        logger.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
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