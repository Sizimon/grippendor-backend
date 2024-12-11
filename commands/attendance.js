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
            option.setName('images')
                .setDescription('The image containing the attendance list')
                .setRequired(true)),
    async execute(interaction) {
        const attachments = interaction.options.getAttachment('images');

        if (!attachments) {
            await interaction.reply('Please upload an image containing the attendance list.');
            return;
        }

        await interaction.deferReply();

        const imageUrls = [attachments.url];
        const imagePaths = [];

        try {
            for (const imageUrl of imageUrls) {
                const imagePath = path.join(IMAGES_DIR, `${Date.now()}-${path.basename(imageUrl)}`);
                await downloadImage(imageUrl, imagePath);
                imagePaths.push(imagePath);
                logger.log(`Images downloaded: ${imagePath}`);
            }

            const names = [];
            for (const imagePath of imagePaths) {
                const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
                names.push(...extractNames(text));
            }

            await interaction.guild.members.fetch();
            const memberMap = new Map();
            interaction.guild.members.cache.forEach(member => {
                const displayName = member.nickname || member.user.username;
                memberMap.set(displayName.toLowerCase(), member.id);
            });

            const matchedNames = [];
            const attendanceEntries = names.map(name => {
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
                    date: new Date().toISOString(),
                    occurrence_counter: 1
                };
            }).filter(entry => entry !== null);

            for (const entry of attendanceEntries) {
                // Insert or update the user in the Users table
                const userQuery = `
                    INSERT INTO Users (user_id, username, total_count)
                    VALUES ($1, $2, 1)
                    ON CONFLICT (user_id)
                    DO UPDATE SET total_count = Users.total_count + 1,
                                  updated_at = CURRENT_TIMESTAMP;
                `;
                const userValues = [entry.user_id, entry.username];
                await dbClient.query(userQuery, userValues);

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
                const guildUserQuery = `
                    INSERT INTO GuildUsers (guild, user_id)
                    VALUES ($1, $2)
                    ON CONFLICT (guild, user_id)
                    DO NOTHING;
                `;
                const guildUserValues = [entry.guild_id, entry.user_id];
                await dbClient.query(guildUserQuery, guildUserValues);
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