const jwt = require('jsonwebtoken');
require('dotenv').config();

if (!process.env.SECRET_KEY) {
    throw new Error("SECRET_KEY must be set in environment variables");
}
const JWT_SECRET = process.env.SECRET_KEY;
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
        req.user = { id: decoded.userId };

        // Issue a new token with 24h expiry
        const newToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: '24h' });
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