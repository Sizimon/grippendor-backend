const logger = require('./logger');
const db = require('./db.js')

async function initializeBot(client, config) {
    console.log('Starting initializeBot for guild:', config.id);

    // Get the guild from the client cache and check it exists
    const guild = client.guilds.cache.get(config.id);
    if (!guild) {
        console.log('Guild not found', config.id);
        return;
    }

    // Get the primary role from the guild config data and check it exists
    const primaryRole = guild.roles.cache.get(config.primary_role);
    if (!primaryRole) {
        logger.error('Role not found');
        return;
    }

    console.log('Fetching roles from database...')
    const rolesQuery = 'SELECT role_name, role_id FROM roles WHERE guild_id = $1';
    const rolesResult = await db.query(rolesQuery, [config.id]);
    const additionalRoles = rolesResult.rows;
    console.log('Roles fetched:', additionalRoles.length);

    try {
        logger.log('Fetching all members...');
        await guild.members.fetch();
        logger.log('All members fetched'); // THE LOGGING STOPS HERE THE ERROR IS IN THE FOLLOWING CODE RESOLVE SOON!

        const members = guild.members.cache;
        console.log('Members fetched:', members.size);

        const membersWithRole = members.filter(member => member.roles.cache.has(primaryRole.id));
        console.log('Members with primary role:', membersWithRole.size);

        console.log('Starting member processing...');
        for (const [id, member] of membersWithRole) {
            const userId = id;
            const username = member.nickname || member.displayName;

            if (!userId || !username) {
                logger.error('Invalid user ID or username:', userId, username);
                continue;
            }

            console.log(`Processing user: ${userId}, ${username}`);

            const userQuery = `
                INSERT INTO users (user_id, username, updated_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id)
                DO UPDATE SET username = EXCLUDED.username,
                              updated_at = CURRENT_TIMESTAMP;
            `;
            const userValues = [userId, username];
            await db.query(userQuery, userValues);
            console.log(`User table updated for: ${userId}`);

            const guildUserQuery = `
                INSERT INTO guildusers (guild_id, user_id, username, total_count, updated_at)
                VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP)
                ON CONFLICT (guild_id, user_id)
                DO UPDATE SET username = EXCLUDED.username,
                              updated_at = CURRENT_TIMESTAMP;
            `;
            const guildUserValues = [guild.id, userId, username];
            await db.query(guildUserQuery, guildUserValues);
            console.log(`Guild user table updated for: ${userId}`);

            const roleStatus = additionalRoles.map(role => ({
                roleName: role.role_name,
                hasRole: member.roles.cache.has(role.role_id)
            }));

            // Insert roles for each user
            console.log(`Processing ${roleStatus.length} roles for user: ${userId}`);
            for (const roles of roleStatus) {
                const additionalRoleQuery = `
                    INSERT INTO guilduserroles (guild_id, user_id, role_name, has_role)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (guild_id, user_id, role_name)
                    DO UPDATE SET has_role = EXCLUDED.has_role;
                `;
                const additialRoleValues = [guild.id, userId, roles.roleName, roles.hasRole];
                await db.query(additionalRoleQuery, additialRoleValues);
            }
            console.log(`Roles processed for user: ${userId}`);
        }

        console.log('Member processing complete. Starting cleanup...');

        // Remove users from the database if they no longer have the primary role
        const userIdsWithRole = membersWithRole.map(member => member.id);
        if (userIdsWithRole.length > 0) {
            const placeholders = userIdsWithRole.map((_, index) => `$${index + 2}`).join(', ');
            const userIdsToRemove = await db.query(`
            SELECT user_id FROM guildusers WHERE guild_id = $1 AND user_id NOT IN (${placeholders})
        `, [guild.id]);

            console.log(`Found ${userIdsToRemove.rows.length} users to remove`);

            for (const { user_id } of userIdsToRemove.rows) {
                const deleteGuildUserQuery = `
                    DELETE FROM guildusers
                    WHERE guild_id = $1 AND user_id = $2;
                `;
                await db.query(deleteGuildUserQuery, [guild.id, user_id]);
                console.log(`Removed user ${user_id} from GuildUsers`);
            }
        } else {
            const deleteAllQuery = `DELETE FROM guildusers WHERE guild_id = $1`;
            await db.query(deleteAllQuery, [guild.id]);
        }
        console.log('Guild initialized successfully:', guild.name);
    } catch (error) {
        console.error('Error fetching members:', error);
    }
}

module.exports = {
    initializeBot,
};