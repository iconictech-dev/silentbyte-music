/* what are you looking for bruh nothing to clone dm iconic tech for best script I make telegram script bots Whatsapp bots etc dm at +263******** Thansk you*/

const main = require('./main.js');
const settings = require('./settings.js');
const path = require('path');

console.log(`
╔══════════════════════════════════════╗
║      🎵 SILENTBYTE MUSIC BOT        ║
║      🚀 Version: ${settings.get('version')}                ║
║      💻 Developer: silentbyte music ║
║      📅 ${new Date().toLocaleDateString()}        ║
╚══════════════════════════════════════╝
`);

// Display bot information
console.log('📊 Bot Configuration:');
console.log(`├─ Bot Name: ${settings.get('botName')}`);
console.log(`├─ Owner: ${settings.get('name')}`);
console.log(`├─ Prefix: ${settings.get('prefix') || '.'}`);
console.log(`├─ Auto Typing: ${settings.get('autoTyping') ? '✅ ON' : '❌ OFF'}`);
console.log(`├─ Auto Record: ${settings.get('autoRecord') ? '✅ ON' : '❌ OFF'}`);
console.log(`├─ Music Status: ${settings.get('musicStatus')}`);
console.log(`└─ Show Date in Bio: ${settings.get('showDateInBio') ? '✅ ON' : '❌ OFF'}`);
console.log('\n🔧 Loading modules...');

// Check for required files (removed owner.json since it's in settings.js)
const requiredFiles = [
    'database/apis.js',
    'session/creds.json'
];

requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    try {
        if (!require('fs').existsSync(filePath)) {
            console.warn(`⚠️  Missing file: ${file}`);
            // Only handle session file creation
            if (file === 'session/creds.json') {
                console.log('Creating empty session directory...');
                const fs = require('fs');
                const sessionDir = path.join(__dirname, 'session');
                if (!fs.existsSync(sessionDir)) {
                    fs.mkdirSync(sessionDir, { recursive: true });
                }
            }
        } else {
            console.log(`✅ ${file} found`);
        }
    } catch (error) {
        console.error(`❌ Error checking ${file}:`, error.message);
    }
});

console.log('\n🚀 Starting Silentbyte Music Bot...');
console.log('📱 Connect your phone by scanning the QR code\n');

// Keep the process running
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down Silentbyte Music Bot...');
    process.exit(0);
});