const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const logger = require('../utils/logger');
const { downloadImage, extractNames, IMAGES_DIR } = require('../utils/index.js'); // Adjust the path as needed
const { Client } = require('pg');

// PostgreSQL client
const dbClient = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

dbClient.connect();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('attendance')
        .setDescription('Upload Image of Usernames to record attendance')
        .addAttachmentOption(option =>
            option.setName('image1')
                .setDescription('The image containing the attendance list')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('image2')
                .setDescription('The image containing the attendance list')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('image3')
                .setDescription('The image containing the attendance list')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('image4')
                .setDescription('The image containing the attendance list')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('image5')
                .setDescription('The image containing the attendance list')
                .setRequired(false)),
    async execute(interaction) {
        const attachments = [
            interaction.options.getAttachment('image1'),
            interaction.options.getAttachment('image2'),
            interaction.options.getAttachment('image3'),
            interaction.options.getAttachment('image4'),
            interaction.options.getAttachment('image5')
        ].filter(attachment => attachment !== null);

        if (attachments === 0) {
            await interaction.reply('Please upload an image containing the attendance list.');
            return;
        }

        await interaction.deferReply();

        const imageUrls = attachments.map(attachment => attachment.url);
        const imagePaths = [];

        try {
            for (const imageUrl of imageUrls) {
                const imagePath = path.join(IMAGES_DIR, `${Date.now()}-${path.basename(imageUrl)}`);
                await downloadImage(imageUrl, imagePath);
                imagePaths.push(imagePath);
                logger.log(`Images downloaded: ${imagePath}`);
            }

            const names = new Set();
            for (const imagePath of imagePaths) {
                const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
                const extractedNames = extractNames(text);
                extractedNames.forEach(name => names.add(name));
            }

            if (names.size === 0) {
                await interaction.editReply('No names were detected in the image.');
                return;
            }

            await interaction.guild.members.fetch();
            const memberMap = new Map();
            interaction.guild.members.cache.forEach(member => {
                const displayName = member.nickname || member.user.username;
                memberMap.set(displayName.toLowerCase(), member.id);
            });

            const matchedNames = [];
            const attendanceEntries = Array.from(names).map(name => {
                const userId = memberMap.get(name.toLowerCase());
                logger.log(`User ID for ${name}: ${userId}`);
                if (!userId) {
                    logger.log(`User ID not found for name: ${name}`);
                    return null;
                }
                matchedNames.push(name);
                return {
                    guild_id: interaction.guild.id,
                    user_id: userId,
                    username: name,
                    date: new Date().toISOString(), // Use only the date part
                    occurrence_counter: 1
                };
            }).filter(entry => entry !== null);

            if (attendanceEntries.length === 0) {
                await interaction.editReply('No names were detected in the image.');
                return;
            }

            for (const entry of attendanceEntries) {
                // Insert or update the attendance record in the Attendance table
                const attendanceQuery = `
                    INSERT INTO Attendance (guild_id, user_id, username, date, occurrence_counter)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (guild_id, user_id, date)
                    DO UPDATE SET occurrence_counter = Attendance.occurrence_counter + 1,
                                  updated_at = CURRENT_TIMESTAMP;
                `;
                const attendanceValues = [entry.guild_id, entry.user_id, entry.username, entry.date, entry.occurrence_counter];
                await dbClient.query(attendanceQuery, attendanceValues);

                // Insert or update the guild-user relationship in the GuildUsers table
                const updateGuildUserQuery = `
                UPDATE GuildUsers
                SET total_count = total_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE guild = $1 AND user_id = $2;
                `;
                const updateGuildUserValues = [entry.guild_id, entry.user_id];
                await dbClient.query(updateGuildUserQuery, updateGuildUserValues);
            }

            const formattedMatchedNames = matchedNames.map((name, index) => `${index + 1}. ${name}`).join('\n');
            await interaction.editReply(matchedNames.length > 0
                ? `Attendance recorded for: \n${formattedMatchedNames}`
                : 'No names were detected in the image.');

        } catch (error) {
            logger.error('Error processing image:', error);
            await interaction.editReply('An error occurred while processing the images. Please try again.');
        } finally {
            // Cleanup the image file
            for (const imagePath of imagePaths) {
                try {
                    if (fs.existsSync(imagePath)) {
                        fs.unlinkSync(imagePath);
                    }
                } catch (error) {
                    logger.error('Error deleting image file:', error);
                }
            }
        }
    }
};