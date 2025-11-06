const { Client, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const {initializeBot, startPeriodicRoleSync, syncSingleUserRoles} = require('./utils/index');
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

client.once('clientReady', async () => {
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

    startPeriodicRoleSync(client);
    console.log('Periodic sync started - will run every 15 minutes');

    cron.schedule('* * * * *', () => {
        checkUpcomingEvents(client);
    });
});

// Real-time role change detection
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
        const guildId = newMember.guild.id;
        
        // Only process guilds in your database
        const guildCheck = await db.query('SELECT id FROM guilds WHERE id = $1', [guildId]);
        if (guildCheck.rows.length === 0) return;

        // Check if roles actually changed
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;
        
        if (oldRoles.size === newRoles.size && 
            oldRoles.every(role => newRoles.has(role.id))) {
            return; // No role changes
        }

        console.log(`Role change detected for user ${newMember.user.username} in guild ${guildId}`);
        
        // Sync roles for this specific user
        await syncSingleUserRoles(client, guildId, newMember.user.id);
        
    } catch (error) {
        logger.error('Error in guildMemberUpdate handler:', error);
    }
});

client.on('roleDelete', async (role) => {
    try {
        const guildId = role.guild.id;
        
        // Only process tracked guilds
        const guildCheck = await db.query('SELECT id FROM guilds WHERE id = $1', [guildId]);
        if (guildCheck.rows.length === 0) return;

        // Clean up deleted role from database
        const deleteResult = await db.query('DELETE FROM roles WHERE guild_id = $1 AND role_id = $2 RETURNING *', [guildId, role.id]);
        
        if (deleteResult.rows.length > 0) {
            await db.query('DELETE FROM guilduserroles WHERE guild_id = $1 AND role_name = $2', [guildId, role.name]);
            logger.log(`Cleaned up deleted role: ${role.name} from guild ${guildId}`);
        }
        
    } catch (error) {
        logger.error('Error in roleDelete handler:', error);
    }
});

// Import and use the interactionCreate event handler
const interactionCreateHandler = require('./events/interactionCreate');
client.on('interactionCreate', interactionCreateHandler);

module.exports = client;