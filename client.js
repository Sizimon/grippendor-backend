const { Client, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const {initializeBot} = require('./utils/index');
const db = require('./utils/db')
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

        const guildId = process.env.TEST_GUILD_ID;
        if (guildId) {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId),
                { body: commands },
            );
            logger.log(`Successfully registered guild-specific commands for testing at Guild ID: ${guildId}`);
        }
        logger.log('Successfully registered application (/) commands.');
    } catch (error) {
        logger.error('Error registering application (/) commands:', error);
    }

    try {
        const query = 'SELECT * FROM guilds';
        const result = await db.query(query);

        if (result.rows.length > 0) {
            for (const config of result.rows) {
                console.log('Initializing bot for guild:', config.id);
                await initializeBot(client, config);
                console.log('Bot initialized for guild:', config.id);
            }
        } else {
            console.log('No guilds found in the database');
        }
    } catch (error) {
        console.error('Error initializing bot for guilds:', error);
    }

    cron.schedule('* * * * *', () => {
        checkUpcomingEvents(client);
    });
});

// Import and use the interactionCreate event handler
const interactionCreateHandler = require('./events/interactionCreate');
client.on('interactionCreate', interactionCreateHandler);

module.exports = client;