const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('./logger');
const { setNames } = require('./state');

const ATTENDANCE_FILE = path.join(__dirname, '..', 'data', 'attendance.json');
const IMAGES_DIR = path.join(__dirname, '..', 'images');

let attendanceLog = [];
if (fs.existsSync(ATTENDANCE_FILE)) {
    attendanceLog = JSON.parse(fs.readFileSync(ATTENDANCE_FILE, 'utf8'));
}

function saveAttendance() {
    try {
        fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(attendanceLog, null, 2));
    } catch (error) {
        logger.error('Error saving attendance log:', error);
    }
}

async function downloadImage(url, filepath) {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    return new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(filepath))
            .on('finish', () => resolve())
            .on('error', e => reject(e));
    });
}

function extractNames(text) {
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line && /^[A-Za-z][A-Za-z\s]{1,50}$/.test(line)); // More robust name detection
}

async function initializeBot(client, config) {
    // Ensure bot is configured
    if (!config.guild || !config.channel || !config.primaryRole) {
        logger.error('Bot not configured! Please run the /setup command.');
        return;
    }

    const guild = client.guilds.cache.get(config.guild);
    if (!guild) {
        logger.error('Guild not found');
        return;
    }

    const primaryRole = guild.roles.cache.get(config.primaryRole);
    if (!primaryRole) {
        logger.error('Role not found');
        return;
    }

    const additionalRoles = [
        { id: config.tankRole, name: 'Tank' },
        { id: config.healerRole, name: 'Healer' },
        { id: config.dpsRole, name: 'DPS' }
    ];

    try {
        logger.log('Fetching all members...');
        await guild.members.fetch();
        logger.log('All members fetched');
        const members = guild.members.cache;
        logger.log(`Fetched Members: ${members.map(member => member.user.username).join(', ')}`);

        const membersWithRole = members.filter(member => member.roles.cache.has(primaryRole.id));
        logger.log(`Members with role: ${membersWithRole.map(member => member.nickname || member.user.username).join(', ')}`);

        const names = membersWithRole.map(member => {
            const memberRoles = additionalRoles.filter(role => member.roles.cache.has(role.id)).map(role => role.name);
            if (memberRoles.length > 0) {
                return {
                    name: member.nickname || member.user.username,
                    roles: memberRoles
                };
            } else {
                return {
                    name: member.nickname || member.user.username,
                    roles: []
                };
            }
        });
        setNames(names);
        logger.log(`Members with role: ${names.map(member => member.name).join(', ')}`);
    } catch (error) {
        logger.error('Error fetching members:', error);
    }
}

function cleanupOldImages() {
    try {
        const files = fs.readdirSync(IMAGES_DIR);
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(IMAGES_DIR, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > 3600000) { // 1 hour
                fs.unlinkSync(filePath);
            }
        });
    } catch (error) {
        logger.error('Error cleaning up old images:', error);
    }
}

module.exports = {
    saveAttendance,
    downloadImage,
    extractNames,
    initializeBot,
    attendanceLog,
    IMAGES_DIR,
    cleanupOldImages,
};