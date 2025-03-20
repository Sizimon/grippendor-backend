const { SlashCommandBuilder } = require('discord.js');
const { initializeBot } = require('../utils/index.js');
const { Client } = require('pg');
const bcrypt = require('bcrypt');

// const { execute } = require('./attendance');

// Create a new PostgreSQL client
const dbClient = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
})

dbClient.connect();


const setupCommand = new SlashCommandBuilder()
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
    .addStringOption(option =>
        option.setName('icon')
            .setDescription('The icon URL for your frontend dashboard')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('title')
            .setDescription('The title for the frontend dashboard')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('password')
            .setDescription('Password to access Dashboard. (IMPORTANT: DO NOT USE PRIVATE/PERSONAL PASSWORDS)')
            .setRequired(true));

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

        const guildConfigQuery = `
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

        const guildConfigValues = [
            config.guild,
            config.channel,
            config.color,
            config.primaryRole,
            config.icon,
            config.title,
            config.password
        ];

        try {
            await dbClient.query(guildConfigQuery, guildConfigValues);
            const rolesInsertQuery = `
                INSERT INTO roles (guild_id, role_name, role_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (guild_id, role_id) DO NOTHING;
            `;
            for (const role of additionalRoles) {
                const roleValues = [interaction.guild.id, role.name, role.id];
                await dbClient.query(rolesInsertQuery, roleValues);
            }
            const dashboardUrl = `http://localhost:3000/${config.guild}`;
            await interaction.reply(`
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
            `);
            //TEST BLOCK
            const reFetchGuildDataQuery = `
            SELECT * FROM Guilds 
            WHERE guild_id = $1
            `;
            const result = dbClient.query(reFetchGuildDataQuery, config.guild)
            //TEST BLOCK
            const client = require('../client');
            await initializeBot(client, result); //TEST BLOCK (CHANGE RESULT BACK TO CONFIG IF FAIL)
        } catch (error) {
            console.error('Error saving guild configuration:', error);
            await interaction.reply('An error occurred while saving the configuration. Please try again.');
        }
    }
};