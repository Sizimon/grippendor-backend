const db = require('../utils/db.js')

async function saveRole(guildId, roleName, roleId) {
    const query = `
        INSERT INTO roles (guild_id, role_name, role_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id, role_id) DO NOTHING;
    `;
    const values = [guildId, roleName, roleId];
    await db.query(query, values);
}

async function getRolesByGuild(guildId) {
    const query = 'SELECT * FROM roles WHERE guild_id = $1';
    const values = [guildId];
    const result = await db.query(query, values);
    return result.rows;
}

module.exports = {
    saveRole,
    getRolesByGuild,
};