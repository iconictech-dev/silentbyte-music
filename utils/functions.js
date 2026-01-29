/* codewave unit force functions apis calls dawnload
This functions belong to silentbyte inc for api call keep it safe don't modified anything or copy paste 
*/
const fs = require('fs');
const path = require('path');
const settings = require('../settings.js');

class Functions {
    static formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    static sanitizeFileName(name) {
        return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_');
    }

    static getCurrentDateTime() {
        const now = new Date();
        return {
            date: now.toLocaleDateString('en-GB'),
            time: now.toLocaleTimeString('en-GB'),
            timestamp: now.getTime()
        };
    }

    static async downloadFile(url, filePath) {
        const axios = require('axios');
        const writer = fs.createWriteStream(filePath);
        
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });
        
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }

    static async checkApiHealth(apiUrl) {
        try {
            const axios = require('axios');
            const response = await axios.get(apiUrl, { timeout: 5000 });
            return response.status === 200;
        } catch {
            return false;
        }
    }

    static generateRandomId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    static createProgressBar(percentage, length = 20) {
        const filled = Math.round(length * (percentage / 100));
        const empty = length - filled;
        return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage.toFixed(1)}%`;
    }

    static async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static validateUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static extractVideoId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }
}

module.exports = Functions;

/* function found on 2025 from silentbyte ai database this base function.js work help apis call write by iconic tech himself */