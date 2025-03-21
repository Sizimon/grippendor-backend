const db = require('../utils/db');

async function saveGuildConfig(config) {
    const query = `
        INSERT INTO guilds (id, channel, color, primary_role, icon, title, password, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE
        SET channel = EXCLUDED.channel,
            color = EXCLUDED.color,
            primary_role = EXCLUDED.primary_role,
            icon = EXCLUDED.icon,
            title = EXCLUDED.title,
            password = EXCLUDED.password,
            updated_at = CURRENT_TIMESTAMP;
    `;
    const values = [
        config.guild,
        config.channel,
        config.color,
        config.primaryRole,
        config.icon,
        config.title,
        config.password,
    ];
    await db.query(query, values);
}

module.exports = { saveGuildConfig };