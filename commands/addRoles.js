const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/db.js');
const roleService = require('../services/roleService.js');

const addRolesCommand = new SlashCommandBuilder()
    .setName('Add Roles')
    .setDescription('Add additional roles. (These roles can be used for partymaking functionality)')
for (let i = 1; i <= 15; i++) {
    addRolesCommand.addRoleOption(option =>
        option.setName(`additional_role_${i}`)
            .setDescription(`Additional role ${i}`)
            .setRequired(true));
}


module.exports = {
    data: addRolesCommand,
    async execute(interaction) {
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

        const additionalRoles = [];
        for (let i = 1; i <= 15; i++) {
            const role = interaction.options.getRole(`additional_role_${i}`);
            if (role) {
                additionalRoles.push(role);
            }
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
                    Here is a breakdown of the roles you added: ${rolesDescription}
                    `);
            
            const checkChannelQuery = `
                    SELECT channel
                    FROM guilds
                    WHERE id = $1
            `;
            const result = await db.query(checkChannelQuery, [interaction.guild.id])
            const channel = result.rows[0]

            await channel.send({
                embeds: [addRolesEmbed]
            });
        } catch (error) {
            await interaction.reply({
                content: `Something went wrong. ${error}`,
                ephemeral: true
            });
        }
    }

}