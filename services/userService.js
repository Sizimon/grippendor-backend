const db = require('../utils/db');

async function createOrUpdateUser(userId, username) {
    const query = `
        INSERT INTO users (user_id, username, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id)
        DO UPDATE SET username = EXCLUDED.username,
                      updated_at = CURRENT_TIMESTAMP;
    `;
    await db.query(query, [userId, username]);
}

async function createOrUpdateGuildUser(guildId, userId, username) {
    const query = `
        INSERT INTO guildusers (guild_id, user_id, username, total_count, updated_at)
        VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP)
        ON CONFLICT (guild_id, user_id)
        DO UPDATE SET username = EXCLUDED.username,
                      updated_t = CURRENT_TIMESTAMP;
    `;
    await db.query(query, [guildId, userId, username]);
}

async function removeUserFromGuild(guildId, userId) {
    await db.query('DELETE FROM guilduserroles WHERE guild_id = $1 AND user_id = $2', [guildId, userId]);
    await db.query('DELETE FROM guildusers WHERE guild_id = $1 AND user_id = $2', [guildId, userId]);
}

module.exports = {
    createOrUpdateUser,
    createOrUpdateGuildUser,
    removeUserFromGuild
};