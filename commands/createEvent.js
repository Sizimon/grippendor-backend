const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const moment = require('moment-timezone');
const { uploadImageToCloudinary } = require('../utils/cloudinary.js')
const db = require('../utils/db.js')
const eventService = require('../services/eventService.js')

const missionTypes = [
    { label: "Infiltration", value: "Infiltration" },
    { label: "Extraction", value: "Extraction" },
    { label: "Escort", value: "Escort" },
    { label: "Reconnaissance", value: "Reconnaissance" },
    { label: "Sabotage", value: "Sabotage" },
    { label: "Search & Rescue", value: "Search & Rescue" },
    { label: "Defence", value: "Defence" },
    { label: "Capture & Hold", value: "Capture & Hold" },
    { label: "Elimination", value: "Elimination" },
    { label: "Supply Run", value: "Supply Run" },
    { label: "HVT Securement", value: "HVT Securement" },
    { label: "Survival", value: "Survival" },
    { label: "Counter Insurgency", value: "Counter Insurgency" },
    { label: "Other", value: "Other" }
];

const timeZones = [
    { label: 'UTC-12:00', value: 'Etc/GMT+12' },
    { label: 'UTC-11:00', value: 'Etc/GMT+11' },
    { label: 'UTC-10:00', value: 'Etc/GMT+10' },
    { label: 'UTC-09:00', value: 'Etc/GMT+9' },
    { label: 'UTC-08:00', value: 'Etc/GMT+8' },
    { label: 'UTC-07:00', value: 'Etc/GMT+7' },
    { label: 'UTC-06:00', value: 'Etc/GMT+6' },
    { label: 'UTC-05:00', value: 'Etc/GMT+5' },
    { label: 'UTC-04:00', value: 'Etc/GMT+4' },
    { label: 'UTC-03:00', value: 'Etc/GMT+3' },
    { label: 'UTC-02:00', value: 'Etc/GMT+2' },
    { label: 'UTC-01:00', value: 'Etc/GMT+1' },
    { label: 'UTC+00:00', value: 'Etc/GMT' },
    { label: 'UTC+01:00', value: 'Etc/GMT-1' },
    { label: 'UTC+02:00', value: 'Etc/GMT-2' },
    { label: 'UTC+03:00', value: 'Etc/GMT-3' },
    { label: 'UTC+04:00', value: 'Etc/GMT-4' },
    { label: 'UTC+05:00', value: 'Etc/GMT-5' },
    { label: 'UTC+06:00', value: 'Etc/GMT-6' },
    { label: 'UTC+07:00', value: 'Etc/GMT-7' },
    { label: 'UTC+08:00', value: 'Etc/GMT-8' },
    { label: 'UTC+09:00', value: 'Etc/GMT-9' },
    { label: 'UTC+10:00', value: 'Etc/GMT-10' },
    { label: 'UTC+11:00', value: 'Etc/GMT-11' },
    { label: 'UTC+12:00', value: 'Etc/GMT-12' },
];


module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-event')
        .setDescription('Create an event')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Select Mission Type.')
                .setRequired(true)
                .addChoices(missionTypes.map(mt => ({ name: mt.label, value: mt.value }))))
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
                .setDescription('A brief summary of the Event/Mission. (250 characters max)')
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
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('briefing_url')
                .setDescription('Attach a Thumbnail Image URL for the Event/Mission.')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('briefing_url_2')
                .setDescription('Attach a Thumbnail Image URL for the Event/Mission.')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('briefing_url_3')
                .setDescription('Attach a Thumbnail Image URL for the Event/Mission.')
                .setRequired(false)),
    async execute(interaction) {
        const type = interaction.options.getString('type');
        const name = interaction.options.getString('name');
        const channel = interaction.options.getChannel('channel');
        const summary = interaction.options.getString('summary');
        const description = interaction.options.getString('description');
        const date = interaction.options.getString('date');
        const time = interaction.options.getString('time');
        const timezone = interaction.options.getString('timezone');
        const thumbnail = interaction.options.getAttachment('thumbnail_url');
        const images = [
            interaction.options.getAttachment('briefing_url'),
            interaction.options.getAttachment('briefing_url_2'),
            interaction.options.getAttachment('briefing_url_3')
        ].filter(image => image !== null);

        // Validate summary length
        if (summary.length > 250) {
            await interaction.reply({ content: 'The summary must be 250 characters or less.', ephemeral: true });
            return;
        }


        // CONVERTS THE INPUT DATE / TIME WITH MOMENT, THEN CONVERTS THAT INTO UTC FOR THE DB
        const eventDateTimeLocal = moment.tz(`${date} ${time}`, timezone);
        const eventDateTimeUTC = eventDateTimeLocal.utc().format();
        // END

        await interaction.reply({ content: 'Creating event...', ephemeral: true });

        const tempDir = path.join(__dirname, 'temp');

        // Ensure a temp directory for images exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });  // Create if doesnt exist
        }

        try {
            // Collect image URLs from Discord and upload to Cloudinary
            const thumbnailUrl = await uploadImageToCloudinary(thumbnail.url);
            const imageUrls = await Promise.all(images.map(async (image) => {
                const imagePath = path.join(tempDir, image.name);
                try {
                    // Download the image from the URL (using stream to avoid storing image in memory)
                    const response = await axios({
                        method: 'get',
                        url: image.url,
                        responseType: 'stream',
                    });

                    // Create the writable stream to save file locally
                    const writer = fs.createWriteStream(imagePath);
                    response.data.pipe(writer);

                    // Wait for file to finish writing (with error handling)
                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });

                    // Upload to Cloudinary
                    const cloudinaryUrl = await uploadImageToCloudinary(imagePath);
                    return cloudinaryUrl;
                } finally {
                    // Ensure the file is deleted
                    if (fs.existsSync(imagePath)) {
                        fs.unlinkSync(imagePath); 
                    }
                }
            }));

            const event = {
                guildId: interaction.guild.id,
                type: type,
                name: name,
                channelId: channel.id,
                summary: summary,
                description: description,
                eventDate: eventDateTimeUTC,
                thumbnailUrl: thumbnailUrl,
                imageUrls: JSON.stringify(imageUrls)  // POSSIBLE ERROR HERE
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
                .setTitle(name)
                .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                .setDescription(summary)
                .setThumbnail('https://media.discordapp.net/attachments/1337393468326023241/1337395709665873960/DCC_Logo.png?ex=67c83fd0&is=67c6ee50&hm=6e168061cf4ffe112dd8301418ba008cad2696601913156b2ff3401d5abdba24&=&format=webp&quality=lossless&width=1752&height=1012')
                .addFields(
                    { name: 'Mission Type:', value: type, inline: true },
                    { name: '🕒 Date and Time', value: `<t:${eventDateUNIX}:f> (This Date & Time is displayed in your local time!)`, inline: false },
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
            await interaction.editReply({ content: 'There was an error creating the event.', ephemeral: true });
        }
    }
}