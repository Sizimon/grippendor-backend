
// Description: Production-ready Discord bot with OCR for Plesk deployment
const {Client, GatewayIntentBits, Partials, SlashCommandBuilder, REST, Routes} = require('discord.js');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const CONFIG_FILE = path.join(__dirname, 'config.json');

// Load Existing Configuration or Create a new one
let config = {};
if(fs.existsSync(CONFIG_FILE)) {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

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
        GatewayIntentBits.GuildMembers,
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
let names = [];

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

const commands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup the bot configuration')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send attendance messages. (Keep in mind this should be an admin channel)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('The color palette (e.g., #FF0000)')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The bot will track all members with the role you choose, (i.e default member role)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('icon')
                .setDescription('The icon URL for your frontend dashboard')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('The title for the frontend dashboard')
                .setRequired(true)),
];

// Run cleanup every hour
setInterval(cleanupOldImages, 3600000);

client.once('ready', async () => {
    logger.log(`Logged in as ${client.user.tag}`);

    const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        logger.log('Successfully registered application (/) commands.');
    } catch (error) {
        logger.error('Error registering application (/) commands:', error);
    }
});

async function initializeBot() {
     // Ensure bot is configured
     if(!config.guild || !config.channel || !config.role) {
        logger.error('Bot not configured! Please run the /setup command.');
        return;
    }

    const guild = client.guilds.cache.get(config.guild);
    if (!guild) {
        logger.error('Guild not found');
        return;
    }

    const role = guild.roles.cache.get(config.role);
    if (!role) {
        logger.error('Role not found');
        return;
    }

    try {
        logger.log('Fetching all members...');
        await guild.members.fetch();
        logger.log('All members fetched');
        const members = guild.members.cache;
        logger.log(`Fetched Members: ${members.map(member => member.user.username).join(', ')}`);
        
        const membersWithRole = members.filter(member => member.roles.cache.has(role.id));
        logger.log(`Members with role: ${membersWithRole.map(member => member.nickname || member.user.username).join(', ')}`);

        const names = membersWithRole.map(member => member.nickname || member.user.username);
        logger.log(`Members with role: ${names.join(', ')}`);
    } catch (error) {
        logger.error('Error fetching members:', error);
    }
}

client.on('interactionCreate', async interaction => {
    if(!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'setup') {
        const channel = interaction.options.getChannel('channel');
        const color = interaction.options.getString('color');
        const role = interaction.options.getRole('role');
        const icon = interaction.options.getString('icon');
        const title = interaction.options.getString('title');

        config = {
            guild: interaction.guild.id,
            channel: channel.id,
            color,
            role: role.id,
            icon,
            title,
        };

        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

        await interaction.reply(`Configuration saved! \n Channel: ${channel} \n Color: ${color} \n Role: ${role} \n Icon: ${icon} \n Title: ${title}`);

        // Initialize the bot with the new configuration
        await initializeBot();
    }
});

client.login(process.env.DISCORD_TOKEN);

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.channel.id !== config.channel) {
        return; //Ignore messages from other channels
    }

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

app.get('/names', (req, res) => {
    res.json(names);
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
const PORT = process.env.PORT || 5001;
app.listen(PORT, '127.0.0.1', () => { // Listen only on localhost
    logger.log(`Server running on port ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN).catch(error => {
    logger.error('Failed to login to Discord:', error);
    process.exit(1);
});
