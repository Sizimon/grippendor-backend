const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/db.js');
const roleService = require('../services/roleService.js');
const { syncNewRolesForGuild } = require('../utils/index.js');

const addRolesCommand = new SlashCommandBuilder()
    .setName('add-roles')
    .setDescription('Add additional roles, to be used in presets.')
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
            const existingRoles = [];
            const addedRoles = [];

            for (const role of additionalRoles) {
                const wasAdded = await roleService.saveRole(interaction.guild.id, role.name, role.id);
                if (wasAdded) {
                    addedRoles.push(role);
                } else {
                    existingRoles.push(role);
                }
            }

            if (addedRoles.length > 0) {
                try {
                    const addedRoleNames = addedRoles.map(role => role.name);
                    await syncNewRolesForGuild(interaction.client, interaction.guild.id, addedRoleNames);
                } catch (syncError) {
                    console.error('Error syncing roles:', syncError);
                    return await interaction.editReply({
                        content: `Added ${addedRoles.length} role(s), but failed to sync user data: ${syncError.message}`,
                        ephemeral: true
                    });
                }
            }

            let userMessage = '';
            if (addedRoles.length > 0) {
                userMessage += `✅ Successfully added ${addedRoles.length} role(s) and synced user data.\n`;
            }
            if (existingRoles.length > 0) {
                userMessage += `ℹ️ ${existingRoles.length} role(s) already existed and were skipped.`;
            }

            // Update the user with final status
            await interaction.editReply({
                content: userMessage,
                ephemeral: true
            });

            // Send embed to channel if there are results to show
            if (addedRoles.length > 0 || existingRoles.length > 0) {
                await sendRoleUpdateEmbed(interaction, addedRoles, existingRoles);
            }
        } catch (error) {
            console.error('Error adding roles:', error);
            await interaction.editReply({
                content: `Something went wrong: ${error.message}`,
                ephemeral: true
            });
        }
    }
}

// Helper function for channel embed
async function sendRoleUpdateEmbed(interaction, addedRoles, existingRoles) {
    try {
        const checkChannelQuery = 'SELECT channel FROM guilds WHERE id = $1';
        const result = await db.query(checkChannelQuery, [interaction.guild.id]);
        const channelId = result.rows[0]?.channel;

        if (!channelId) {
            console.log('No channel configured for role updates');
            return;
        }

        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) {
            console.log('Configured channel not found');
            return;
        }

        // Build embed description
        let embedDescription = '';
        
        if (addedRoles.length > 0) {
            embedDescription += `**✅ Added Roles (${addedRoles.length}):**\n`;
            embedDescription += addedRoles.map(role => `• ${role.name}`).join('\n');
            embedDescription += '\n\n';
        }
        
        if (existingRoles.length > 0) {
            embedDescription += `**ℹ️ Already Existing (${existingRoles.length}):**\n`;
            embedDescription += existingRoles.map(role => `• ${role.name}`).join('\n');
        }

        const addRolesEmbed = new EmbedBuilder()
            .setTitle('Role Update Summary')
            .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
            .setDescription(embedDescription)
            .setColor(addedRoles.length > 0 ? 0x00ff00 : 0xffaa00) // Green if added, orange if only existing
            .setTimestamp();

        await channel.send({ embeds: [addRolesEmbed] });

    } catch (error) {
        console.error('Error sending role update embed:', error);
        // Don't throw - this is just for logging, not critical
    }
}