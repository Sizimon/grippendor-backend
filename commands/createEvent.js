const { SlashCommandBuilder } = require('discord.js');
const { Client } = require('pg');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// PostgreSQL client
const dbClient = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

dbClient.connect();

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

        const eventDateTimeLocal = new Date(`${date}T${time}:00`);
        const eventDateTimeUTC = new Date(eventDateTimeLocal.toLocaleString('en-US', { timeZone: timezone }));

        await interaction.reply({ content: 'Creating event...', ephemeral: true });

        try {
            // Collect image URLs from Discord
            const thumbnailUrl = thumbnail.url;
            const imageUrls = images.map(image => image.url);

            console.log('Inserting event into DB....')
            const eventQuery = `
            INSERT INTO events (guild_id, type, name, channel_id, summary, description, event_date, thumbnail_url, image_urls)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (guild_id, name) DO UPDATE
            SET type = EXCLUDED.type,
                channel_id = EXCLUDED.channel_id,
                summary = EXCLUDED.summary,
                description = EXCLUDED.description,
                event_date = EXCLUDED.event_date,
                thumbnail_url = EXCLUDED.thumbnail_url,
                image_urls = EXCLUDED.image_urls,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id;
            `;
            const eventValues = [interaction.guild.id, type, name, channel.id, summary, description, eventDateTimeUTC, JSON.stringify(thumbnailUrl), JSON.stringify(imageUrls)];
            console.log('Event Query:', eventQuery);
            console.log('Event Values:', eventValues);

            const result = await dbClient.query(eventQuery, eventValues);
            console.log('Result:', result);

            if (result.rows.length === 0) {
                throw new Error('Failed to create event');
            }

            const eventId = result.rows[0].id;
            console.log('Event ID:', eventId);

            const eventEmbed = new EmbedBuilder()
                .setTitle(name)
                .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                .setDescription(summary)
                .setThumbnail('https://media.discordapp.net/attachments/1337393468326023241/1337395709665873960/DCC_Logo.png?ex=67c83fd0&is=67c6ee50&hm=6e168061cf4ffe112dd8301418ba008cad2696601913156b2ff3401d5abdba24&=&format=webp&quality=lossless&width=1752&height=1012')
                .addFields(
                    { name: 'Mission Type:', value: type, inline: true },
                    { name: '🕒 Date and Time', value: new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: timezone }).format(eventDateTimeLocal), inline: false },
                    { name: '✅ Yes', value: '\u200B', inline: true },
                    { name: '❌ No', value: '\u200B', inline: true }
                )
                .setColor('#0099ff')
                .setURL('https://szymonsamus.dev/guild-tracker/placeholder')
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
            await dbClient.query(updateEventQuery, [eventMessage.id, eventId]);

            await interaction.editReply({ content: 'Event created successfully!', ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'There was an error creating the event.', ephemeral: true });
        }
    }
}