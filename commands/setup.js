const { SlashCommandBuilder } = require('discord.js');
const { initializeBot } = require('../utils/index.js');
const bcrypt = require('bcrypt');
const db = require('../utils/db.js')

const guildService = require('../services/guildService.js')
const roleService = require('../services/roleService.js')

const setupCommand = new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup the bot configuration')
    .addChannelOption(option => option.setName('channel').setDescription('The channel to send attendance messages. (Keep in mind this should be an admin channel)').setRequired(true))
    .addStringOption(option => option.setName('color').setDescription('The color palette (e.g., #FF0000)').setRequired(true))
    .addRoleOption(option => option.setName('primary_role').setDescription('The bot will track all members with the role you choose, (i.e default member role)').setRequired(true))
    .addStringOption(option => option.setName('icon').setDescription('The icon URL for your frontend dashboard').setRequired(true))
    .addStringOption(option => option.setName('title').setDescription('The title for the frontend dashboard').setRequired(true))
    .addStringOption(option => option.setName('password').setDescription('Password to access Dashboard. (IMPORTANT: DO NOT USE PRIVATE/PERSONAL PASSWORDS)').setRequired(true));

// Add additional role options
for (let i = 1; i <= 10; i++) {
    setupCommand.addRoleOption(option =>
        option.setName(`additional_role_${i}`)
            .setDescription(`Additional role ${i}`)
            .setRequired(false));
}

module.exports = {
    data: setupCommand,
    async execute(interaction) {
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({
                content: 'You do not have the permission to use this command.',
                ephemeral: true,
            });
        }

        const channel = interaction.options.getChannel('channel');
        const color = interaction.options.getString('color');
        const primaryRole = interaction.options.getRole('primary_role');
        const icon = interaction.options.getString('icon');
        const title = interaction.options.getString('title');
        const password = interaction.options.getString('password');

        const additionalRoles = [];
        for (let i = 1; i <= 10; i++) {
            const role = interaction.options.getRole(`additional_role_${i}`);
            if (role) {
                additionalRoles.push(role);
            }
        }

        // Hash the password using bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const config = {
            guild: interaction.guild.id,
            channel: channel.id,
            color,
            primaryRole: primaryRole.id,
            icon,
            title,
            password: hashedPassword
        };

        try {
            await guildService.saveGuildConfig(config);
            for (const role of additionalRoles) {
                await roleService.saveRole(interaction.guild.id, role.name, role.id);
            };
            const dashboardUrl = `http://szymonsamus.dev/bot-dashboard/`;
            await interaction.reply({
                content: `
                Configuration saved! \n
                You can now start using the Guild Manager bot. 
                The bot is only usable in the configured channel. (${channel}) \n
                Your dashboard is customised with the following settings:
                Title: ${title}
                Default Dashboard Color: ${color}
                Your Dashboard Icon: ${icon} \n
                Your main members will be tracked with the following role: ${primaryRole}
                Setup complete with ${additionalRoles.length} additional roles. \n
                ACCESS YOUR DASHBOARD HERE: ${dashboardUrl}
                `,
                ephemeral: true,
            });
            //TEST BLOCK
            const reFetchGuildDataQuery = 'SELECT * FROM guilds WHERE id = $1';
            const values = [config.guild]
            const result = await db.query(reFetchGuildDataQuery, values);
            //TEST BLOCK
            const client = require('../client');
            await initializeBot(client, result.rows[0]); //TEST BLOCK (CHANGE RESULT BACK TO CONFIG IF FAIL)
        } catch (error) {
            console.error('Error saving guild configuration:', error);
            await interaction.reply('An error occurred while saving the configuration. Please try again.');
        }
    }
};