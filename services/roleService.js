const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../utils/db.js')

async function saveRole(guildId, roleName, roleId) {
    const query = `
        INSERT INTO roles (guild_id, role_name, role_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id, role_name) DO NOTHING
        RETURNING *;
    `;
    const values = [guildId, roleName, roleId];
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
        console.log(`Role "${roleName}" already exists in guild ${guildId}.`);
        return false;
    } else {
        console.log(`Role "${roleName}" added to guild ${guildId}.`);
        return true;
    }
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
    getRolesByGuild,
    askForRoleCounts,
};