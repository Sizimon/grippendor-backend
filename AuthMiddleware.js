const jwt = require('jsonwebtoken');
require('dotenv').config();

if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET must be set in environment variables");
}
const JWT_SECRET = process.env.JWT_SECRET;
const isProduction = process.env.GRIPPENDOR_NODE_ENV === 'production';

function authMiddleware(req, res, next) {
    const token = req.cookies?.token;
    // console.error('Auth Header:', authHeader);
    if (!token) {
        res.status(401).json({ error: 'Authorization token is required' });
        return;
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.guild = { id: decoded.guildId };

        // Issue a new token with 24h expiry
        const newToken = jwt.sign({ guildId: decoded.guildId }, JWT_SECRET, { expiresIn: '24h' });
        res.cookie('token', newToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });

        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
}

module.exports = {
    authMiddleware
}