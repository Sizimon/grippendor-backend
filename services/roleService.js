const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../utils/db.js')

async function saveRole(guildId, roleName, roleId) {
    try {
        // First check if role already exists
        const checkQuery = 'SELECT * FROM roles WHERE guild_id = $1 AND role_name = $2';
        const existing = await db.query(checkQuery, [guildId, roleName]);

        if (existing.rows.length > 0) {
            console.log(`Role ${roleName} already exists for guild ${guildId}`);
            return false; // Role already exists
        }

        // Insert new role
        const insertQuery = 'INSERT INTO roles (guild_id, role_name, role_id) VALUES ($1, $2, $3);';
        await db.query(insertQuery, [guildId, roleName, roleId]);
        console.log(`Successfully added role: ${roleName}`);
        return true;

    } catch (error) {
        console.error('Error in saveRole:', error);
        throw error;
    }
}

async function updateUserRole(guildId, userId, roleName, hasRole) {
    const query = `
        INSERT INTO guilduserroles (guild_id, user_id, role_name, has_role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (guild_id, user_id, role_name)
        DO UPDATE SET has_role = EXCLUDED.has_role
    `;
    await db.query(query, [guildId, userId, roleName, hasRole]);
}

async function getRolesByGuild(guildId) {
    const query = 'SELECT * FROM roles WHERE guild_id = $1';
    const values = [guildId];
    const result = await db.query(query, values);
    return result.rows;
}

async function askForRoleCounts(interaction, partySize, selectedRoles, presetName, gameSelection) {
    const modal = new ModalBuilder()
        .setCustomId('role_counts_modal')
        .setTitle(`Specify Roles: Maximum ${partySize} total.`);

    selectedRoles.forEach((role, index) => {
        const input = new TextInputBuilder()
            .setCustomId(`role_count_${index + 1}`)
            .setLabel(`How many ${role.name} per party?`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input)); // Read more about this.
    });

    interaction.client.presetData = {
        partySize,
        presetName,
        gameSelection,
        selectedRoles,
    }

    await interaction.showModal(modal);
}



module.exports = {
    saveRole,
    updateUserRole,
    getRolesByGuild,
    askForRoleCounts,
};