const express = require('express');
const router = express.Router();
const db = require('../utils/db')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { authMiddleware } = require('../AuthMiddleware')

const JWT_SECRET = process.env.SECRET_KEY || Math.random().toString(36).substring(7);
const isProduction = process.env.GRIPPENDOR_NODE_ENV === 'production';

router.post('/auth/login', async (req, res) => {
    console.log('Login request received');
    const { guildId, password } = req.body;
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
                res.json({ success: true });
                console.log('Login successful for guild:', guildId);
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

router.post('/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

router.get('/auth/me', authMiddleware, (req, res) => {
    res.json({ 
        authenticated: true,
        guildId: req.guild.id
     });
});

module.exports = router;