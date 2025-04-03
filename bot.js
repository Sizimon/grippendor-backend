const express = require('express');
const cors = require('cors');
const db = require('./utils/db')
require('dotenv').config();

// SECURITY UTILITIES
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
//END

const logger = require('./utils/logger');
const client = require('./client'); // Import the discord client (Located client.js)
const { loadConfig, loadGuildUsers, loadGuildUserRoles, loadEventUserData, loadEventData } = require('./utils/loaders.js') // Data loading functions

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json()); // Parse JSON bodies

// END

logger.log('Starting bot...');
const JWT_SECRET = process.env.SECRET_KEY || Math.random().toString(36).substring(7);

app.post('/bot-backend/login', async (req, res) => {
    logger.log('Login request received');
    const { guildId, password } = req.body;

    try {
        const query = 'SELECT password FROM guilds WHERE id = $1';
        const values = [guildId];
        const result = await db.query(query, values);
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

//Endpoint for loading the guild
app.get('/bot-backend/config/:guildId', authenticateToken, async (req, res) => {
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

//Endpoint for loading guild user data.
app.get('/bot-backend/userdata/:guildId', authenticateToken, async (req, res) => {
    const guildId = req.params.guildId;
    if (!guildId || isNaN(guildId)) {
        return res.status(400).json({ error: 'Invalid guild ID' });
    }
    try {
        const guildUsers = await loadGuildUsers(guildId);
        const guildUserRoles = await loadGuildUserRoles(guildId);

        if (guildUsers && guildUserRoles) {
            const userdata = guildUsers.map(user => {
                const roles = guildUserRoles
                    .filter(role => role.user_id === user.user_id && role.has_role)
                    .map(role => role.role_name);
                return {
                    name: user.username,
                    counter: user.total_count,
                    roles: roles.length > 0 ? roles : [],
                };
            });
            res.json(userdata);
        } else {
            res.status(404).json({ error: 'Names or roles not found' });
        }
    } catch (error) {
        logger.error('Error fetching names and roles:', error);
        res.status(500).json({ error: 'Failed to fetch names and roles' });
    }
});


//Endpoint to fetch event data
app.get('/bot-backend/eventdata/:guildId', authenticateToken, async (req, res) => {
    const guildId = req.params.guildId;
    if (!guildId || isNaN(guildId)) {
        return res.status(400).json({ error: 'Invalid guild ID' });
    }

    try {
        const events = await loadEventData(guildId);
        if (events && events.length > 0) {
            res.json(events);
        } else {
            res.status(404).json({ error: 'Events not found' });
        }
    } catch (error) {
        logger.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

//Endpoint to fetch users for party making for selected event
app.get('/bot-backend/eventuserdata/:guildId/:eventId', authenticateToken, async (req, res) => {
    const guildId = req.params.guildId;
    const eventId = req.params.eventId;

    if (!guildId || isNaN(guildId)) {
        return res.status(400).json({ error: 'Invalid guild ID' });
    }

    if (!eventId || isNaN(eventId)) {
        return res.status(400).json({ error: 'Invalid event ID' });
    }

    try {
        const eventUserData = await loadEventUserData(eventId, guildId);
        console.log('Event user data:', eventUserData);
        if (eventUserData) {
            res.json({ eventUserData });
        } else {
            res.status(404).json({ error: 'Event user data not found.'});
        }
    } catch (error) {
        console.error('Error fetching event user data:', error);
        res.status(500).json({ error: 'Failed to fetch event user data.' });
    }
});

app.get('/bot-backend/presets/:guildId', authenticateToken, async (req, res) => {
    const guildId = req.params.guildId;
    if (!guildId || isNaN(guildId)) {
        return res.status(400).json({ error: 'Invalid guild ID' });
    }
    try {
        const query = 'SELECT * FROM presets WHERE guild_id = $1';
        const values = [guildId];
        const result = await db.query(query, values);
        if (result.rows.length > 0) {
            res.json(result.rows);
        } else {
            res.status(404).json({ error: 'No presets found for this guild.' });
        }
    } catch (error) {
        logger.error('Error fetching presets:', error);
        res.status(500).json({ error: 'Failed to fetch presets.' });
    }
});

// End

// Start the bot and API server
const PORT = process.env.PORT || 5003;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN).catch(error => {
    logger.error('Failed to login to Discord:', error);
    process.exit(1);
});
// End