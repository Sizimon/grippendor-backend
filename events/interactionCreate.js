const setupCommand = require('../commands/setup');
const attendanceCommand = require('../commands/attendance');
const createEventCommand = require('../commands/createEvent');
const { EmbedBuilder } = require('discord.js');
const  { Client } = require('pg');

const dbClient = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

dbClient.connect();


module.exports = async function interactionCreate(interaction) {
    if (interaction.isButton()) {
        const member = interaction.member;
        const nickname = member.nickname
        const [action, eventId] = interaction.customId.split('_');
        if (action !== 'attend' && action !== 'decline') return;

        const userId = interaction.user.id;
        const username = nickname || interaction.user.username;
        const response = action === 'attend' ? 'yes' : 'no';

        // Store the user's response in the database
        const eventAttendanceQuery = `
            INSERT INTO event_attendance (event_id, user_id, username, response)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (event_id, user_id) DO UPDATE SET response = EXCLUDED.response;
        `;
        await dbClient.query(eventAttendanceQuery, [eventId, userId, username, response]);

        // Fetch the updated attendance lists
        const eventAttendanceResult = await dbClient.query(`
            SELECT username, response FROM event_attendance WHERE event_id = $1;
        `, [eventId]);

        const yesAttendees = eventAttendanceResult.rows.filter(row => row.response === 'yes').map(row => row.username).join('\n');
        const noAttendees = eventAttendanceResult.rows.filter(row => row.response === 'no').map(row => row.username).join('\n');

        // Fetch the event message
        const eventMessage = await interaction.channel.messages.fetch(interaction.message.id);

        // Update the event message
        const eventEmbed = EmbedBuilder.from(eventMessage.embeds[0]);
        const fields = eventEmbed.data.fields || [];
        const dateTimeField = fields.find(field => field.name === '🕒 Date and Time') || { name: '🕒 Date and Time', value: '', inline: false };
        eventEmbed.setFields([
            {
                name: dateTimeField.name,
                value: dateTimeField.value,
                inline: dateTimeField.inline
            },
            {
                name: '✅ Yes',
                value: yesAttendees || '\u200B',
                inline: true
            },
            {
                name: '❌ No',
                value: noAttendees || '\u200B',
                inline: true
            }
        ]);
        await eventMessage.edit({ embeds: [eventEmbed] });

        // Send an ephemeral reply to the user
        await interaction.reply({ content: `You have indicated your attendance as ${response === 'yes' ? 'Yes' : 'No'}.`, ephemeral: true });

    } else if (interaction.isCommand()) {
        const { commandName } = interaction;

        if (commandName === 'setup') {
            await setupCommand.execute(interaction);
        } else if (commandName === 'attendance') {
            await attendanceCommand.execute(interaction);
        } else if (commandName === 'create-event') {
            await createEventCommand.execute(interaction);
        }
    }
};

// module.exports = async function interactionCreate(interaction) {
//     if (!interaction.isCommand()) return;

//     const { commandName } = interaction;

//     if (commandName === 'setup') {
//         await setupCommand.execute(interaction);
//     } else if (commandName === 'attendance') {
//         await attendanceCommand.execute(interaction);
//     } else if (commandName === 'create-event') {
//         await createEventCommand.execute(interaction);
//     }
// };