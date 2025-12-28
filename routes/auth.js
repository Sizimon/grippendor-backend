const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const db = require('../utils/db')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { authMiddleware } = require('../AuthMiddleware')
const { metricsMiddleware } = require('../metricMiddleware');

const metrics = metricsMiddleware({
    service: 'grippendor-auth-service',
    url: 'https://szymonsamus.dev/api/metrics'
});

const JWT_SECRET = process.env.JWT_SECRET
const isProduction = process.env.GRIPPENDOR_NODE_ENV === 'production';

const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // Limit each IP to 10 login requests per windowMs
    message: {
        error: 'Too many login attempts from this IP, please try again after 10 minutes.'
    }
});

router.post('/auth/login', loginLimiter, metrics, async (req, res) => {
    console.log('Login request received');
    const { guildId, password } = req.body;

    if (!guildId || isNaN(guildId)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid Guild ID. To get your Guild ID, enable Developer Mode in Discord settings, then right-click your server and select "Copy ID".' 
        });
    }

    try {
        const query = 'SELECT password FROM guilds WHERE id = $1';
        const values = [guildId];
        const result = await db.query(query, values);
        if (result.rows.length > 0) {
            const hashedPassword = result.rows[0].password;
            const isMatch = await bcrypt.compare(password, hashedPassword);
            if (isMatch) {
                const token = jwt.sign({ guildId }, JWT_SECRET, { expiresIn: '24h' });
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: isProduction, // Use secure cookies in production
                    sameSite: 'lax',
                    maxAge: 24 * 60 * 60 * 1000 // 24 hours
                });
                res.status(200).json({ success: true });
                console.log('Login successful for guild:', guildId);
            } else {
                res.status(401).json({ 
                    success: false, 
                    error: 'Invalid password' 
                });
            }
        } else {
            res.status(404).json({ 
                success: false, 
                error: 'Guild not found. Add the bot to your server & run the /setup command to register the server.' 
            });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

router.post('/auth/logout', metrics, (req, res) => {
    res.clearCookie('token');
    res.status(200).json({ success: true });
});

router.get('/auth/me', metrics, authMiddleware, (req, res) => {
    res.status(200).json({ 
        authenticated: true,
        guildId: req.guild.id
     });
});

module.exports = router;