const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logStream = fs.createWriteStream(path.join(LOG_DIR, 'bot.log'), { flags: 'a' });

const logger = {
    log: (msg) => {
        const timestamp = new Date().toISOString();
        logStream.write(`[${timestamp}] INFO: ${msg}\n`);
        console.log(`[${timestamp}] ${msg}`);
    },
    error: (msg, error) => {
        const timestamp = new Date().toISOString();
        logStream.write(`[${timestamp}] ERROR: ${msg} ${error?.stack || error}\n`);
        console.error(`[${timestamp}] ERROR: ${msg}`, error);
    }
};

module.exports = logger;