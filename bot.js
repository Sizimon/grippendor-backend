// Description: A simple Discord bot that records attendance from images using OCR. 
const {Client, GatewayIntentBits, Partials} = require('discord.js');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

console.log('Starting bot...');

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

let attendanceLog = [];

// Function to download and save image
async function downloadImage(url, filepath) {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    return new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(filepath))
            .on('finish', () => resolve())
            .on('error', e => reject(e));
    });
}

// Extract names from OCR text
function extractNames(text) {
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line && /^[A-Za-z][A-Za-z]+/.test(line)); // Simple name detection
}

client.once('ready', () => {
    console.log('Ready!');
})

client.on('messageCreate', async (message) => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check if the message has image attachments
    if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        const imageUrl = attachment.url;
        const imagePath = path.join(__dirname, 'images', attachment.name);

        try {
            // console.log('Downloading image:', imageUrl);
            await downloadImage(imageUrl, imagePath);
            // console.log('Image downloaded:', imagePath);

            // Run OCR on the image
            // console.log('Running OCR on image...');
            const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
            // console.log('OCR result:', text);
            const names = extractNames(text);
            const attendanceEntry = { 
                date: new Date().toISOString(),
                names 
            };
            // console.log('Attendance recorded:', attendanceEntry);
            attendanceLog.push(attendanceEntry);

            // Format and send reply
            const formattedNames = names.map((name, index) => `${index + 1}. ${name}`).join('\n');
            message.reply(`Attendance recorded for: \n${formattedNames}`);
            fs.unlinkSync(imagePath);
            // Process the image as needed
        } catch (error) {
            console.error('Error downloading image:', error);
            message.reply('Failed to download image.');
        }
    } else {
        message.reply('Please send an image');
    }
});

// API route for fetching attendance log
app.get('/attendance', (req, res) => {
    res.json(attendanceLog);
});

// Start the bot and API server
const PORT = 5001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Log the bot into discord
client.login(process.env.DISCORD_TOKEN);