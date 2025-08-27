const express = require('express');
const router = express.Router();
const db = require('../utils/db')
require('dotenv').config();

const { loadConfig, loadGuildUsers, loadGuildUserRoles, loadEventUserData, loadEventData } = require('../utils/loaders') // Data loading functions
const { authMiddleware } = require('../AuthMiddleware')

//Endpoint for loading the guild
router.get('/config/:guildId', authMiddleware, async (req, res) => {
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
router.get('/userdata/:guildId', authMiddleware, async (req, res) => {
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
router.get('/eventdata/:guildId', authMiddleware, async (req, res) => {
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
router.get('/eventuserdata/:guildId/:eventId', authMiddleware, async (req, res) => {
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

router.get('/presets/:guildId', authMiddleware, async (req, res) => {
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

module.exports = router;