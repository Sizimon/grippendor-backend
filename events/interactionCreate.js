const setupCommand = require('../commands/setup');
const attendanceCommand = require('../commands/attendance');

module.exports = async function interactionCreate(interaction) {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'setup') {
        await setupCommand.execute(interaction);
    } else if (commandName === 'attendance') {
        await attendanceCommand.execute(interaction);
    }
};