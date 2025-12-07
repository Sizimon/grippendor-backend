const axios = require('axios');
const sharp = require('sharp');
const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/db.js');
const { uploadImageToCloudinary } = require('../utils/cloudinary.js');

const customDashboardCommand = new SlashCommandBuilder()
    .setName('customise-dashboard')
    .setDescription('Customise the dashboard for your server')
    .addAttachmentOption(option => option.setName('icon').setDescription('Choose a custom icon! (Recommended: 400x400px PNG)').setRequired(false))

module.exports = {
    data: customDashboardCommand,
    async execute(interaction) {

        await interaction.deferReply({ ephemeral: true }); // Defer the reply to allow time for processing

        // Verify that the command user has the required role!
        const getAdminRoleQuery = `
                                        SELECT admin_role
                                        FROM guilds
                                        WHERE id = $1
                                    `;
        const adminSearchResult = await db.query(getAdminRoleQuery, [interaction.guild.id]);
        if (adminSearchResult.rows.length === 0) {
            return await interaction.editReply({
                content: 'Could not find the admin role.', ephemeral: true
            });
        }
        const requiredRole = adminSearchResult.rows[0].admin_role;
        const hasPermission = interaction.member.roles.cache.has(requiredRole);

        if (!hasPermission) {
            return await interaction.editReply({ content: 'You do not have permission to perform this action.', ephemeral: true });
        }

        interaction.editReply({
            content: 'Applying your customisations...',
            ephemeral: true,
        })

        const icon = interaction.options.getAttachment('icon');
        let iconUrl = null;

        if (icon) {
            try {
                // Validate the image format
                const validFormats = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
                const fileExtension = icon.name.split('.').pop().toLowerCase();

                if (!validFormats.includes(fileExtension)) {
                    return await interaction.editReply({
                        content: `Unsupported image format. Please upload an image in one of the following formats: ${validFormats.join(', ')}`,
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
                    return await interaction.editReply({
                        content: 'Size of icon is too large. Icon must be 400x400px maximum.'
                    });
                }

                iconUrl = await uploadImageToCloudinary(icon.url);
            } catch (error) {
                console.error('Error validating icon size:', error);
                return await interaction.editReply({
                    content: `An error occured while validating the icon: ${error}`,
                    ephemeral: true,
                })
            }
        }

        try {
            const checkGuildExistsQuery = `
                SELECT 1 FROM guilds WHERE id = $1
            `;
            const guildExists = await db.query(checkGuildExistsQuery, [interaction.guild.id]);

            if (guildExists.rows.length === 0) {
                return await interaction.editReply({
                    content: 'Your guild is not registered. Please run the `/setup` command first.',
                    ephemeral: true,
                });
            }

            const customisations = {
                guild_id: interaction.guild.id,
                icon_url: iconUrl,
            }
            
            const saveIconQuery = `
                    UPDATE guilds
                    SET icon = COALESCE($2, icon)
                    WHERE id = $1;
                `;
            const values = [
                    customisations.guild_id,
                    customisations.icon_url,
                ];
            await db.query(saveIconQuery, values);

        } catch (error) {
            console.error('Error saving customisations:', error);
            return await interaction.editReply({
                content: `An error occurred while saving your customisations: ${error}`,
                ephemeral: true,
            })
        }

        await interaction.editReply({
            content: 'Your customisations have been saved!',
            ephemeral: true,
        });
    }
}
