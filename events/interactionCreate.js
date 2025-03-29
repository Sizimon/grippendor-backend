const setupCommand = require('../commands/setup');
const createEventCommand = require('../commands/createEvent');
const { EmbedBuilder, ModalBuilder, TextInputStyle, ActionRowBuilder, TextInputBuilder } = require('discord.js');
const db = require('./db.js')
import { deleteImagesFromCloudinary } from '../utils/cloudinary';

module.exports = async function interactionCreate(interaction) {
    if (interaction.isButton()) {
        const member = interaction.member;
        const nickname = member.nickname
        const [action, eventId] = interaction.customId.split('_');

        if (action === 'attend' || action === 'decline') {
            const userId = interaction.user.id;
            const username = nickname || interaction.user.username;
            const response = action === 'attend' ? 'yes' : 'no';

            // Store the user's response in the database
            const eventAttendanceQuery = `
                INSERT INTO event_attendance (event_id, user_id, username, response)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (event_id, user_id) DO UPDATE SET response = EXCLUDED.response;
            `;
            await db.query(eventAttendanceQuery, [eventId, userId, username, response]);

            // Fetch the updated attendance lists
            const eventAttendanceResult = await dbClient.query(`
                SELECT username, response FROM event_attendance WHERE event_id = $1;
            `, [eventId]);

            const yesAttendees = eventAttendanceResult.rows.filter(row => row.response === 'yes').map(row => row.username).join('\n');
            const noAttendees = eventAttendanceResult.rows.filter(row => row.response === 'no').map(row => row.username).join('\n');

            // Fetch the event message
            const eventMessage = await interaction.channel.messages.fetch(interaction.message.id);

            // Update the event message
            const eventEmbed = EmbedBuilder.from(eventMessage.embeds[0]);
            const fields = eventEmbed.data.fields || [];
            const dateTimeField = fields.find(field => field.name === '🕒 Date and Time') || { name: '🕒 Date and Time', value: '', inline: false };
            eventEmbed.setFields([
                {
                    name: dateTimeField.name,
                    value: dateTimeField.value,
                    inline: dateTimeField.inline
                },
                {
                    name: '✅ Yes',
                    value: yesAttendees || '\u200B',
                    inline: true
                },
                {
                    name: '❌ No',
                    value: noAttendees || '\u200B',
                    inline: true
                }
            ]);
            await eventMessage.edit({ embeds: [eventEmbed] });

            // Send an ephemeral reply to the user
            await interaction.reply({ content: `You have indicated your attendance as ${response === 'yes' ? 'Yes' : 'No'}.`, ephemeral: true });
        } else if (action === 'cancel' || action === 'finish') {
            // Check if the user is a moderator
            const requiredRole = '1337158089459367936'; // !!! CHANGE TO DYNAMIC VALUE IN THE FUTURE !!!
            const hasPermission = member.roles.cache.has(requiredRole);

            if (!hasPermission) {
                return await interaction.reply({ content: 'You do not have permission to perform this action.', ephemeral: true });
            }

            if (action === 'cancel') {
                // Handle event cancellation
                const modal = new ModalBuilder()
                    .setCustomId(`confirm_${eventId}`)
                    .setTitle('Confirm Event Cancellation')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('confirmation')
                                .setLabel('Type "CONFIRM" to cancel the event.')
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder('CONFIRM')
                                .setRequired(true)
                        )
                    );
                await interaction.showModal(modal);
            } else if (action === 'finish') {
                // Handle event completion
                const modal = new ModalBuilder()
                    .setCustomId(`debrief_${eventId}`)
                    .setTitle('Event Debriefing')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('debrief')
                                .setLabel('Debriefing')
                                .setStyle(TextInputStyle.Paragraph)
                                .setPlaceholder('Enter details about how your Event/Mission went...')
                                .setRequired(true)
                        )
                    );
                await interaction.showModal(modal);
            }
        }
    } else if (interaction.isModalSubmit()) {
        const [action, eventId] = interaction.customId.split('_');

        if (action === 'confirm') {
            const confirmation = interaction.fields.getTextInputValue('confirmation');
            if (confirmation === 'CONFIRM') {
                try {
                    const getImageUrlsQuery = `
                    SELECT thumbnail_url, image_urls
                    FROM events
                    WHERE id = $1;
                `;
                    const result = await db.query(getImageUrlsQuery, [eventId]);

                    if (result.rows.lenght > 0) {
                        const { thumbnail_url, image_urls } = result.rows[0]

                        const allImageUrls = [thumbnail_url, ...(image_urls || [])].filter(url => url);

                        await deleteImagesFromCloudinary(allImageUrls);
                    }

                    const deleteEventQuery = 'DELETE FROM events WHERE id = $1';
                    await db.query(deleteEventQuery, [eventId]);
                    await interaction.message.delete();
                    await interaction.reply({ content: 'Event has been canceled and removed from the database.', ephemeral: true });
                } catch (error) {
                    console.error('Error deleting event or images:', error);
                    await interaction.reply({
                        content: `There has been an error with deleting the images from Cloudinary. ${error}`,
                        ephemeral: true
                    });

                }
            } else {
                await interaction.reply({ content: 'Event cancellation has failed', ephemeral: true });
            }
        } else if (action === 'debrief') {
            const debrief = interaction.fields.getTextInputValue('debrief');
            const updateEventQuery = `
                    UPDATE events
                    SET debrief = $1
                    WHERE id = $2;
                `;
            await db.query(updateEventQuery, [debrief, eventId]);
            await interaction.reply({ content: 'Event has been finished and debriefing has been saved.', ephemeral: true });
        }
    } else if (interaction.isCommand()) {
        const { commandName } = interaction;

        if (commandName === 'setup') {
            await setupCommand.execute(interaction);
        } else if (commandName === 'attendance') {
            await attendanceCommand.execute(interaction);
        } else if (commandName === 'create-event') {
            await createEventCommand.execute(interaction);
        }
    };
};

