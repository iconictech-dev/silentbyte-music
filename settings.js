const fs = require('fs');
const path = require('path');

class SettingsManager {
    constructor() {
        this.settingsPath = path.join(__dirname, 'database', 'owner.json');
        this.settings = this.loadSettings();
    }
    
    loadSettings() {
        try {
            if (fs.existsSync(this.settingsPath)) {
                return JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
            }
            return {
                owner: "263786115435",
                name: "IconicTech-dev",
                botName: "SILENTBYTE MUSIC",
                version: "1.0.0",
                autoTyping: true,
                autoRecord: true,
                musicStatus: "active",
                showDateInBio: true,
                prefix: ".",
                language: "en",
                welcomeMessage: true,
                goodbyeMessage: true,
                antiSpam: true,
                maxDownloadsPerDay: 50,
                allowedGroups: [],
                blockedUsers: []
            };
        } catch (error) {
            console.error('Error loading settings:', error);
            return {};
        }
    }
    
    saveSettings() {
        try {
            fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }
    
    get(key) {
        return this.settings[key];
    }
    
    set(key, value) {
        this.settings[key] = value;
        return this.saveSettings();
    }
    
    getAll() {
        return this.settings;
    }
    
    updateBio() {
        const bio = [];
        
        if (this.settings.musicStatus === "active") {
            bio.push("🎵 Music: Active");
        }
        
        if (this.settings.autoTyping) {
            bio.push("⌨️ Auto Typing: ON");
        }
        
        if (this.settings.autoRecord) {
            bio.push("🎤 Auto Record: ON");
        }
        
        if (this.settings.showDateInBio) {
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            bio.push(`📅 ${dateStr}`);
        }
        
        return bio.join(" | ");
    }
}

module.exports = new SettingsManager();