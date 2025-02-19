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
            option.setName('name')
                .setDescription('The name of the event')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send event notifications')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('The description of the event')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('date')
                .setDescription('The date of the event (YYYY-MM-DD)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('time')
                .setDescription('The time of the event (HH:MM in 24-hour format)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('timezone')
                .setDescription('Your timezone')
                .setRequired(true)
                .addChoices(timeZones.map(tz => ({ name: tz.label, value: tz.value })))),
    async execute(interaction) {
        const name = interaction.options.getString('name');
        const channel = interaction.options.getChannel('channel');
        const description = interaction.options.getString('description');
        const date = interaction.options.getString('date');
        const time = interaction.options.getString('time');
        const timezone = interaction.options.getString('timezone');

        const eventDateTimeLocal = new Date(`${date}T${time}:00`);
        const eventDateTimeUTC = new Date(eventDateTimeLocal.toLocaleString('en-US', { timeZone: timezone }));

        await interaction.reply({ content: 'Creating event...', ephemeral: true });

        try {
            console.log('Inserting event into DB....')
            const eventQuery = `
            INSERT INTO events (guild_id, name, channel_id, description, event_date)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (guild_id, name) DO UPDATE
            SET channel_id = EXCLUDED.channel_id,
                description = EXCLUDED.description,
                event_date = EXCLUDED.event_date,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id;
            `;
            const eventValues = [interaction.guild.id, name, channel.id, description, eventDateTimeUTC];
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
                .setDescription(description)
                .addFields(
                    { name: '🕒 Date and Time', value: new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: timezone }).format(eventDateTimeLocal), inline: false },
                    { name: '✅ Yes', value: '\u200B', inline: true },
                    { name: '❌ No', value: '\u200B', inline: true }
                )
                .setColor('#0099ff')
                .setFooter({ text:'React with ✅ if you can attend, ❌ if you cannot attend.' });
            
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
                                .setStyle(ButtonStyle.Danger)
                        )]
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