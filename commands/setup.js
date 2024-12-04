const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { initializeBot } = require('../utils/index.js'); // Import initializeBot
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup the bot configuration')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send attendance messages. (Keep in mind this should be an admin channel)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('The color palette (e.g., #FF0000)')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('primary_role')
                .setDescription('The bot will track all members with the role you choose, (i.e default member role)')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('tank_role')
                .setDescription('This will track users with your given "Tank" role for the party maker.')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('healer_role')
                .setDescription('This will track users with your given "Healer" role for the party maker.')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('dps_role')
                .setDescription('This will track users with your given "DPS" role for the party maker.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('icon')
                .setDescription('The icon URL for your frontend dashboard')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('The title for the frontend dashboard')
                .setRequired(true)),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const color = interaction.options.getString('color');
        const primaryRole = interaction.options.getRole('primary_role');
        const tankRole = interaction.options.getRole('tank_role');
        const healerRole = interaction.options.getRole('healer_role');
        const dpsRole = interaction.options.getRole('dps_role');
        const icon = interaction.options.getString('icon');
        const title = interaction.options.getString('title');

        const config = {
            guild: interaction.guild.id,
            channel: channel.id,
            color,
            primaryRole: primaryRole.id,
            tankRole: tankRole.id,
            healerRole: healerRole.id,
            dpsRole: dpsRole.id,
            icon,
            title,
        };

        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

        await interaction.reply(`
            Configuration saved! \n 
            You can now start using the Guild Manager bot. \n
            The bot is only usable in the configured channel. (${channel}) \n
            Your dashboard is customised with the following settings: \n
            Title: ${title} \n
            Color: ${color} \n
            Icon: ${icon} \n
            \n
            Your main members will be tracked with the following role: ${primaryRole} \n
            \n 
            For the party making functionality, you have set your roles as follows: \n
            Tank Role: ${tankRole} \n
            Healer Role: ${healerRole} \n
            DPS Role: ${dpsRole} \n
        `);

        // Initialize the bot with the new configuration
        const client = require('../client');
        await initializeBot(client, config);
    }
};