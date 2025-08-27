const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const logger = require('./utils/logger');
const client = require('./client'); // Import the discord client (Located client.js)

const authRouter = require('./routes/auth.js')
const guildRouter = require('./routes/guild.js')

const app = express();
app.use(cors({ 
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json()); // Parse JSON bodies
app.use(cookieParser()); // Parse cookies

console.log('Starting bot...');
app.use('/api', authRouter);
app.use('/api', guildRouter);


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