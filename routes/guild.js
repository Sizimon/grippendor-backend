const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const db = require('../utils/db')
require('dotenv').config();

const { loadConfig, loadGuildUsersWithRoles, loadEventUserData, loadEventData } = require('../utils/loaders') // Data loading functions
const { authMiddleware } = require('../AuthMiddleware')
const { metricsMiddleware } = require('../metricMiddleware');

const metrics = metricsMiddleware({
    service: 'guild-service',
    url: 'https://szymonsamus.dev/api/metrics'
});

const guildLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 100, // Limit each IP to 10 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again after 10 minutes.'
    }
});

//Endpoint for loading the guild
router.get('/config/:guildId', guildLimiter, metrics, authMiddleware, async (req, res) => {
    const guildId = req.params.guildId;
    if (!guildId || isNaN(guildId)) {
        return res.status(400).json({ 
            error: 'Invalid guild ID' 
        });
    }

    try {
        const config = await loadConfig(guildId);
        if (config) {
            res.json(config);
        } else {
            res.status(404).json({ 
                error: 'Config not found',
            });
        }
    } catch (error) {
        console.error('Error loading config:', error);
        res.status(500).json({ 
            error: 'Internal server error',
        });
    }
});

//Endpoint for loading guild user data.
router.get('/userdata/:guildId', guildLimiter, metrics, authMiddleware, async (req, res) => {
    const guildId = req.params.guildId;
    if (!guildId || isNaN(guildId)) {
        return res.status(400).json({ 
            error: 'Invalid guild ID' 
        });
    }
    try {
        const guildUsersWithRoles = await loadGuildUsersWithRoles(guildId);

        if (guildUsersWithRoles) {
            const userdata = guildUsersWithRoles.map(user => {
                return {
                    name: user.username,
                    counter: user.total_count,
                    roles: user.roles.length > 0 ? user.roles : [],
                };
            });
            res.json(userdata);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error fetching names and roles:', error);
        res.status(500).json({ 
            error: 'Failed to fetch names and roles',
        });
    }
});

//Endpoint to fetch event data
router.get('/eventdata/:guildId', guildLimiter, metrics, authMiddleware, async (req, res) => {
    const guildId = req.params.guildId;
    if (!guildId || isNaN(guildId)) {
        return res.status(400).json({ 
            error: 'Invalid guild ID' 
        });
    }

    try {
        const events = await loadEventData(guildId);
        if (events && events.length > 0) {
            res.json(events);
        } else {
            res.json([]); // 200 OK with empty array
        }
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ 
            error: 'Failed to fetch events' 
        });
    }
});

//Endpoint to fetch users for party making for selected event
router.get('/eventuserdata/:guildId/:eventId', guildLimiter, metrics, authMiddleware, async (req, res) => {
    const guildId = req.params.guildId;
    const eventId = req.params.eventId;

    if (!guildId || isNaN(guildId)) {
        return res.status(400).json({ 
            error: 'Invalid guild ID' 
        });
    }

    if (!eventId || isNaN(eventId)) {
        return res.status(400).json({ 
            error: 'Invalid event ID' 
        });
    }

    try {
        const eventUserData = await loadEventUserData(eventId, guildId);
        console.log('Event user data:', eventUserData);
        if (eventUserData) {
            res.json({ 
                data: eventUserData || [] 
            });
        } else {
            res.status(204).json({ 
                error: 'Event user data not found.' 
            });
        }
    } catch (error) {
        console.error('Error fetching event user data:', error);
        res.status(500).json({ 
            error: 'Failed to fetch event user data.' 
        });
    }
});

router.get('/presets/:guildId', guildLimiter, metrics, authMiddleware, async (req, res) => {
    const guildId = req.params.guildId;
    if (!guildId || isNaN(guildId)) {
        return res.status(400).json({ 
            error: 'Invalid guild ID' 
        });
    }
    try {
        const query = 'SELECT * FROM presets WHERE guild_id = $1';
        const values = [guildId];
        const result = await db.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching presets:', error);
        res.status(500).json({ 
            error: 'Failed to fetch presets.' 
        });
    }
});

module.exports = router;