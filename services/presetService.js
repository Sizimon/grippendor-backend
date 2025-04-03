const db = require('../utils/db.js');

async function savePreset(guildId, presetName, gameRoleName, gameRoleId, partySize, rolesWithCounts) {
    try {
        const query = `
        INSERT INTO presets (guild_id, preset_name, game_role_name, game_role_id, party_size, data)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (guild_id, preset_name) DO UPDATE
        SET data = EXCLUDED.data,
            party_size = EXCLUDED.party_size,
            game_role_name = EXCLUDED.game_role_name,
            game_role_id = EXCLUDED.game_role_id,
            created_at = NOW();
    `;
        const values = [
            guildId,
            presetName,
            gameRoleName,
            gameRoleId,
            partySize,
            JSON.stringify({ roles: rolesWithCounts }),
        ];

        console.log('Executing query:', query);
        console.log('With values:', values);

        await db.query(query, values);
    } catch (error) {
        console.error('Error saving preset:', error);
        throw error;
    }
}

module.exports = {
    savePreset,
};