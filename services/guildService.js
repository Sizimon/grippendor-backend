const db = require('../utils/db');

async function saveGuildConfig(config) {
    const query = `
        INSERT INTO guilds (id, channel, primary_role, admin_role, title, password, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE
        SET channel = EXCLUDED.channel,
            primary_role = EXCLUDED.primary_role,
            admin_role = EXCLUDED.admin_role,
            title = EXCLUDED.title,
            password = EXCLUDED.password,
            updated_at = CURRENT_TIMESTAMP;
    `;
    const values = [
        config.guild,
        config.channel,
        config.primaryRole,
        config.adminRole,
        config.title,
        config.password,
    ];
    await db.query(query, values);
}

module.exports = { saveGuildConfig };