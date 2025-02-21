const { Client, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
require('dotenv').config();

const { checkUpcomingEvents } = require('./utils/loaders');
const cron = require('node-cron');

const client = new Client({
    intents: [
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});
// Create Commands Array & Register Commands Depending on the File Name
const commands = [];
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

client.once('ready', async () => {
    logger.log(`Logged in as ${client.user.tag}`);

    const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        logger.log('Successfully registered application (/) commands.');
    } catch (error) {
        logger.error('Error registering application (/) commands:', error);
    }

    cron.schedule('* * * * *', () => {
        checkUpcomingEvents(client);
    });
});

// Import and use the interactionCreate event handler
const interactionCreateHandler = require('./events/interactionCreate');
client.on('interactionCreate', interactionCreateHandler);

module.exports = client;