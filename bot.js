// Description: Production-ready Discord bot with OCR for Plesk deployment
const {Client, GatewayIntentBits, Partials} = require('discord.js');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Ensure logs directory exists
const LOG_DIR = path.join(__dirname, 'logs');
const IMAGES_DIR = path.join(__dirname, 'images');
[LOG_DIR, IMAGES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Setup logging
const logStream = fs.createWriteStream(path.join(LOG_DIR, 'bot.log'), { flags: 'a' });
const logger = {
    log: (msg) => {
        const timestamp = new Date().toISOString();
        logStream.write(`[${timestamp}] INFO: ${msg}\n`);
        console.log(`[${timestamp}] ${msg}`);
    },
    error: (msg, error) => {
        const timestamp = new Date().toISOString();
        logStream.write(`[${timestamp}] ERROR: ${msg} ${error?.stack || error}\n`);
        console.error(`[${timestamp}] ERROR: ${msg}`, error);
    }
};

logger.log('Starting bot...');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

const app = express();
app.use(cors());
app.use(express.json());

// Store attendance in file instead of memory
const ATTENDANCE_FILE = path.join(__dirname, 'data', 'attendance.json');
if (!fs.existsSync(path.dirname(ATTENDANCE_FILE))) {
    fs.mkdirSync(path.dirname(ATTENDANCE_FILE), { recursive: true });
}

let attendanceLog = [];
try {
    if (fs.existsSync(ATTENDANCE_FILE)) {
        attendanceLog = JSON.parse(fs.readFileSync(ATTENDANCE_FILE, 'utf8'));
    }
} catch (error) {
    logger.error('Error loading attendance log:', error);
}

// Save attendance to file
function saveAttendance() {
    try {
        fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(attendanceLog, null, 2));
    } catch (error) {
        logger.error('Error saving attendance log:', error);
    }
}

async function downloadImage(url, filepath) {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 10000 // 10 second timeout
        });
        return new Promise((resolve, reject) => {
            response.data.pipe(fs.createWriteStream(filepath))
                .on('finish', () => resolve())
                .on('error', e => reject(e));
        });
    } catch (error) {
        throw new Error(`Failed to download image: ${error.message}`);
    }
}

function extractNames(text) {
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line && /^[A-Za-z][A-Za-z\s]{1,50}$/.test(line)); // More robust name detection
}

// Cleanup old images (older than 1 hour)
function cleanupOldImages() {
    try {
        const files = fs.readdirSync(IMAGES_DIR);
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(IMAGES_DIR, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > 3600000) { // 1 hour
                fs.unlinkSync(filePath);
            }
        });
    } catch (error) {
        logger.error('Error cleaning up old images:', error);
    }
}

// Run cleanup every hour
setInterval(cleanupOldImages, 3600000);

client.once('ready', () => {
    logger.log('Bot is ready and connected to Discord!');
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        const imageUrl = attachment.url;
        const imagePath = path.join(IMAGES_DIR, `${Date.now()}-${attachment.name}`);

        try {
            await downloadImage(imageUrl, imagePath);
            logger.log(`Image downloaded: ${imagePath}`);

            const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
            const names = extractNames(text);
            const attendanceEntry = {
                date: new Date().toISOString(),
                names,
                channelId: message.channel.id,
                guildId: message.guild?.id
            };

            attendanceLog.push(attendanceEntry);
            saveAttendance();

            const formattedNames = names.map((name, index) => `${index + 1}. ${name}`).join('\n');
            await message.reply(names.length > 0
                ? `Attendance recorded for: \n${formattedNames}`
                : 'No names were detected in the image.');
        } catch (error) {
            logger.error('Error processing image:', error);
            await message.reply('An error occurred while processing the image. Please try again.');
        } finally {
            // Cleanup the image file
            try {
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            } catch (error) {
                logger.error('Error deleting image:', error);
            }
        }
    } else {
        await message.reply('Please send an image containing the attendance list.');
    }
});

// API routes with basic security
const API_KEY = process.env.API_KEY || Math.random().toString(36).substring(7);
logger.log(`API Key: ${API_KEY}`); // Log this only on startup

app.use((req, res, next) => {
    const providedKey = req.headers['x-api-key'];
    if (!providedKey || providedKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

app.get('/attendance', (req, res) => {
    res.json(attendanceLog);
});

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

// Start the bot and API server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '127.0.0.1', () => { // Listen only on localhost
    logger.log(`Server running on port ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN).catch(error => {
    logger.error('Failed to login to Discord:', error);
    process.exit(1);
});
