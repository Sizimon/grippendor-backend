const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const moment = require('moment-timezone');
const { uploadImageToCloudinary } = require('../utils/cloudinary.js')
const db = require('../utils/db.js')
const eventService = require('../services/eventService.js')

const timeZones = [
    { label: 'UTC-10:00 (HST)', value: 'Etc/GMT+10' },
    { label: 'UTC-09:00 (AKST)', value: 'Etc/GMT+9' },
    { label: 'UTC-08:00 (PST)', value: 'Etc/GMT+8' },
    { label: 'UTC-07:00 (MST)', value: 'Etc/GMT+7' },
    { label: 'UTC-06:00 (CST)', value: 'Etc/GMT+6' },
    { label: 'UTC-05:00 (EST)', value: 'America/New_York' },
    { label: 'UTC-04:00 (CLT)', value: 'America/Santiago' },
    { label: 'UTC-03:00 (ART)', value: 'America/Argentina/Buenos_Aires' },
    { label: 'UTC-02:00 (GST)', value: 'Atlantic/South_Georgia' },
    { label: 'UTC-01:00 (AZOT)', value: 'Atlantic/Azores' },
    { label: 'UTC+00:00 (GMT)', value: 'Europe/London' },
    { label: 'UTC+01:00 (CEST)', value: 'Europe/Paris' },
    { label: 'UTC+02:00 (EET)', value: 'Europe/Athens' },
    { label: 'UTC+03:00 (MSK)', value: 'Europe/Moscow' },
    { label: 'UTC+04:00 (GST)', value: 'Asia/Dubai' },
    { label: 'UTC+05:00 (PKT)', value: 'Asia/Karachi' },
    { label: 'UTC+06:00 (BST)', value: 'Asia/Dhaka' },
    { label: 'UTC+07:00 (ICT)', value: 'Asia/Bangkok' },
    { label: 'UTC+08:00 (SGT)', value: 'Asia/Singapore' },
    { label: 'UTC+09:00 (JST)', value: 'Asia/Tokyo' },
    { label: 'UTC+10:00 (AEST)', value: 'Australia/Sydney' },
    { label: 'UTC+11:00 (NCT)', value: 'Pacific/Noumea' },
    { label: 'UTC+12:00 (NZST)', value: 'Pacific/Auckland' },
];


module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-event')
        .setDescription('Create an event')
        .addRoleOption(option =>
            option.setName('game')
                .setDescription('Select the game (role) for the event.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the Event/Mission.')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel in which the Event/Mission will be posted.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('summary')
                .setDescription('A brief summary of the Event/Mission. (MAXIMUM: 50 Characters)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('A full briefing of the Event/Mission.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('date')
                .setDescription('The date of the Event/Mission in this format: (YYYY-MM-DD)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('time')
                .setDescription('The time of the Event/Mission: (HH:MM in 24-hour format)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('timezone')
                .setDescription('Your timezone in UTC format.')
                .setRequired(true)
                .addChoices(timeZones.map(tz => ({ name: tz.label, value: tz.value }))))
        .addAttachmentOption(option =>
            option.setName('thumbnail_url')
                .setDescription('Attach a Thumbnail Image URL for the Event/Mission.')
                .setRequired(true)),
        //         .addAttachmentOption(option => CHANGE NAMING TO IMAGE_URLS LATER
        //     option.setName('briefing_url')
        //         .setDescription('Attach a Thumbnail Image URL for the Event/Mission.')
        //         .setRequired(false))
        // .addAttachmentOption(option =>
        //     option.setName('briefing_url_2')
        //         .setDescription('Attach a Thumbnail Image URL for the Event/Mission.')
        //         .setRequired(false))
        // .addAttachmentOption(option =>
        //     option.setName('briefing_url_3')
        //         .setDescription('Attach a Thumbnail Image URL for the Event/Mission.')
        //         .setRequired(false))
    async execute(interaction) {
        await interaction.reply({ content: 'Creating event...', ephemeral: true });

        // Verify that the command user has the required role!
        const getAdminRoleQuery = `
                                SELECT admin_role
                                FROM guilds
                                WHERE id = $1
                            `;
        const adminSearchResult = await db.query(getAdminRoleQuery, [interaction.guild.id]);

        if (adminSearchResult.rows.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Configuration Error')
                .setDescription('Could not find the admin role for this server.')
                .setColor('#ff0000')
                .setFooter({ text: 'Contact an administrator to set up the bot properly.' });

            return await interaction.editReply({
                content: '',
                embeds: [errorEmbed],
                ephemeral: true
            });
        }

        const requiredRole = adminSearchResult.rows[0].admin_role;
        const hasPermission = interaction.member.roles.cache.has(requiredRole);

        if (!hasPermission) {
            const permissionEmbed = new EmbedBuilder()
                .setTitle('🔒 Access Denied')
                .setDescription('You do not have permission to create events.')
                .addFields(
                    { name: 'Required Role', value: `<@&${requiredRole}>`, inline: true }
                )
                .setColor('#ff6b00')
                .setFooter({ text: 'Contact an administrator if you believe this is an error.' });

            return await interaction.editReply({
                content: '',
                embeds: [permissionEmbed],
                ephemeral: true
            });
        }

        const gameDetails = interaction.options.getRole('game');
        const name = interaction.options.getString('name');
        const channel = interaction.options.getChannel('channel');
        const summary = interaction.options.getString('summary');
        const description = interaction.options.getString('description');
        const date = interaction.options.getString('date');
        const time = interaction.options.getString('time');
        const timezone = interaction.options.getString('timezone');
        const thumbnail = interaction.options.getAttachment('thumbnail_url');
        // const images = [
        //     interaction.options.getAttachment('briefing_url'),
        //     interaction.options.getAttachment('briefing_url_2'),
        //     interaction.options.getAttachment('briefing_url_3')
        // ].filter(image => image !== null);

        // !!! VALIDATION CHECKS !!!
        if (name.length > 50) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Validation Error')
                .setDescription('The event name is too long.')
                .addFields(
                    { name: 'Current Length', value: `${name.length} characters`, inline: true },
                    { name: 'Maximum Allowed', value: '50 characters', inline: true }
                )
                .setColor('#ff0000');

            return await interaction.editReply({
                content: '',
                embeds: [errorEmbed],
                ephemeral: true
            });
        }

        if (summary.length > 250) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Validation Error')
                .setDescription('The event summary is too long.')
                .addFields(
                    { name: 'Current Length', value: `${summary.length} characters`, inline: true },
                    { name: 'Maximum Allowed', value: '250 characters', inline: true }
                )
                .setColor('#ff0000');

            return await interaction.editReply({
                content: '',
                embeds: [errorEmbed],
                ephemeral: true
            });
        }

        if (description.length > 2000) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Validation Error')
                .setDescription('The event description is too long.')
                .addFields(
                    { name: 'Current Length', value: `${description.length} characters`, inline: true },
                    { name: 'Maximum Allowed', value: '2000 characters', inline: true }
                )
                .setColor('#ff0000');

            return await interaction.editReply({
                content: '',
                embeds: [errorEmbed],
                ephemeral: true
            });
        }

        // Check the date was entered correctly
        if (date) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Invalid Date Format')
                    .setDescription('Please use the correct date format.')
                    .addFields(
                        { name: 'Required Format', value: 'YYYY-MM-DD', inline: true },
                        { name: 'Example', value: '2024-12-25', inline: true }
                    )
                    .setColor('#ff0000');

                return await interaction.editReply({
                    content: '',
                    embeds: [errorEmbed],
                    ephemeral: true
                });
            }
            console.log('date:', date);
        }

        if (time) {
            const timeRegex = /^\d{2}:\d{2}$/;
            if (!timeRegex.test(time)) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Invalid Time Format')
                    .setDescription('Please use the correct time format.')
                    .addFields(
                        { name: 'Required Format', value: 'HH:MM (24-hour)', inline: true },
                        { name: 'Example', value: '14:30 or 09:15', inline: true }
                    )
                    .setColor('#ff0000');

                return await interaction.editReply({
                    content: '',
                    embeds: [errorEmbed],
                    ephemeral: true
                });
            }
            console.log('time:', time);
        }

        // Validate that the date itself is correct
        const isValidDate = moment(date, 'YYYY-MM-DD', true).isValid();
        if (!isValidDate) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Invalid Date')
                .setDescription('The date you entered does not exist.')
                .addFields(
                    { name: 'Your Input', value: date, inline: true },
                    { name: 'Format Required', value: 'YYYY-MM-DD', inline: true }
                )
                .setColor('#ff0000');

            return await interaction.editReply({
                content: '',
                embeds: [errorEmbed],
                ephemeral: true
            });
        }

        // Validate that the time itself is correct
        const isValidTime = moment(time, 'HH:mm', true).isValid();
        if (!isValidTime) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Invalid Time')
                .setDescription('The time you entered is not valid.')
                .addFields(
                    { name: 'Your Input', value: time, inline: true },
                    { name: 'Format Required', value: 'HH:MM (24-hour)', inline: true }
                )
                .setColor('#ff0000');

            return await interaction.editReply({
                content: '',
                embeds: [errorEmbed],
                ephemeral: true
            });
        }

        // CONVERTS THE INPUT DATE / TIME WITH MOMENT, THEN CONVERTS THAT INTO UTC FOR THE DB
        const eventDateTimeLocal = moment.tz(`${date} ${time}`, timezone);
        console.log('Event Date Time Local', eventDateTimeLocal)
        const eventDateTimeUTC = eventDateTimeLocal.utc().format();
        console.log('Event Date Time UTC', eventDateTimeUTC)
        // END

        const tempDir = path.join(__dirname, 'temp');
        // Ensure a temp directory for images exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });  // Create if doesnt exist
        }

        try {
            // Collect image URLs from Discord and upload to Cloudinary
            const thumbnailUrl = await uploadImageToCloudinary(thumbnail.url);
            // const imageUrls = await Promise.all(images.map(async (image) => {
            //     const imagePath = path.join(tempDir, image.name);
            //     try {
            //         // Download the image from the URL (using stream to avoid storing image in memory)
            //         const response = await axios({
            //             method: 'get',
            //             url: image.url,
            //             responseType: 'stream',
            //         });

            //         // Create the writable stream to save file locally
            //         const writer = fs.createWriteStream(imagePath);
            //         response.data.pipe(writer);

            //         // Wait for file to finish writing (with error handling)
            //         await new Promise((resolve, reject) => {
            //             writer.on('finish', resolve);
            //             writer.on('error', reject);
            //         });

            //         // Upload to Cloudinary
            //         const cloudinaryUrl = await uploadImageToCloudinary(imagePath);
            //         return cloudinaryUrl;
            //     } finally {
            //         // Ensure the file is deleted
            //         if (fs.existsSync(imagePath)) {
            //             fs.unlinkSync(imagePath);
            //         }
            //     }
            // }));

            const event = {
                guildId: interaction.guild.id,
                gameName: gameDetails.name,
                gameId: gameDetails.id,
                name: name,
                channelId: channel.id,
                summary: summary,
                description: description,
                eventDate: eventDateTimeUTC,
                thumbnailUrl: thumbnailUrl,
                // imageUrls: JSON.stringify(imageUrls),
            };

            console.log('Inserting event into DB....')
            const createdEventId = await eventService.createEvent(event);
            console.log('Created Event with the ID:', createdEventId);

            if (!createdEventId) {
                throw new Error('Failed to create event in the database');
            }

            const eventId = createdEventId;
            console.log('Event ID:', eventId);

            // FETCH THE DATE OF THE EVENT FROM THE DATABASE (NECESSARY AS THE EVENT DATE IS STORED IN UTC)
            const eventDateFetch = await db.query('SELECT event_date FROM events WHERE id = $1', [eventId]);
            const eventDate = eventDateFetch.rows[0].event_date;
            console.log('Event Date:', eventDate);
            const eventDateUNIX = moment(eventDate).unix();
            console.log('Event Date UNIX:', eventDateUNIX);
            // END

            const eventEmbed = new EmbedBuilder()
                .setTitle(`${gameDetails.name} • ${name}`)
                .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                .setDescription(summary)
                .setThumbnail(interaction.guild.iconURL())
                .addFields(
                    { name: 'Game:', value: gameDetails.name, inline: true },
                    { name: '🕒 Date and Time', value: `<t:${eventDateUNIX}:f>`, inline: false },
                    { name: '✅ Yes', value: '\u200B', inline: true },
                    { name: '❌ No', value: '\u200B', inline: true }
                )
                .setColor('#0099ff')
                .setFooter({ text: 'React with ✅ if you can attend, ❌ if you cannot attend.' });

            if (thumbnailUrl) {
                eventEmbed.setImage(thumbnailUrl);
            }

            const eventMessage = await channel.send({
                embeds: [eventEmbed],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`attend_${eventId}`)
                            .setLabel('✅')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`decline_${eventId}`)
                            .setLabel('❌')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId(`cancel_${eventId}`)
                            .setLabel('Cancel Event')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`finish_${eventId}`)
                            .setLabel('Finish Event')
                            .setStyle(ButtonStyle.Primary)
                    )
                ]
            });
            console.log('Event Message ID:', eventMessage.id);

            const updateEventQuery = `
                UPDATE events
                SET message_id = $1
                WHERE id = $2;
            `;
            await db.query(updateEventQuery, [eventMessage.id, eventId]);

            await interaction.editReply({ content: 'Event created successfully!', ephemeral: true });
        } catch (error) {
            console.error(error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Event Creation Failed')
                .setDescription('An unexpected error occurred while creating the event.')
                .addFields(
                    { name: 'Error Details', value: error.message || 'Unknown error', inline: false }
                )
                .setColor('#ff0000')
                .setFooter({ text: 'Please try again or contact support if the issue persists.' });

            await interaction.editReply({
                content: '',
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
    }
}