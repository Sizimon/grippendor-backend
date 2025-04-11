const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { initializeBot } = require('../utils/index.js');
const bcrypt = require('bcrypt');
const db = require('../utils/db.js');

const guildService = require('../services/guildService.js')

const setupCommand = new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup the bot configuration')
    .addChannelOption(option => option.setName('channel').setDescription('Default Bot Channel (Should be a admin channel)').setRequired(true))
    .addRoleOption(option => option.setName('admin_role').setDescription('This role grants use of bot admin permissions.').setRequired(true))
    .addRoleOption(option => option.setName('primary_role').setDescription('The bot will track all members with the role you choose, (i.e default member role)').setRequired(true))
    .addStringOption(option => option.setName('title').setDescription('The title for the frontend dashboard (MAXIMUM: 25 Characters)').setRequired(true))
    .addStringOption(option => option.setName('password').setDescription('Password to access Dashboard. (IMPORTANT: DO NOT USE PRIVATE/PERSONAL PASSWORDS)').setRequired(true))

module.exports = {
    data: setupCommand,
    async execute(interaction) {
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({
                content: 'You do not have the permission to use this command.',
                ephemeral: true,
            });
        }

        await interaction.reply({ content: 'Initiating Setup...', ephemeral: true });

        const channel = interaction.options.getChannel('channel');
        const primaryRole = interaction.options.getRole('primary_role');
        const adminRole = interaction.options.getRole('admin_role');
        const title = interaction.options.getString('title');
        const password = interaction.options.getString('password');
       
        // Validate Title Length
        if (title.length > 25) {
            await interaction.editReply({
                content: 'The title for your server dashboard is too long! (MAXIMUM: 25 Characters)',
                ephemeral: true
            });
            return;
        }

        // END VALIDATION

        // Hash the password using bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        try {
            const config = {
                guild: interaction.guild.id,
                channel: channel.id,
                primaryRole: primaryRole.id,
                adminRole: adminRole.id,
                title,
                password: hashedPassword
            };

            await guildService.saveGuildConfig(config);

            const dashboardUrl = `http://szymonsamus.dev/bot-dashboard/`;
            const setupEmbed = new EmbedBuilder()
                .setTitle(title)
                .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                .setDescription(`Configuration saved! \n
                    You can now start using the Gripendor Bot.
                    Server membership tracked through the following role: ${primaryRole.name} \n
                    Start off by customising your dashboard by using the "/customise-dashboard" command (or keep the defaults)! \n 
                    The bot's default channel has been set to: ${channel.name} \n
                    The basic commands are:
                    /setup | Setup the bot according to server configurations / change the bot configurations.
                    /customise-dashboard | Customise the bot dashboard with a color scheme, banner and icon.
                    /add-roles | Add trackable roles to users, for use in the party maker / other features.
                    /create-preset | Create a preset for the event matchmaking process.
                    /create-event | Create an event for users with an attendance list. \n
                    
                    ACCESS YOUR DASHBOARD HERE: ${dashboardUrl}`)

            await channel.send({
                embeds: [setupEmbed]
            })
            
            
            const reFetchGuildDataQuery = 'SELECT * FROM guilds WHERE id = $1';
            const values = [config.guild]
            const result = await db.query(reFetchGuildDataQuery, values);
            
            const client = require('../client');
            await initializeBot(client, result.rows[0]);
            await interaction.editReply({ content: 'Setup Completed Successfully', ephemeral: true }); 
        } catch (error) {
            console.error('Error saving guild configuration:', error);
            await interaction.editReply({ content: `An error has occured during the setup process: ${error}`, ephemeral: true });
        }
    }
};