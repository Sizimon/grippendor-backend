const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
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

async function askForRoleCounts(interaction, partySize, selectedRoles, presetName, gameSelection) {
    const modal = new ModalBuilder()
        .setCustomId('role_counts_modal')
        .setTitle(`Specify Roles: Maximum ${partySize} total.`);
    
    selectedRoles.forEach((role, index) => {
        const input = new TextInputBuilder()
            .setCustomId(`role_count_${index}`)
            .setLabel(`How many ${role.name} per party?`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
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
    getRolesByGuild,
    askForRoleCounts,
};