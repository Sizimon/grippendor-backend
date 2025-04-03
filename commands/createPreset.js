const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/db.js');
const { askForRoleCounts } = require('../services/roleService.js')

const createPresetCommand = new SlashCommandBuilder()
    .setName('create-preset')
    .setDescription('Create a party preset. (Preset affects individual parties, adjust party size accordingly.)')
    .addIntegerOption(option => option.setName('party-size').setDescription('EXAMPLE: Party of 6, if you have 18 attending members, would create 3 parties.').setRequired(true))
    .addStringOption(option => option.setName('preset-name').setDescription('Input a name for your preset (NAME MUST BE DISTINCT | 40 CHARACTERS MAXIMUM).').setRequired(true))
    .addRoleOption(option =>
        option.setName('game-selection').setDescription('Select the role for the game you would like to create the preset.').setRequired(true))
for (i = 1; i < 10; i++) {
    createPresetCommand.addRoleOption(option =>
        option.setName(`preset_role_${i}`).setDescription(`Select role ${i} for the preset.`).setRequired(false));
}

module.exports = {
    data: createPresetCommand,
    async execute(interaction) {
        // Verify that the command user has the required role!
        const getAdminRoleQuery = `
                                SELECT admin_role
                                FROM guilds
                                WHERE id = $1
                            `;
        const adminSearchResult = await db.query(getAdminRoleQuery, [interaction.guild.id]);
        if (adminSearchResult.rows.length === 0) {
            return await interaction.reply({
                content: 'Could not find the admin role.', ephemeral: true
            });
        }
        const requiredRole = adminSearchResult.rows[0].admin_role;
        const hasPermission = interaction.member.roles.cache.has(requiredRole);

        if (!hasPermission) {
            return await interaction.reply({ content: 'You do not have permission to perform this action.', ephemeral: true });
        }

        const partySize = interaction.options.getInteger('party-size');
        const presetName = interaction.options.getString('preset-name');
        const gameSelection = interaction.options.getRole('game-selection');

        if (partySize < 2 || partySize > 10) {
            return interaction.reply({
                content: 'Party size must be between 2 and 10.',
                ephemeral: true,
            });
        }

        if (presetName.length > 40) {
            return interaction.reply({
                content: 'Preset name must be less than 20 characters.',
                ephemeral: true,
            });
        }

        // Collect selected roles
        const selectedRoles = [];
        for (let i = 1; i < 10; i++) {
            const role = interaction.options.getRole(`preset_role_${i}`);
            if (role) {
                selectedRoles.push(role);
            }
        }

        if (selectedRoles.length === 0) {
            return interaction.reply({
                content: 'You must select at least one role to create a preset.',
                ephemeral: true,
            });
        }

        await askForRoleCounts(interaction, partySize, selectedRoles, presetName, gameSelection);
    }
}
