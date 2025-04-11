const axios = require('axios');
const sharp = require('sharp');
const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/db.js');
const { uploadCustomsToCloudinary, uploadImageToCloudinary } = require('../utils/cloudinary.js');

const colorChoices = [
    { label: 'Sandy Brown (#F19143)', value: '#F19143' },
    { label: 'Light Sea Blue (#00B9AE)', value: '#00B9AE' },
    { label: 'Dusty Green (#8FAD88)', value: '#8FAD88' },
    { label: 'Malachite (#32E875)', value: '#32E875' },
    { label: 'Rojo Red (#DD0426)', value: '#DD0426' },
    { label: 'Flax (#F5DD90)', value: '#F5DD90' },
]

const customDashboardCommand = new SlashCommandBuilder()
    .setName('customise-dashboard')
    .setDescription('Customise the dashboard for your server')
    .addStringOption(option => option.setName('color').setDescription('Choose your color scheme.').setRequired(false).addChoices(colorChoices.map(cc => ({ name: cc.label, value: cc.value }))))
    .addAttachmentOption(option => option.setName('icon').setDescription('Insert your guild icon. (MAXIMUM 400x400px) (OPTIMAL: .PNG WITH TRANSPARENT BACKGROUND)').setRequired(false))
    .addAttachmentOption(option => option.setName('banner').setDescription('Insert your guild banner. (RECOMMENDED: 2000x600px) (OPTIMAL FORMAT: PNG)').setRequired(false))


module.exports = {
    data: customDashboardCommand,
    async execute(interaction) {
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

        interaction.reply({
            content: 'Applying your customisations...',
            ephemeral: true,
        })

        const color = interaction.options.getString('color');
        const banner = interaction.options.getAttachment('banner');
        let bannerUrl = null;
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

        if (banner) {
            try {
                // Validate the image format
                const validFormats = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
                const fileExtension = banner.name.split('.').pop().toLowerCase();

                if (!validFormats.includes(fileExtension)) {
                    return await interaction.editReply({
                        content: `Unsupported image format. Please upload an image in one of the following formats: ${validFormats.join(', ')}`,
                        ephemeral: true,
                    })
                }

                const response = await axios({
                    method: 'get',
                    url: banner.url,
                    responseType: 'arraybuffer',
                });

                // Use sharp to inspect image dimensions
                const imageBuffer = Buffer.from(response.data);
                const metadata = await sharp(imageBuffer).metadata();

                // Image size validation
                if (metadata.width > 2000 || metadata.height > 600) {
                    return await interaction.editReply({
                        content: 'The maximum & recommended size for the banner is 2000x600px.'
                    });
                }

                bannerUrl = await uploadCustomsToCloudinary(banner.url);
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
                color: color,
                icon_url: iconUrl,
                banner_url: bannerUrl,

            }

            const query = `
                INSERT INTO guilds (id, color, icon, banner)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO UPDATE
                SET color = EXCLUDED.color,
                    icon = EXCLUDED.icon,
                    banner = EXCLUDED.banner,
                    channel = guilds.channel,
                    primary_role = guilds.primary_role,
                    admin_role = guilds.admin_role,
                    title = guilds.title,
                    password = guilds.password;
                    `;
            const values = [
                customisations.guild_id,
                customisations.color,
                customisations.icon_url,
                customisations.banner_url,
            ];

            await db.query(query, values);
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
