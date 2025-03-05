const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('./logger');
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

async function initializeBot(client, config) {
    // Ensure bot is configured
    const guild = client.guilds.cache.get(config.id);
    if (!guild) {
        console.log('Guild not found', config.id);
        return;
    }

    const primaryRole = guild.roles.cache.get(config.primary_role);
    if (!primaryRole) {
        logger.error('Role not found');
        return;
    }

    const rolesQuery = 'SELECT role_name, role_id FROM roles WHERE guild_id = $1';
    const rolesResult = await dbClient.query(rolesQuery, [config.id]);
    const additionalRoles = rolesResult.rows;

    try {
        logger.log('Fetching all members...');
        await guild.members.fetch();
        logger.log('All members fetched');

        const members = guild.members.cache;
        logger.log(`Fetched Members: ${members.map(member => member.user ? member.user.username : 'undefined').join(', ')}`);

        const membersWithRole = members.filter(member => member.roles.cache.has(primaryRole.id));
        logger.log(`Members with role: ${membersWithRole.map(member => member.nickname || member.displayName).join(', ')}`);

        for (const [id, member] of membersWithRole) {
            const userId = id;
            const username = member.nickname || member.displayName;

            if (!userId || !username) {
                logger.error('Invalid user ID or username:', userId, username);
                continue;
            }

            logger.log(`Updating user: ${userId}, ${username}`);

            const userQuery = `
                INSERT INTO Users (user_id, username, updated_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id)
                DO UPDATE SET username = EXCLUDED.username,
                              updated_at = CURRENT_TIMESTAMP;
            `;
            const userValues = [userId, username];
            await dbClient.query(userQuery, userValues);

            const guildUserQuery = `
                INSERT INTO GuildUsers (guild_id, user_id, username, total_count, updated_at)
                VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP)
                ON CONFLICT (guild_id, user_id)
                DO UPDATE SET username = EXCLUDED.username,
                              updated_at = CURRENT_TIMESTAMP;
            `;
            const guildUserValues = [guild.id, userId, username];
            await dbClient.query(guildUserQuery, guildUserValues);

            const roleStatus = additionalRoles.map(role => ({
                roleName: role.role_name,
                hasRole: member.roles.cache.has(role.role_id)
            }));

            // Insert roles for each user
            for (const roles of roleStatus) {
                const additionalRoleQuery = `
                    INSERT INTO GuildUserRoles (guild_id, user_id, role_name, has_role)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (guild_id, user_id, role_name)
                    DO UPDATE SET has_role = EXCLUDED.has_role;
                `;
                const additialRoleValues = [guild.id, userId, roles.roleName, roles.hasRole];
                await dbClient.query(additionalRoleQuery, additialRoleValues);
            }
        }

        // Remove users from the database if they no longer have the primary role
        // const allUserIds = members.map(member => member.id);
        const userIdsWithRole = membersWithRole.map(member => member.id);
        const userIdsToRemove = await dbClient.query(`
            SELECT user_id FROM GuildUsers WHERE guild_id = $1 AND user_id NOT IN (${userIdsWithRole.map(id => `'${id}'`).join(', ')})
        `, [guild.id]);

        for (const { user_id } of userIdsToRemove.rows) {
            const deleteGuildUserQuery = `
            DELETE FROM GuildUsers
            WHERE guild_id = $1 AND user_id = $2;
        `;
            await dbClient.query(deleteGuildUserQuery, [guild.id, user_id]);
        }
    } catch (error) {
        logger.error('Error fetching members:', error);
    }
}

module.exports = {
    initializeBot,
};