const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/db.js');
const roleService = require('../services/roleService.js');

const addRolesCommand = new SlashCommandBuilder()
    .setName('add-roles')
    .setDescription('Add additional roles. (These roles can be used for partymaking functionality)')
for (let i = 1; i <= 15; i++) {
    addRolesCommand.addRoleOption(option =>
        option.setName(`additional_role_${i}`)
            .setDescription(`Additional role ${i}`)
            .setRequired(false));
}


module.exports = {
    data: addRolesCommand,
    async execute(interaction) {
        await interaction.reply({
            content: 'Adding roles...',
            ephemeral: true
        });

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

        const additionalRoles = [];
        for (let i = 1; i <= 15; i++) {
            const role = interaction.options.getRole(`additional_role_${i}`);
            if (role) {
                additionalRoles.push(role);
            }
        }

        if (additionalRoles.length === 0) {
            return await interaction.editReply({
                content: 'No valid roles were provided.', 
                ephemeral: true
            });
        }

        try {
            for (const role of additionalRoles) {
                await roleService.saveRole(interaction.guild.id, role.name, role.id)
            }

            const rolesDescription = additionalRoles
            .map(role => `Name: ${role.name} | ID: ${role.id}`)
            .join('\n');
            const addRolesEmbed = new EmbedBuilder()
                .setTitle('Successfully added new roles.')
                .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                .setDescription(`You have added a total of: ${additionalRoles.length} new roles. \n
                    Here is a breakdown of the roles you added: \n ${rolesDescription}
                    `);
            
            const checkChannelQuery = `
                    SELECT channel
                    FROM guilds
                    WHERE id = $1
            `;
            const result = await db.query(checkChannelQuery, [interaction.guild.id])
            const channelId = result.rows[0]?.channel;

            if (!channelId) {
                return await interaction.editReply({
                    content: 'Could not find the configured channel to send the embed.',
                });
            }

            const channel = interaction.guild.channels.cache.get(channelId);
            if (!channel) {
                return await interaction.editReply({
                    content: 'The configured channel is invalid or no longer exists.',
                });
            }

            await channel.send({
                embeds: [addRolesEmbed]
            });

            await interaction.editReply({
                content: 'Roles have been successfully added!'
            })
        } catch (error) {
            console.error('Error adding roles:', error);
            await interaction.editReply({
                content: `Something went wrong. ${error}`,
                ephemeral: true
            });
        }
    }

}