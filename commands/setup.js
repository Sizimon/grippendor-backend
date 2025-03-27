const axios = require('axios');
const sharp = require('sharp'); // Library for checking metadata of attachments
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { initializeBot } = require('../utils/index.js');
const bcrypt = require('bcrypt');
const db = require('../utils/db.js');
const { uploadImageToCloudinary } = require('../utils/cloudinary.js');

const guildService = require('../services/guildService.js')
const roleService = require('../services/roleService.js')

const setupCommand = new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup the bot configuration')
    .addChannelOption(option => option.setName('channel').setDescription('Default Bot Channel (Should be a admin channel)').setRequired(true))
    .addStringOption(option => option.setName('color').setDescription('The color palette (e.g., #FF0000)').setRequired(true))
    .addStringOption(option => option.setName('title').setDescription('The title for the frontend dashboard (MAXIMUM: 25 Characters)').setRequired(true))
    .addStringOption(option => option.setName('password').setDescription('Password to access Dashboard. (IMPORTANT: DO NOT USE PRIVATE/PERSONAL PASSWORDS)').setRequired(true))
    .addRoleOption(option => option.setName('primary_role').setDescription('The bot will track all members with the role you choose, (i.e default member role)').setRequired(true))
    .addAttachmentOption(option => option.setName('icon').setDescription('Insert your guild icon. (MAX SIZE: 400x400px | ALLOWED FORMATS: .jpg, .png, .webp, .svg)').setRequired(false));
    
    // .addStringOption(option => option.setName('icon').setDescription('The icon URL for your frontend dashboard').setRequired(true))
    

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
        const title = interaction.options.getString('title');
        const password = interaction.options.getString('password');
        const icon = interaction.options.getAttachment('icon');
        let iconUrl = null;

        // Validate if Icon is correct size
        if (icon) {
            try {
                // Validate the image format
                const validFormats = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
                const fileExtension = icon.name.split('.').pop().toLowerCase();

                if (!validFormats.includes(fileExtension)) {
                    return await interaction.reply({
                        content:  `Unsupported image format. Please upload an image in one of the following formats: ${validFormats.join(', ')}`,
                        ephemeral: true,
                    })
                }

                const response = await axios({
                    method: 'get',
                    url: icon.url,
                    responseType: 'arraybuffer',
                });

                // Use sharp to inspect image dimensions
                const imageBuffer = Buffer.from(response.data);
                const metadata = await sharp(imageBuffer).metadata();

                // Image size validation
                if (metadata.width > 400 || metadata.height > 400) {
                    return await interaction.reply({
                        content: 'Size of icon is too large. Icon must be 400x400px maximum.'
                    });
                }

                iconUrl = await uploadImageToCloudinary(icon.url);
            } catch (error) {
                console.error('Error validating icon size:', error);
                return await interaction.reply({
                    content: `An error occured while validating the icon: ${error}`,
                    ephemeral: true,
                })
            }
        }

        // Validate Title Length
        if (title.length > 25) {
            await interaction.reply({
                content: 'The title for your server dashboard is too long! (MAXIMUM: 25 Characters)',
                ephemeral: true
            });
            return;
        }

        // END VALIDATION

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

        await interaction.reply({ content: 'Initiating Setup...', ephemeral: true });

        try {
            const config = {
                guild: interaction.guild.id,
                channel: channel.id,
                color,
                primaryRole: primaryRole.id,
                icon: iconUrl,
                title,
                password: hashedPassword
            };

            await guildService.saveGuildConfig(config);
            for (const role of additionalRoles) {
                await roleService.saveRole(interaction.guild.id, role.name, role.id);
            };
            const dashboardUrl = `http://szymonsamus.dev/bot-dashboard/`;
            const setupEmbed = new EmbedBuilder()
                .setTitle(title)
                .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                .setDescription(`Configuration saved! \n
                    You can now start using the Gripendor Bot. 
                    The bot's default channel has been set to: (${channel}) \n
                    Your dashboard is customised with the following settings:
                    Title: ${title}
                    Default Dashboard Color: ${color}
                    Your Dashboard Icon URL: ${iconUrl} \n
                    Your main members will be tracked with the following role: ${primaryRole}
                    Setup complete with ${additionalRoles.length} additional roles. \n
                    ACCESS YOUR DASHBOARD HERE: ${dashboardUrl}`)
            if (iconUrl) {
                setupEmbed.setThumbnail(iconUrl);
            }

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