const { Client } = require('pg');
const logger = require('./logger');
const { EmbedBuilder } = require('discord.js');

const dbClient = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

dbClient.connect();

async function loadConfig(guildId) {
    if (!guildId || isNaN(guildId)) {
        logger.error('Invalid guild ID:', guildId);
        return null;
    }
    try {
        const query = 'SELECT * FROM guilds WHERE id = $1';
        const values = [guildId];
        const result = await dbClient.query(query, values);
        if (result.rows.length > 0) {
            return result.rows[0];
        } else {
            logger.error('No configuration found for guild ID:', guildId);
            return null;
        }
    } catch (error) {
        logger.error('Error loading config:', error);
        return null;
    }
}

async function loadAttendanceLog(guildId) {
    if (!guildId || isNaN(guildId)) {
        logger.error('Invalid guild ID:', guildId);
        return null;
    }

    const query = 'SELECT * FROM Attendance WHERE guild_id = $1';
    const values = [guildId];

    try {
        const res = await dbClient.query(query, values);
        if (res.rows.length > 0) {
            return res.rows;
        } else {
            logger.error('Attendance log not found for guild:', guildId);
            return null;
        }
    } catch (error) {
        logger.error('Error loading attendance log from database:', error);
        return null;
    }
}

async function loadGuildUsers(guildId) {
    if (!guildId || isNaN(guildId)) {
        logger.error('Invalid guild ID:', guildId);
        return null;
    }

    const query = 'SELECT * FROM GuildUsers WHERE guild_id = $1';
    const values = [guildId];

    try {
        const res = await dbClient.query(query, values);
        if (res.rows.length > 0) {
            return res.rows;
        } else {
            logger.error('Guild members not found for guild:', guildId);
            return null;
        }
    } catch (error) {
        logger.error('Error loading names from database:', error);
        return null;
    }
}

async function loadGuildUserRoles(guildId) {
    if (!guildId || isNaN(guildId)) {
        logger.error('Invalid guild ID:', guildId);
        return null;
    }

    const query = 'SELECT * FROM GuildUserRoles WHERE guild_id = $1';
    const values = [guildId];

    try {
        const res = await dbClient.query(query, values);
        if (res.rows.length > 0) {
            return res.rows;
        } else {
            logger.error('Guild user roles not found for guild:', guildId);
            return null;
        }
    } catch (error) {
        logger.error('Error loading user roles from database:', error);
        return null;
    }
}

async function checkUpcomingEvents(client) {
    const query = `
        SELECT DISTINCT e.id AS event_id, e.name, e.event_date, e.guild_id, u.user_id, u.username
        FROM events e
        JOIN event_attendance ea ON e.id = ea.event_id
        JOIN guildusers u ON ea.user_id = u.user_id
        WHERE e.guild_id = u.guild_id
        AND e.event_date BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
        AND ea.response = 'yes'
        AND ea.reminder_sent = FALSE;
    `;
    try {
        const res = await dbClient.query(query);
        if (res.rows.length > 0) {
            for (const row of res.rows) {
                await sendReminder(client, row.user_id, row.username, row.name, row.event_date);
                // Mark the reminder as sent.
                const updateQuery = `
                    UPDATE event_attendance
                    SET reminder_sent=TRUE
                    WHERE event_id=$1 AND user_id=$2;
                `;
                await dbClient.query(updateQuery, [row.event_id, row.user_id]);
            }
        }
    } catch (error) {
        console.error('Error checking upcoming events:', error);
    }
}

async function sendReminder(client, userId, username, eventName, eventDate) {
    try {
        const user = await client.users.fetch(userId);
        const reminderEmber = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Reminder for Event: ${eventName}`)
            .setDescription(
                `Hey ${username},\n 
                Don't forget about the event "${eventName}"!\n
                This event is taking place at ${eventDate}!`)
            .setFooter({ text:'GripendorBot', iconURL: client.user.avatarURL()});
        // const reminderMessage = `Hey ${username}, don't forget about the event "${eventName}" happening at ${eventDate}!`;
        await user.send({ embeds: [reminderEmber] });
        console.log('Reminder sent to:', username);
    } catch (error) {
        console.error('Error sending reminder:', error);
    }
}

// async function loadEventData(guildId) {

// }

module.exports = {
    loadConfig,
    loadAttendanceLog,
    loadGuildUsers,
    loadGuildUserRoles,
    checkUpcomingEvents,
};