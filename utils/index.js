const db = require('./db.js')

// Get guild by ID
async function getGuild(client, guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
        throw new Error(`Guild not found: ${guildId}`);
    }
    return guild;
}

// Get the primary role for the guild
async function getPrimaryRole(guild, roleId) {
    const primaryRole = guild.roles.cache.get(roleId);
    if (!primaryRole) {
        throw new Error(`Primary role not found: ${roleId}`);
    }
    return primaryRole;
}

// Get all additional roles for the guild from the database
async function getAdditionalRoles(guildId) {
    console.log('Fetching roles from database...');
    const rolesQuery = 'SELECT role_name, role_id FROM roles WHERE guild_id = $1';
    const rolesResult = await db.query(rolesQuery, [guildId]);
    console.log('Roles fetched:', rolesResult.rows.length);
    return rolesResult.rows;
}

// Process all members with the primary role
async function processAllMembers(guild, membersWithRole, additionalRoles) {
    console.log('Starting member processing...');
    
    for (const [userId, member] of membersWithRole) {
        try {
            await processSingleMember(guild, userId, member, additionalRoles);
        } catch (error) {
            console.error(`Error processing member ${userId}:`, error);
            // Continue with next member instead of crashing
        }
    }
    
    console.log('Member processing complete');
}

// Process a single member: update user, guilduser, and roles (called within processAllMembers)
async function processSingleMember(guild, userId, member, additionalRoles) {
    const username = member.nickname || member.displayName;

    if (!userId || !username) {
        throw new Error(`Invalid user data: ID=${userId}, username=${username}`);
    }

    console.log(`Processing user: ${userId}, ${username}`);

    // Update users table
    await updateUserTable(userId, username);
    
    // Update guildusers table
    await updateGuildUserTable(guild.id, userId, username);
    
    // Update user roles
    await updateUserRoles(guild.id, userId, member, additionalRoles);
    
    console.log(`Successfully processed user: ${userId}`);
}

// Update users table for a single user (called within processSingleMember)
async function updateUserTable(userId, username) {
    const userQuery = `
        INSERT INTO users (user_id, username, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id)
        DO UPDATE SET username = EXCLUDED.username,
                      updated_at = CURRENT_TIMESTAMP;
    `;
    await db.query(userQuery, [userId, username]);
    console.log(`User table updated for: ${userId}`);
}

// Update guildusers table for a single user (called within processSingleMember)
async function updateGuildUserTable(guildId, userId, username) {
    const guildUserQuery = `
        INSERT INTO guildusers (guild_id, user_id, username, total_count, updated_at)
        VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP)
        ON CONFLICT (guild_id, user_id)
        DO UPDATE SET username = EXCLUDED.username,
                      updated_at = CURRENT_TIMESTAMP;
    `;
    await db.query(guildUserQuery, [guildId, userId, username]);
    console.log(`Guild user table updated for: ${userId}`);
}

// Update roles for a single user (called within processSingleMember)
async function updateUserRoles(guildId, userId, member, additionalRoles) {
    if (additionalRoles.length === 0) {
        console.log(`No additional roles to process for user: ${userId}`);
        return;
    }

    console.log(`Processing ${additionalRoles.length} roles for user: ${userId}`);
    
    for (const role of additionalRoles) {
        const hasRole = member.roles.cache.has(role.role_id);
        
        try {
            const roleQuery = `
                INSERT INTO guilduserroles (guild_id, user_id, role_name, has_role)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (guild_id, user_id, role_name)
                DO UPDATE SET has_role = EXCLUDED.has_role;
            `;
            await db.query(roleQuery, [guildId, userId, role.role_name, hasRole]);
            console.log(`  Role ${role.role_name}: ${hasRole} for user ${userId}`);
        } catch (error) {
            console.error(`  Error processing role ${role.role_name} for user ${userId}:`, error);
            // Continue with next role
        }
    }
}

// Cleanup users who no longer have the primary role (called after processing all members)
async function cleanupRemovedMembers(guildId, activeUserIds) {
    console.log('Starting cleanup...');
    
    try {
        if (activeUserIds.length === 0) {
            // No active users, remove all
            await db.query('DELETE FROM guilduserroles WHERE guild_id = $1', [guildId]);
            await db.query('DELETE FROM guildusers WHERE guild_id = $1', [guildId]);
            console.log('Removed all users from guild');
            return;
        }

        // Find users to remove
        const placeholders = activeUserIds.map((_, index) => `$${index + 2}`).join(', ');
        const usersToRemove = await db.query(`
            SELECT user_id FROM guildusers 
            WHERE guild_id = $1 AND user_id NOT IN (${placeholders})
        `, [guildId, ...activeUserIds]);

        console.log(`Found ${usersToRemove.rows.length} users to remove`);

        // Remove inactive users
        for (const { user_id } of usersToRemove.rows) {
            await db.query('DELETE FROM guilduserroles WHERE guild_id = $1 AND user_id = $2', [guildId, user_id]);
            await db.query('DELETE FROM guildusers WHERE guild_id = $1 AND user_id = $2', [guildId, user_id]);
            console.log(`Removed inactive user: ${user_id}`);
        }
        
        console.log('Cleanup complete');
    } catch (error) {
        console.error('Error during cleanup:', error);
        throw error;
    }
}


// Sync new roles for guild users (called after adding new roles in addRoles.js)
async function syncNewRolesForGuild(client, guildId, newRoleNames = null) {
    console.log('Syncing roles for guild:', guildId);
    
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            throw new Error(`Guild not found: ${guildId}`);
        }

        // Get roles to sync (either specific new roles or all roles)
        let rolesToSync;
        if (newRoleNames && newRoleNames.length > 0) {
            const query = 'SELECT role_name, role_id FROM roles WHERE guild_id = $1 AND role_name = ANY($2)';
            const result = await db.query(query, [guildId, newRoleNames]);
            rolesToSync = result.rows;
        } else {
            const query = 'SELECT role_name, role_id FROM roles WHERE guild_id = $1';
            const result = await db.query(query, [guildId]);
            rolesToSync = result.rows;
        }

        if (rolesToSync.length === 0) {
            console.log('No roles to sync');
            return;
        }

        // Get all users in the guild from database
        const usersQuery = 'SELECT user_id FROM guildusers WHERE guild_id = $1';
        const usersResult = await db.query(usersQuery, [guildId]);
        
        console.log(`Syncing ${rolesToSync.length} roles for ${usersResult.rows.length} users`);

        for (const userRow of usersResult.rows) {
            const userId = userRow.user_id;
            const member = guild.members.cache.get(userId);
            
            if (!member) {
                console.log(`Member ${userId} not found in guild cache, skipping`);
                continue;
            }

            // Update only the specified roles for this user
            for (const role of rolesToSync) {
                const hasRole = member.roles.cache.has(role.role_id);
                
                try {
                    const roleQuery = `
                        INSERT INTO guilduserroles (guild_id, user_id, role_name, has_role)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (guild_id, user_id, role_name)
                        DO UPDATE SET has_role = EXCLUDED.has_role;
                    `;
                    await db.query(roleQuery, [guildId, userId, role.role_name, hasRole]);
                } catch (error) {
                    console.error(`Error syncing role ${role.role_name} for user ${userId}:`, error);
                }
            }
        }

        console.log('Role sync complete');
    } catch (error) {
        console.error('Error syncing roles:', error);
        throw error;
    }
}


// Main initialization function
async function initializeBot(client, config) {
    console.log('Starting initializeBot for guild:', config.id);

    try {
        const guild = await getGuild(client, config.id);
        const primaryRole = await getPrimaryRole(guild, config.primary_role);
        const additionalRoles = await getAdditionalRoles(config.id);

        const members = await guild.members.fetch();
        console.log('All members fetched');

        const membersWithRole = members.filter(member => member.roles.cache.has(primaryRole.id));
        console.log('Members with primary role:', membersWithRole.size);

        await processAllMembers(guild, membersWithRole, additionalRoles);
        await cleanupRemovedMembers(guild.id, Array.from(membersWithRole.keys()));

        console.log('Guild initialized successfully:', guild.name);
    } catch (error) {
        console.error('Error initializing guild:', config.id, error);
        throw error;
    }
}


// Start periodic role sync every 15 minutes
function startPeriodicRoleSync(client) {
    console.log('Starting periodic role sync...');
    
    // Sync every 15 minutes
    setInterval(async () => {
        try {
            console.log('Running scheduled role sync...');
            
            // Get all tracked guilds
            const guildsResult = await db.query('SELECT id FROM guilds');
            
            for (const { id: guildId } of guildsResult.rows) {
                try {
                    console.log(`Syncing all roles for guild: ${guildId}`);
                    await syncNewRolesForGuild(client, guildId);
                    
                    // Small delay between guilds to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (guildError) {
                    console.error(`Error syncing guild ${guildId}:`, guildError);
                    // Continue with next guild
                }
            }
            
            console.log('Scheduled role sync complete');
            
        } catch (error) {
            console.error('Error in periodic role sync:', error);
        }
    }, 15 * 60 * 1000); // 15 minutes
}

// Sync roles for a single user (called in guildMemberUpdate event)
async function syncSingleUserRoles(client, guildId, userId) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        const member = guild.members.cache.get(userId);
        if (!member) return;

        // Get tracked roles for this guild
        const rolesQuery = 'SELECT role_name, role_id FROM roles WHERE guild_id = $1';
        const rolesResult = await db.query(rolesQuery, [guildId]);
        const trackedRoles = rolesResult.rows;

        if (trackedRoles.length === 0) return;

        // Update each tracked role for this user
        for (const role of trackedRoles) {
            const hasRole = member.roles.cache.has(role.role_id);
            
            const roleQuery = `
                INSERT INTO guilduserroles (guild_id, user_id, role_name, has_role)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (guild_id, user_id, role_name)
                DO UPDATE SET has_role = EXCLUDED.has_role
            `;
            await db.query(roleQuery, [guildId, userId, role.role_name, hasRole]);
        }

        console.log(`Single user role sync complete for user ${userId}`);
        
    } catch (error) {
        console.error(`Error syncing roles for user ${userId}:`, error);
    }
}

module.exports = {
    initializeBot,
    syncNewRolesForGuild,
    startPeriodicRoleSync,
    syncSingleUserRoles
};