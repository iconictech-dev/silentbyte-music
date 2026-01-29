    makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const yts = require("yt-search");
const ytdl = require("ytdl-core");
const settings = require("./settings.js");
const apis = require("./database/apis.js");

class SilentbyteMusicBot {
    constructor() {
        this.sock = null;
        this.prefix = ".";
        this.commands = new Map();
        this.isConnected = false;
        this.startTime = new Date();
        this.userStats = {};
        
        // Load commands
        this.loadCommands();
        
        // Initialize bot
        this.init();
    }
    
    async init() {
        console.log("🚀 Initializing Silentbyte Music Bot...");
        
        // Connect to WhatsApp
        await this.connectToWhatsApp();
        
        // Set bot status
        await this.setBotStatus();
    }
    
    async connectToWhatsApp() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState("session");
            const { version } = await fetchLatestBaileysVersion();
            
            this.sock = makeWASocket({
                version,
                logger: pino({ level: "silent" }),
                printQRInTerminal: true,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                browser: ["SILENTBYTE MUSIC", "Chrome", "3.0"],
                generateHighQualityLinkPreview: true,
                emitOwnEvents: true,
                defaultQueryTimeoutMs: 60000,
            });
            
            this.sock.ev.on('creds.update', saveCreds);
            
            // Handle connection events
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;
                
                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                    
                    console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
                    
                    if (shouldReconnect) {
                        await this.connectToWhatsApp();
                    }
                } else if (connection === 'open') {
                    console.log('✅ Connected to WhatsApp!');
                    this.isConnected = true;
                    
                    // Update profile status
                    await this.updateProfileStatus();
                    
                    // Start periodic updates
                    this.startPeriodicUpdates();
                }
            });
            
            // Handle incoming messages
            this.sock.ev.on('messages.upsert', async (m) => {
                await this.handleMessage(m);
            });
            
        } catch (error) {
            console.error("Connection error:", error);
            setTimeout(() => this.connectToWhatsApp(), 5000);
        }
    }
    
    async handleMessage(m) {
        try {
            if (!m.messages || m.type !== 'notify') return;
            
            const msg = m.messages[0];
            if (!msg.message) return;
            
            const isGroup = msg.key.remoteJid.endsWith('@g.us');
            const sender = msg.key.remoteJid;
            const text = this.getText(msg);
            
            // Ignore messages from broadcast lists and status
            if (sender.includes('broadcast') || sender.includes('status')) return;
            
            // Handle commands
            if (text && (text.startsWith(this.prefix) || text.startsWith('/'))) {
                const usedPrefix = text.startsWith(this.prefix) ? this.prefix : '/';
                const body = text.slice(usedPrefix.length).trim();
                const args = body.split(' ');
                const command = args.shift().toLowerCase();
                const query = args.join(' ');
                
                await this.handleCommand(command, query, msg, sender, isGroup);
            }
            
            // Auto-typing
            if (settings.get('autoTyping')) {
                await this.sock.sendPresenceUpdate('composing', sender);
                setTimeout(async () => {
                    await this.sock.sendPresenceUpdate('paused', sender);
                }, 2000);
            }
            
        } catch (error) {
            console.error("Message handling error:", error);
        }
    }
    
    async handleCommand(command, query, msg, sender, isGroup) {
        const reply = async (text) => {
            await this.sock.sendMessage(sender, { text }, { quoted: msg });
        };
        
        // Update user stats
        this.updateStats(sender, command);
        
        // Auto-record if enabled
        if (settings.get('autoRecord') && msg.message?.audioMessage) {
            await this.recordAudio(msg, sender);
        }
        
        switch (command) {
            case 'menu':
            case 'help':
            case 'commands':
                await this.showMenu(msg, sender, query);
                break;
                
            case 'ping':
                await this.ping(msg, sender);
                break;
                
            case 'play':
            case 'song':
            case 'music':
                await this.playMusic(query, msg, sender);
                break;
                
            case 'musiclist':
                await this.musicList(query, msg, sender);
                break;
                
            case 'video':
                await this.downloadVideo(query, msg, sender);
                break;
                
            case 'apk':
                await this.downloadApk(query, msg, sender);
                break;
                
            case 'settings':
                await this.showSettings(query, msg, sender);
                break;
                
            case 'owner':
                await this.showOwnerInfo(msg, sender);
                break;
                
            case 'status':
                await this.showBotStatus(msg, sender);
                break;
                
            case 'stats':
                await this.showStats(msg, sender);
                break;
                
            case 'restart':
                await this.restartBot(msg, sender);
                break;
                
            default:
                await reply(`❌ Unknown command. Type *${this.prefix}menu* to see all commands.`);
        }
    }
    
    async showMenu(msg, sender, query) {
        try {
            const menuSections = {
                main: `
🎵 *SILENTBYTE MUSIC BOT* 🎵

📊 *Bot Information:*
• 🤖 Name: Silentbyte Music Bot
• ⚙️ Version: ${settings.get('version')}
• 👑 Owner: ${settings.get('name')}
• 🕒 Uptime: ${this.getUptime()}
• 📈 Status: Online ✅

🎵 *MUSIC COMMANDS:*
• ${this.prefix}play <song> - Play music
• ${this.prefix}musiclist <query> - Search music
• ${this.prefix}video <query> - Download video
• ${this.prefix}apk <name> - Download APK

⚙️ *BOT CONTROLS:*
• ${this.prefix}ping - Check bot speed
• ${this.prefix}status - Bot status
• ${this.prefix}stats - Usage statistics
• ${this.prefix}settings - Bot settings
• ${this.prefix}owner - Owner info

💡 *Tips:* Type ${this.prefix}help <command> for detailed help

🔧 *Developed by silentbyte music*
📅 ${new Date().toLocaleDateString('en-GB')}
                `.trim(),
                
                music: `
🎵 *MUSIC COMMANDS HELP*

*${this.prefix}play <song name>*
Download and play music
Example: ${this.prefix}play understand by omah lay

*${this.prefix}musiclist <query>*
Search for multiple songs
Example: ${this.prefix}musiclist omah lay

*${this.prefix}video <query>*
Download video with audio
Example: ${this.prefix}video faded alan walker

*${this.prefix}apk <app name>*
Download Android APK files
Example: ${this.prefix}apk whatsapp
                `.trim()
            };
            
            let response = menuSections.main;
            
            if (query) {
                switch (query.toLowerCase()) {
                    case 'music':
                        response = menuSections.music;
                        break;
                    case 'social':
                    case 'media':
                        response = "📱 *Social Media Features*\n\nComing Soon! Stay tuned for updates.";
                        break;
                }
            }
            
            // Send menu with image if available
            const imagePath = path.join(__dirname, 'media', 'music.jpg');
            if (fs.existsSync(imagePath)) {
                await this.sock.sendMessage(sender, {
                    image: fs.readFileSync(imagePath),
                    caption: response
                }, { quoted: msg });
            } else {
                await this.sock.sendMessage(sender, { text: response }, { quoted: msg });
            }
            
        } catch (error) {
            console.error("Menu error:", error);
            await this.sock.sendMessage(sender, {
                text: "❌ Error loading menu. Please try again."
            }, { quoted: msg });
        }
    }
    
    async ping(msg, sender) {
        const start = Date.now();
        await this.sock.sendPresenceUpdate('available', sender);
        const latency = Date.now() - start;
        
        const pingMessage = `
🏓 *PONG!*
• ⚡ Latency: ${latency}ms
• 🤖 Bot: Silentbyte Music Bot
• 🕒 Uptime: ${this.getUptime()}
• 📊 Status: Online ✅
• 💻 Developer: silentbyte music

🎵 Music System: ${settings.get('musicStatus')}
⌨️ Auto Typing: ${settings.get('autoTyping') ? 'ON ✅' : 'OFF ❌'}
🎤 Auto Record: ${settings.get('autoRecord') ? 'ON ✅' : 'OFF ❌'}
        `.trim();
        
        await this.sock.sendMessage(sender, { text: pingMessage }, { quoted: msg });
    }
    
    // FIXED: PLAY MUSIC COMMAND
    async playMusic(text, m, chat) {
        if (!text) {
            await this.sock.sendMessage(chat, {
                text: `🎶 *Example:* ${this.prefix}play understand by omah lay`
            }, { quoted: m });
            return;
        }

        try {
            const search = await yts(text);
            const video = search.videos[0];
            if (!video) {
                await this.sock.sendMessage(chat, {
                    text: `❌ *No results found for:* ${text}`
                }, { quoted: m });
                return;
            }

            // 🎵 React before search
            await this.sock.sendMessage(chat, { react: { text: "🎵", key: m.key } });

            // Current date & time
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-GB');
            const timeStr = now.toLocaleTimeString('en-GB');

            // 🔹 Music info box
            const songBox = `
🎵 *SILENTBYTE MUSIC BOT - MUSIC PLAYER*
• 🎧 *Title:* ${video.title}
• 🎼 *Channel:* ${video.author?.name || "Unknown"}
• ⏳ *Duration:* ${video.timestamp}
• 👀 *Views:* ${video.views.toLocaleString()}
• 🕒 *Uploaded:* ${video.ago}
• 📅 *Date:* ${dateStr}
• ⏰ *Time:* ${timeStr}
• 🔗 ${video.url}

💻 *Developed by silentbyte music*
            `.trim();

            // Send thumbnail + details
            await this.sock.sendMessage(chat, {
                image: { url: video.thumbnail },
                caption: songBox
            }, { quoted: m });

            // ✅ Download audio using Keith API
            let downloadUrl = null;
            let title = video.title;

            const apiList = [
                // Try direct audio endpoint first
                async () => {
                    const url = `${apis.music.keith.audio}?url=${encodeURIComponent(video.url)}`;
                    const res = await axios.get(url, { timeout: 15000 });
                    if (res.data?.status && res.data.result) {
                        return { title: video.title, url: res.data.result };
                    }
                    throw new Error("Keith Audio API failed");
                },
                // Try ytmp3 endpoint as fallback
                async () => {
                    const url = `${apis.music.keith.ytmp3}?url=${encodeURIComponent(video.url)}`;
                    const res = await axios.get(url, { timeout: 15000 });
                    if (res.data?.status && res.data.result?.url) {
                        return { 
                            title: res.data.result.filename || video.title, 
                            url: res.data.result.url 
                        };
                    }
                    throw new Error("Keith YTMP3 API failed");
                },
                // Try video endpoint as last resort (we'll extract audio from it)
                async () => {
                    const url = `${apis.music.keith.ytmp4}?url=${encodeURIComponent(video.url)}`;
                    const res = await axios.get(url, { timeout: 15000 });
                    if (res.data?.status && res.data.result?.url) {
                        return { 
                            title: res.data.result.filename || video.title, 
                            url: res.data.result.url 
                        };
                    }
                    throw new Error("Keith YTMP4 API failed");
                }
            ];

            let localFile = null;
            for (let api of apiList) {
                try {
                    const result = await api();
                    if (result.url) {
                        downloadUrl = result.url;
                        title = result.title || title;
                        console.log(`✅ Success using API: ${api.name || 'Keith API'}`);
                        break;
                    }
                } catch (e) {
                    console.log(`❌ API failed: ${e.message}`);
                    continue;
                }
            }

            // Fallback to ytdl-core if all APIs fail
            if (!downloadUrl) {
                try {
                    console.log("⚠️ Using ytdl-core as fallback");
                    const audioStream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
                    const chunks = [];
                    
                    for await (const chunk of audioStream) {
                        chunks.push(chunk);
                    }
                    
                    const audioBuffer = Buffer.concat(chunks);
                    downloadUrl = `data:audio/mp4;base64,${audioBuffer.toString('base64')}`;
                } catch (error) {
                    console.error("ytdl-core error:", error);
                    await this.sock.sendMessage(chat, {
                        text: `❌ *All download sources failed. Please try again later.*`
                    }, { quoted: m });
                    return;
                }
            }

            // Send audio
            await this.sock.sendMessage(chat, {
                audio: { url: downloadUrl },
                mimetype: 'audio/mp4',
                fileName: `${title.replace(/[<>:"/\\|?*]/g, '')}.mp3`
            }, { quoted: m });

            // 🎶 Enjoy message with delay
            await delay(1500);
            await this.sock.sendMessage(chat, { 
                text: "🎶 *Enjoy the music and feel the vibes!*" 
            }, { quoted: m });

            // 🔹 Newsletter suggestion list (10 results, no URLs)
            const moreSongs = search.videos.slice(0, 10);
            const listMessage = {
                text: `📃 *More songs for:* ${text}\n\n` +
                      moreSongs.map((v, i) => 
                        `▶️ Play ${i+1}: ${v.title} — ${v.author?.name || "Unknown"}`
                      ).join("\n\n") +
                      `\n\nMade with ❤️‍🔥 by silentbyte music`,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterName: "SILENTBYTE MUSIC",
                        newsletterJid: "120363406453808987@newsletter"
                    }
                }
            };

            await this.sock.sendMessage(chat, listMessage);

        } catch (error) {
            console.error('Error during /play command:', error);
            await this.sock.sendMessage(chat, {
                text: `⚠️ *An error occurred while processing your request. Please try again later.*`
            }, { quoted: m });
        }
    }
    
    // FIXED: MUSIC LIST COMMAND
    async musicList(text, m, chat) {
        if (!text) {
            await this.sock.sendMessage(chat, {
                text: `*Example*: ${this.prefix}musiclist omah lay`
            }, { quoted: m });
            return;
        }

        try {
            // React to the message with a music note emoji before starting
            await this.sock.sendMessage(chat, { react: { text: `🎵`, key: m.key } });

            const search = await yts(text);
            const videos = search.videos.slice(0, 10); // Get first 10 results

            if (!videos.length) {
                await this.sock.sendMessage(chat, {
                    text: `*No results found for:* ${text}`
                }, { quoted: m });
                return;
            }

            // Create the list of songs
            let listMessage = `*SILENTBYTE MUSIC LIST*\n` +
                `• 🔎 Search Query: ${text}\n` +
                `• 📋 Found ${videos.length} results:\n\n`;

            for (let i = 0; i < videos.length; i++) {
                const video = videos[i];
                try {
                    const apiUrl = `${apis.music.keith.mp3}?url=${encodeURIComponent(video.url)}`;
                    const apiResponse = await axios.get(apiUrl, { timeout: 10000 });

                    if (apiResponse.data.status) {
                        const { downloadUrl } = apiResponse.data.result;
                        listMessage += `🎵 ${i + 1}. *${video.title}*\n` +
                            `   👤 Artist: ${video.author.name}\n` +
                            `   ⏳ Duration: ${video.timestamp}\n` +
                            `   👀 Views: ${video.views}\n` +
                            `   🔗 Download: ${downloadUrl ? 'Available ✅' : 'Not available ❌'}\n\n`;
                    } else {
                        listMessage += `🎵 ${i + 1}. *${video.title}* (No download link found)\n\n`;
                    }
                } catch {
                    listMessage += `🎵 ${i + 1}. *${video.title}* (API error)\n\n`;
                }
            }

            listMessage += `💡 To download directly, use: *${this.prefix}play [song name]*\n\n` +
                `📰 Powered by *SILENTBYTE MUSIC BOT*\n👨‍💻 Developed by *silentbyte music*`;

            // Send the list as a message with newsletter info
            await this.sock.sendMessage(chat, {
                text: listMessage,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterName: "SILENTBYTE MUSIC",
                        newsletterJid: "120363406453808987@newsletter"
                    }
                }
            }, { quoted: m });

        } catch (error) {
            console.error('Error during musiclist command:', error);
            await this.sock.sendMessage(chat, {
                text: `*An error occurred while processing your request. Please try again later.*`
            }, { quoted: m });
        }
    }
    
    // FIXED: VIDEO DOWNLOAD COMMAND
    async downloadVideo(text, m, chat) {
        if (!text) {
            await this.sock.sendMessage(chat, {
                text: `🎬 *Usage Example:*\n${this.prefix}video Faded by Alan Walker\n\n💡 *Please provide a video title or artist name*`
            }, { quoted: m });
            return;
        }

        try {
            // Initial reaction
            await this.sock.sendMessage(chat, { react: { text: `⏳`, key: m?.key } });

            let search = await yts(text);
            let video = search.videos[0];

            if (!video) {
                await this.sock.sendMessage(chat, { react: { text: `❌`, key: m?.key } });
                await this.sock.sendMessage(chat, {
                    text: `🔍 *No video results found for:* "${text}"\n\n✨ *Try searching with different keywords*`
                }, { quoted: m });
                return;
            }

            // Update reaction to searching
            await this.sock.sendMessage(chat, { react: { text: `🔍`, key: m?.key } });

            // Professional video info box
            let body = `🎬 *SILENTBYTE VIDEO PLAYER*\n` +
                `• 📋 Title: ${video.title}\n` +
                `• 👁️ Views: ${video.views.toLocaleString()}\n` +
                `• ⏱️ Duration: ${video.timestamp}\n` +
                `• 📅 Uploaded: ${video.ago}\n` +
                `• 🔗 URL: ${video.url}\n` +
                `• 💫 Powered by silentbyte music`;

            // Send video thumbnail and info
            await this.sock.sendMessage(chat, {
                image: { url: video.thumbnail },
                caption: body
            }, { quoted: m });

            // Update reaction to downloading
            await this.sock.sendMessage(chat, { react: { text: `⬇️`, key: m?.key } });

            // Video download API
            const apiUrl = `${apis.music.keith.video}?url=${encodeURIComponent(video.url)}`;
            const apiResponse = await axios.get(apiUrl, { timeout: 30000 });

            if (apiResponse.data.status && apiResponse.data.result) {
                const downloadUrl = apiResponse.data.result;
                
                // Final reaction - processing
                await this.sock.sendMessage(chat, { react: { text: `🔄`, key: m?.key } });

                // Send the video file
                await this.sock.sendMessage(chat, {
                    video: { 
                        url: downloadUrl 
                    },
                    mimetype: 'video/mp4',
                    caption: `✅ *VIDEO READY*\n` +
                            `• 🎥 Title: ${video.title}\n` +
                            `• ⏱️ Duration: ${video.timestamp}\n` +
                            `• 💫 Powered by silentbyte music\n` +
                            `• 🤖 Processed by Silentbyte Music Bot`
                }, { quoted: m });

                // Success reaction
                await this.sock.sendMessage(chat, { react: { text: `✅`, key: m?.key } });

                // Final completion message
                await this.sock.sendMessage(chat, {
                    text: `✨ *Your video request has been completed successfully!*\n` +
                         `🎬 *Processed by Silentbyte Music Bot*\n` +
                         `💫 *Thank you for using our services*`
                }, { quoted: m });

            } else {
                await this.sock.sendMessage(chat, { react: { text: `❌`, key: m?.key } });
                await this.sock.sendMessage(chat, {
                    text: `❌ *Download Failed*\n\nUnable to fetch video content. Please try again later or try a different video.`
                }, { quoted: m });
            }

        } catch (error) {
            console.error('Video command error:', error);
            await this.sock.sendMessage(chat, { react: { text: `❌`, key: m?.key } });
            
            let errorMessage = `❌ *Processing Error*\nAn unexpected error occurred. Our team has been notified.`;
            
            if (error.response) {
                errorMessage = `❌ *API Error ${error.response.status}*\nService temporarily unavailable. Please try again in a few moments.`;
            } else if (error.request) {
                errorMessage = `❌ *Network Connection Error*\nPlease check your internet connection and try again.`;
            } else if (error.code === 'ECONNABORTED') {
                errorMessage = `❌ *Request Timeout*\nThe download is taking too long. Please try a different video.`;
            }
            
            await this.sock.sendMessage(chat, {
                text: errorMessage
            }, { quoted: m });
        }
    }
    
    // FIXED: APK DOWNLOAD COMMAND
    async downloadApk(text, m, chat) {
        if (!text) {
            await this.sock.sendMessage(chat, {
                text: `*Example:* ${this.prefix}apk WhatsApp`
            }, { quoted: m });
            return;
        }

        try {
            // Fetch APK data from the API
            const apiUrl = `${apis.apk.nexa}?apikey=63b406007be3e32b53&q=${encodeURIComponent(text)}`;
            const response = await axios.get(apiUrl, { timeout: 10000 });

            // Validate response
            if (!response.data || response.data.status !== 200 || !response.data.result) {
                await this.sock.sendMessage(chat, {
                    text: '❌ *Failed to fetch APK. Try again later.*'
                }, { quoted: m });
                return;
            }

            const { name, size, package: pkg, icon, dllink, lastup } = response.data.result;

            // Send APK details with thumbnail image
            await this.sock.sendMessage(chat, {
                image: { url: icon },
                caption: `📥 *APK Downloader*\n\n` +
                    `• 📌 Name: ${name}\n` +
                    `• 📦 Package: ${pkg}\n` +
                    `• 📂 Size: ${size}\n` +
                    `• 🕒 Last Update: ${lastup}\n\n` +
                    `*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ꜱɪʟᴇɴᴛʙʏᴛᴇ ᴍᴜꜱɪᴄ*`
            }, { quoted: m });

            // Send the APK file
            try {
                await this.sock.sendMessage(chat, {
                    document: { url: dllink },
                    mimetype: 'application/vnd.android.package-archive',
                    fileName: `${name.replace(/[<>:"/\\|?*]/g, '')}.apk`
                }, { quoted: m });
            } catch (err) {
                console.error('Error sending APK:', err);
                await this.sock.sendMessage(chat, {
                    text: '❌ *Failed to send APK file. It might be too large or restricted by WhatsApp.*'
                }, { quoted: m });
            }

        } catch (error) {
            console.error('Error in APK Downloader:', error?.response?.data || error.message);
            
            let errorMessage = '❌ *An unexpected error occurred. Try again later.*';
            
            if (error.code === 'ECONNABORTED') {
                errorMessage = '⚠️ *API request timed out. Please try again.*';
            } else if (error.response && error.response.status === 404) {
                errorMessage = '❌ *APK not found. Please check the name and try again.*';
            }
            
            await this.sock.sendMessage(chat, {
                text: errorMessage
            }, { quoted: m });
        }
    }
    
    async showSettings(query, msg, sender) {
        const isOwner = msg.key.participant?.includes(settings.get('owner')) || 
                       sender.includes(settings.get('owner'));
        
        if (!isOwner) {
            await this.sock.sendMessage(sender, {
                text: "❌ This command is only for the bot owner."
            }, { quoted: msg });
            return;
        }
        
        if (query) {
            // Handle setting updates
            const [key, value] = query.split('=');
            if (key && value !== undefined) {
                const validSettings = ['autoTyping', 'autoRecord', 'musicStatus', 'showDateInBio'];
                if (validSettings.includes(key)) {
                    const boolValue = value.toLowerCase() === 'true' || value === '1';
                    settings.set(key, boolValue || value);
                    
                    // Update bio if needed
                    if (key === 'showDateInBio' || key === 'musicStatus') {
                        await this.updateProfileStatus();
                    }
                    
                    await this.sock.sendMessage(sender, {
                        text: `✅ Setting updated: ${key} = ${value}`
                    }, { quoted: msg });
                } else {
                    await this.sock.sendMessage(sender, {
                        text: `❌ Invalid setting. Available: ${validSettings.join(', ')}`
                    }, { quoted: msg });
                }
            }
        } else {
            // Show current settings
            const currentSettings = settings.getAll();
            const settingsList = `
⚙️ *BOT SETTINGS*

*General Settings:*
• Owner: ${currentSettings.owner}
• Bot Name: ${currentSettings.botName}
• Version: ${currentSettings.version}
• Prefix: ${this.prefix}
• Language: ${currentSettings.language}

*Features:*
• 🎵 Music Status: ${currentSettings.musicStatus}
• ⌨️ Auto Typing: ${currentSettings.autoTyping ? '✅ ON' : '❌ OFF'}
• 🎤 Auto Record: ${currentSettings.autoRecord ? '✅ ON' : '❌ OFF'}
• 📅 Show Date in Bio: ${currentSettings.showDateInBio ? '✅ ON' : '❌ OFF'}

*Limits:*
• Max Downloads/Day: ${currentSettings.maxDownloadsPerDay}
• Welcome Msg: ${currentSettings.welcomeMessage ? '✅ ON' : '❌ OFF'}
• Goodbye Msg: ${currentSettings.goodbyeMessage ? '✅ ON' : '❌ OFF'}

*Usage:* ${this.prefix}settings <key>=<value>
*Example:* ${this.prefix}settings autoTyping=true
            `.trim();
            
            await this.sock.sendMessage(sender, { text: settingsList }, { quoted: msg });
        }
    }
    
    async updateProfileStatus() {
        try {
            const bio = settings.updateBio();
            await this.sock.updateProfileStatus(bio);
            console.log("✅ Profile status updated:", bio);
        } catch (error) {
            console.error("Error updating profile:", error);
        }
    }
    
    async showOwnerInfo(msg, sender) {
        const ownerInfo = `
👑 *BOT OWNER INFORMATION*

*Personal Details:*
• 👤 Name: ${settings.get('name')}
• 📞 Number: ${settings.get('owner')}
• 🤖 Bot: ${settings.get('botName')}
• 🏢 Company: SILENTBYTE INC

*Contact Information:*
• 🌐 Website: codewave-unit-force.zone.id
• 💻 GitHub: ${settings.get('github') || 'Not set'}
• 📧 Email: unitcodewave@gmail.com

*Bot Information:*
• ⚙️ Version: ${settings.get('version')}
• 📅 Created: 2026
• 💻 Language: JavaScript
• 🚀 Framework: Baileys

*Features Developed:*
✅ Music Downloader
✅ Video Downloader
✅ APK Downloader
⏳ Social Media Downloaders (Coming Soon)
✅ Auto Features
✅ Customizable Settings

*Quote:* "Technology is best when it brings people together."
        `.trim();
        
        await this.sock.sendMessage(sender, { text: ownerInfo }, { quoted: msg });
    }
    
    async showBotStatus(msg, sender) {
        const status = `
📊 *BOT STATUS REPORT*

*Connection Status:*
• 🔗 Status: ${this.isConnected ? 'Connected ✅' : 'Disconnected ❌'}
• 🏓 Ping: ${this.getUptime()}
• 📡 Server: WhatsApp Web
• 🔄 Last Update: ${new Date().toLocaleString()}

*Feature Status:*
• 🎵 Music System: ${settings.get('musicStatus')}
• ⌨️ Auto Typing: ${settings.get('autoTyping') ? 'Active ✅' : 'Inactive ❌'}
• 🎤 Auto Record: ${settings.get('autoRecord') ? 'Active ✅' : 'Inactive ❌'}
• 📅 Bio Updates: ${settings.get('showDateInBio') ? 'Active ✅' : 'Inactive ❌'}

*System Information:*
• 💾 Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
• ⏰ Uptime: ${this.getUptime()}
• 🚀 Node.js: ${process.version}
• 📁 Platform: ${process.platform}

*Commands Available:* ${this.commands.size}
*Social Media Features:* Coming Soon ⏳
        `.trim();
        
        await this.sock.sendMessage(sender, { text: status }, { quoted: msg });
    }
    
    async showStats(msg, sender) {
        const userStats = this.userStats[sender] || { commands: {} };
        const totalCommands = Object.values(userStats.commands).reduce((a, b) => a + b, 0);
        
        const stats = `
📈 *USAGE STATISTICS*

*Session Statistics:*
• 🕒 Session Start: ${this.startTime.toLocaleString()}
• ⏰ Current Uptime: ${this.getUptime()}
• 🔄 Restarts: 0
• 📊 Stability: 100%

*Your Command Usage:*
• 🎵 Music Plays: ${userStats.commands?.play || 0}
• 📹 Video Downloads: ${userStats.commands?.video || 0}
• 📱 APK Downloads: ${userStats.commands?.apk || 0}
• 💬 Total Commands: ${totalCommands}

*System Performance:*
• 💾 Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
• 📊 CPU Usage: ${process.cpuUsage().user / 1000000}s
• 🔗 Active Connections: 1
• ⚡ Response Time: < 1s

*Limits & Restrictions:*
• 📅 Daily Limit: ${settings.get('maxDownloadsPerDay')}
• 👥 Allowed Groups: ${settings.get('allowedGroups')?.length || 0}
• 👤 Blocked Users: ${settings.get('blockedUsers')?.length || 0}
• 🛡️ Anti-Spam: ${settings.get('antiSpam') ? 'Active ✅' : 'Inactive ❌'}

*Note:* Statistics reset on bot restart
        `.trim();
        
        await this.sock.sendMessage(sender, { text: stats }, { quoted: msg });
    }
    
    async restartBot(msg, sender) {
        const isOwner = sender.includes(settings.get('owner'));
        
        if (!isOwner) {
            await this.sock.sendMessage(sender, {
                text: "❌ This command is only for the bot owner."
            }, { quoted: msg });
            return;
        }
        
        await this.sock.sendMessage(sender, {
            text: "🔄 Restarting bot... Please wait."
        }, { quoted: msg });
        
        setTimeout(() => {
            process.exit(0);
        }, 2000);
    }
    
    updateStats(sender, command) {
        if (!this.userStats[sender]) {
            this.userStats[sender] = { commands: {} };
        }
        
        if (!this.userStats[sender].commands[command]) {
            this.userStats[sender].commands[command] = 0;
        }
        
        this.userStats[sender].commands[command]++;
    }
    
    getUptime() {
        const uptime = Date.now() - this.startTime;
        const seconds = Math.floor(uptime / 1000) % 60;
        const minutes = Math.floor(uptime / (1000 * 60)) % 60;
        const hours = Math.floor(uptime / (1000 * 60 * 60)) % 24;
        const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
        
        let uptimeString = '';
        if (days > 0) uptimeString += `${days}d `;
        if (hours > 0) uptimeString += `${hours}h `;
        if (minutes > 0) uptimeString += `${minutes}m `;
        uptimeString += `${seconds}s`;
        
        return uptimeString;
    }
    
    getText(msg) {
        const messageTypes = [
            'conversation',
            'extendedTextMessage',
            'imageMessage',
            'videoMessage',
            'audioMessage'
        ];
        
        for (const type of messageTypes) {
            if (msg.message?.[type]?.text) {
                return msg.message[type].text;
            }
        }
        
        // Check for buttons response
        if (msg.message?.buttonsResponseMessage?.selectedDisplayText) {
            return msg.message.buttonsResponseMessage.selectedDisplayText;
        }
        
        // Check for list response
        if (msg.message?.listResponseMessage?.title) {
            return msg.message.listResponseMessage.title;
        }
        
        return '';
    }
    
    async recordAudio(msg, sender) {
        // Audio recording logic here
        console.log("Audio recorded from:", sender);
    }
    
    loadCommands() {
        // Music commands
        this.commands.set('play', {
            description: 'Play music from YouTube',
            usage: '<song name>',
            category: 'music'
        });
        
        this.commands.set('musiclist', {
            description: 'Search for multiple songs',
            usage: '<query>',
            category: 'music'
        });
        
        this.commands.set('video', {
            description: 'Download video from YouTube',
            usage: '<query>',
            category: 'download'
        });
        
        this.commands.set('apk', {
            description: 'Download Android APK files',
            usage: '<app name>',
            category: 'download'
        });
        
        // Control commands
        this.commands.set('ping', {
            description: 'Check bot response time',
            usage: '',
            category: 'control'
        });
        
        this.commands.set('menu', {
            description: 'Show all commands',
            usage: '[section]',
            category: 'control'
        });
        
        this.commands.set('settings', {
            description: 'Bot settings (Owner only)',
            usage: '[key=value]',
            category: 'control'
        });
    }
    
    startPeriodicUpdates() {
        // Update bio every hour
        setInterval(async () => {
            if (settings.get('showDateInBio')) {
                await this.updateProfileStatus();
            }
        }, 3600000); // 1 hour
    }
    
    async setBotStatus() {
        // Set initial bot status
        await this.sock.sendPresenceUpdate('available');
        console.log("✅ Bot status set to online");
    }
}

// Start the bot
const bot = new SilentbyteMusicBot();

// Handle process events
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = SilentbyteMusicBot;