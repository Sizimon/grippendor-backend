const logger = require('./logger');
const { EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');
const db = require('./db.js')

async function loadConfig(guildId) {
    if (!guildId || isNaN(guildId)) {
        logger.error('Invalid guild ID:', guildId);
        return null;
    }
    try {
        const query = 'SELECT * FROM guilds WHERE id = $1';
        const values = [guildId];
        const result = await db.query(query, values);
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

async function loadGuildUsersWithRoles(guildId) {
    if (!guildId || isNaN(guildId)) {
        logger.error('Invalid guild ID:', guildId);
        return null;
    }

    const query = `
        SELECT 
            u.user_id, 
            u.username,
            u.total_count,
            json_agg(
                CASE 
                    WHEN gur.has_role = TRUE THEN 
                        json_build_object(
                            'role_name', r.role_name,
                            'role_id', r.role_id,
                            'role_color', r.role_color
                        )
                    ELSE NULL 
                END
            ) FILTER (WHERE gur.has_role = TRUE) as roles
        FROM guildusers u
        LEFT JOIN guilduserroles gur ON u.user_id = gur.user_id AND u.guild_id = gur.guild_id
        LEFT JOIN roles r ON gur.role_name = r.role_name AND gur.guild_id = r.guild_id
        WHERE u.guild_id = $1
        GROUP BY u.user_id, u.username, u.total_count
        ORDER BY u.username;
    `;
    
    try {
        const result = await db.query(query, [guildId]);
        if (result.rows.length > 0) {
            return result.rows.map(row => ({
                user_id: row.user_id,
                username: row.username,
                total_count: row.total_count,
                roles: row.roles || []
            }));
        } else {
            logger.error('Guild members not found for guild:', guildId);
            return [];
        }
    } catch (error) {
        logger.error('Error loading guild users with roles:', error);
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
        const result = await db.query(query);
        if (result.rows.length > 0) {
            for (const row of result.rows) {
                console.log(`Sending reminder to ${row.username} for event ${row.name}`);
                await sendReminder(client, row.user_id, row.username, row.name, row.event_date);
                // Mark the reminder as sent.
                const updateQuery = `
                    UPDATE event_attendance
                    SET reminder_sent=TRUE
                    WHERE event_id=$1 AND user_id=$2;
                `;
                await db.query(updateQuery, [row.event_id, row.user_id]);
                console.log(`Updated reminder status for user ${row.username} and event ${row.name}`);
            }
        } else {
            return
        }
    } catch (error) {
        console.error('Error checking upcoming events:', error);
    }
}

async function sendReminder(client, userId, username, eventName, eventDate) {
    try {
        const user = await client.users.fetch(userId);
        const eventDateUNIX = moment(eventDate).unix();
        const reminderEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Event Reminder!')
            .setDescription(
                `Hey ${username},\n 
                Don't forget about the event "${eventName}"!\n
                This event is taking place at <t:${eventDateUNIX}:f>.\n
                See you there!`
            )
            .setFooter({ text:'GripendorBot', iconURL: client.user.avatarURL()});
        await user.send({ embeds: [reminderEmbed] });
        console.log('Reminder sent to:', username);
    } catch (error) {
        console.error('Error sending reminder:', error);
    }
}

async function loadEventData(guildId) {
    const query = 'SELECT * FROM events WHERE guild_id = $1';
    const values = [guildId];

    try {
        const result = await db.query(query, values);
        if (result.rows.length > 0) {
            console.log('Query Result:', result.rows);
            return result.rows;
        } else {
            logger.error('No events found for guild:', guildId);
            return null;
        }
    } catch (error) {
        logger.error('Error loading events from database:', error);
        return null;
    }
}

async function loadEventUserData(eventId, guildId) {
    const query = `
        SELECT u.user_id, u.username, array_agg(gur.role_name) AS roles
        FROM event_attendance ea
        JOIN guildusers u ON ea.user_id = u.user_id
        LEFT JOIN guilduserroles gur ON u.user_id = gur.user_id AND u.guild_id = gur.guild_id
        WHERE ea.event_id = $1
        AND u.guild_id = $2
        AND ea.response = 'yes'
        AND gur.has_role = TRUE
        GROUP BY u.user_id, u.username;
    `;
    try {
        const result = await db.query(query, [eventId, guildId]);
        const eventData = result.rows.map(row => ({
            user_id: row.user_id,
            name: row.username,
            roles: row.roles,
        }));
        return eventData
    } catch (error) {
        console.error('Error loading event user data:', error);
        return [];
    }
}

module.exports = {
    loadConfig,
    loadGuildUsersWithRoles,
    checkUpcomingEvents,
    loadEventData,
    loadEventUserData,
};