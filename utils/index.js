const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('./logger');
const { setNames } = require('./state');
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

const IMAGES_DIR = path.join(__dirname, '..', 'images');

async function downloadImage(url, filepath) {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    return new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(filepath))
            .on('finish', () => resolve())
            .on('error', e => reject(e));
    });
}

function extractNames(text) {
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line && /^[A-Za-z][A-Za-z\s]{1,50}$/.test(line)); // More robust name detection
}

async function initializeBot(client, config) {
    // Ensure bot is configured
    if (!config.guild || !config.channel || !config.primaryRole) {
        logger.error('Bot not configured! Please run the /setup command.');
        return;
    }

    const guild = client.guilds.cache.get(config.guild);
    if (!guild) {
        logger.error('Guild not found');
        return;
    }

    const primaryRole = guild.roles.cache.get(config.primaryRole);
    if (!primaryRole) {
        logger.error('Role not found');
        return;
    }

    const additionalRoles = [
        { id: config.tankRole, name: 'Tank' },
        { id: config.healerRole, name: 'Healer' },
        { id: config.dpsRole, name: 'DPS' }
    ];

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

            const hasTankRole = member.roles.cache.has(config.tankRole);
            const hasHealerRole = member.roles.cache.has(config.healerRole);
            const hasDpsRole = member.roles.cache.has(config.dpsRole);

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
                INSERT INTO GuildUsers (guild, user_id, username, total_count, updated_at, tank, healer, dps)
                VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP, $4, $5, $6)
                ON CONFLICT (guild, user_id)
                DO UPDATE SET username = EXCLUDED.username,
                              updated_at = CURRENT_TIMESTAMP,
                              tank = EXCLUDED.tank,
                              healer = EXCLUDED.healer,
                              dps = EXCLUDED.dps;
            `;
            const guildUserValues = [guild.id, userId, username, hasTankRole, hasHealerRole, hasDpsRole];
            await dbClient.query(guildUserQuery, guildUserValues);
        }

        // Remove users from the database if they no longer have the primary role
        const allUserIds = members.map(member => member.id);
        const userIdsWithRole = membersWithRole.map(member => member.id);
        const userIdsToRemove = await dbClient.query(`
            SELECT user_id FROM GuildUsers WHERE guild = $1 AND user_id NOT IN (${userIdsWithRole.map(id => `'${id}'`).join(', ')})
        `, [guild.id]);

        for (const { user_id } of userIdsToRemove.rows) {
            const deleteGuildUserQuery = `
            DELETE FROM GuildUsers
            WHERE guild = $1 AND user_id = $2;
        `;
            await dbClient.query(deleteGuildUserQuery, [guild.id, user_id]);
        }
        // const allUserIds = members.map(member => member.id);
        // const userIdsWithRole = membersWithRole.map(member => member.id);
        // const userIdsToRemove = allUserIds.filter(id => !userIdsWithRole.includes(id));

        // for (const userId of userIdsToRemove) {
        //     const deleteGuildUserQuery = `
        //         DELETE FROM GuildUsers
        //         WHERE guild = $1 AND user_id = $2;
        //     `;
        //     await dbClient.query(deleteGuildUserQuery, [guild.id, userId]);
        // }

        const guildUsers = await dbClient.query(`
                SELECT user_id, username, username, tank, healer, dps FROM GuildUsers WHERE guild = $1
            `, [guild.id]);

        const names = guildUsers.rows.map(user => {
            const roles = [];
            if (user.tank) roles.push('Tank');
            if (user.healer) roles.push('Healer');
            if (user.dps) roles.push('DPS');
            return {
                name: user.username,
                roles: roles
            };
        });

        logger.log(names);
        logger.log(names.map(member => member.name).join(', '));
        logger.log(names.map(member => member.roles).join(', '));

        // const names = membersWithRole.map(member => {
        //     const memberRoles = additionalRoles.filter(role => member.roles.cache.has(role.id)).map(role => role.name);
        //     if (memberRoles.length > 0) {
        //         return {
        //             name: member.nickname || member.user.username,
        //             roles: memberRoles
        //         };
        //     } else {
        //         return {
        //             name: member.nickname || member.user.username,
        //             roles: []
        //         };
        //     }
        // });
        setNames(names);
        logger.log(`Members with role: ${names.map(member => member.name).join(', ')}`);
    } catch (error) {
        logger.error('Error fetching members:', error);
    }
}

function cleanupOldImages() {
    try {
        const files = fs.readdirSync(IMAGES_DIR);
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(IMAGES_DIR, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > 3600000) { // 1 hour
                fs.unlinkSync(filePath);
            }
        });
    } catch (error) {
        logger.error('Error cleaning up old images:', error);
    }
}

module.exports = {
    downloadImage,
    extractNames,
    initializeBot,
    IMAGES_DIR,
    cleanupOldImages,
};