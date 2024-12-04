const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const logger = require('../utils/logger');
const { downloadImage, extractNames, saveAttendance, attendanceLog, IMAGES_DIR } = require('../utils/index.js'); // Adjust the path as needed

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

            const attendanceEntry = {
                date: new Date().toISOString(),
                names,
                channelId: interaction.channel.id,
                guildId: interaction.guild.id
            };

            attendanceLog.push(attendanceEntry);
            saveAttendance();

            const formattedNames = names.map((name, index) => `${index + 1}. ${name}`).join('\n');
            await interaction.editReply(names.length > 0
                ? `Attendance recorded for: \n${formattedNames}`
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