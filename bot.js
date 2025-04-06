// bot.js

// Required modules
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Configuration variables
let botName = "FY'S PROPERTY"; // default bot name; admin can change it
let openaiApiKey = ""; // admin can update this via command
const ADMIN_NUMBER = '254701339573'; // set admin's WhatsApp number

// In-memory storage for saved users (persistent storage can be added later)
let savedUsers = [];
let scheduledMessages = []; // array of objects: {to, message, time}

// Create a new WhatsApp client with local authentication (session persistence)
const client = new Client({
    authStrategy: new LocalAuth()
});

// Express app for serving the QR code webpage
const app = express();
const PORT = process.env.PORT || 3000;
let latestQR = '';

// Serve static files if needed (e.g., CSS/JS for QR page)
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to show the QR code in a webpage
app.get('/', async (req, res) => {
    if (!latestQR) {
        return res.send("<h1>QR Code is not generated yet. Please check your console.</h1>");
    }
    // Generate an <img> tag with the QR code as a data URL
    res.send(`
        <html>
            <head>
                <title>${botName} - Scan QR Code</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                    h1 { color: #333; }
                    img { margin: 20px auto; }
                </style>
            </head>
            <body>
                <h1>Scan the QR Code to Login to ${botName}</h1>
                <img src="${latestQR}" alt="QR Code">
            </body>
        </html>
    `);
});

// Start Express server
app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
});

// Helper: Generate a beautiful advertising styled response (always appending the image link)
function createResponse(message) {
    // Add emojis and the image link in an attractive format
    return `${message}\n\n🔥 Check this out: ${botName} - https://iili.io/374CjBj.jpg 🚀✨`;
}

// Helper: Check if chat is a private chat (non-group)
function isPrivateChat(message) {
    // For whatsapp-web.js, group chats have a property "from" containing a dash ('-')
    return !message.from.includes('-');
}

// Client event: when QR code is received
client.on('qr', (qr) => {
    console.log('QR RECEIVED, scan it from the webpage or console.');
    // Convert the QR string to a data URL and update latestQR for webpage display
    qrcode.toDataURL(qr, (err, url) => {
        if (!err) {
            latestQR = url;
        }
    });
});

// Client event: when the client is ready
client.on('ready', () => {
    console.log(`${botName} is ready!`);
});

// Client event: on receiving a message
client.on('message', async msg => {
    // Process only private chats
    if (!isPrivateChat(msg)) return;

    const sender = msg.from; // sender's WhatsApp ID
    const body = msg.body.trim();
    console.log(`Message from ${sender}: ${body}`);

    // Admin commands without prefix (only if sender matches ADMIN_NUMBER)
    if (sender.includes(ADMIN_NUMBER)) {
        // Change OpenAI API Key: command: setapikey NEW_API_KEY
        if (body.startsWith('setapikey ')) {
            openaiApiKey = body.replace('setapikey ', '').trim();
            msg.reply(createResponse("✅ OpenAI API Key updated successfully!"));
            return;
        }
        // Change bot name: command: setname New Bot Name
        if (body.startsWith('setname ')) {
            botName = body.replace('setname ', '').trim();
            msg.reply(createResponse(`✅ Bot name updated successfully! Now it's "${botName}"`));
            return;
        }
        // Save a user number: command: saveuser 2547xxxxxx
        if (body.startsWith('saveuser ')) {
            let newUser = body.replace('saveuser ', '').trim();
            if (!savedUsers.includes(newUser)) {
                savedUsers.push(newUser);
                msg.reply(createResponse(`✅ User ${newUser} saved successfully!`));
            } else {
                msg.reply(createResponse(`ℹ️ User ${newUser} is already saved.`));
            }
            return;
        }
        // Bulk messaging: command: bulk Your message to send
        if (body.startsWith('bulk ')) {
            const bulkMessage = body.replace('bulk ', '').trim();
            savedUsers.forEach(user => {
                client.sendMessage(user, createResponse(bulkMessage));
            });
            msg.reply(createResponse(`✅ Bulk message sent to ${savedUsers.length} users.`));
            return;
        }
        // Schedule a message: command: schedule 2547xxxxxx YYYY-MM-DDTHH:mm:ss Message to schedule
        if (body.startsWith('schedule ')) {
            // Expect format: schedule <user> <ISO date time> <message>
            const parts = body.split(' ');
            if (parts.length < 4) {
                msg.reply(createResponse("❌ Invalid schedule format. Use: schedule <user> <ISO dateTime> <message>"));
                return;
            }
            const scheduledUser = parts[1];
            const scheduledTime = new Date(parts[2]);
            if (isNaN(scheduledTime.getTime())) {
                msg.reply(createResponse("❌ Invalid date/time format. Please use ISO format (YYYY-MM-DDTHH:mm:ss)"));
                return;
            }
            const scheduledMsg = parts.slice(3).join(' ');
            scheduledMessages.push({ to: scheduledUser, message: scheduledMsg, time: scheduledTime });
            msg.reply(createResponse(`✅ Message scheduled for ${scheduledUser} at ${scheduledTime.toString()}`));
            return;
        }
        // List saved users: command: listusers
        if (body === 'listusers') {
            if (savedUsers.length === 0) {
                msg.reply(createResponse("ℹ️ No saved users."));
            } else {
                const list = savedUsers.map((u, index) => `${index + 1}. ${u}`).join('\n');
                msg.reply(createResponse(`📋 Saved Users:\n${list}\n\nTo remove a user, type: removeuser <number>`));
            }
            return;
        }
        // Remove a saved user by index: command: removeuser 1
        if (body.startsWith('removeuser ')) {
            const index = parseInt(body.replace('removeuser ', '').trim());
            if (isNaN(index) || index < 1 || index > savedUsers.length) {
                msg.reply(createResponse("❌ Invalid index provided."));
            } else {
                const removed = savedUsers.splice(index - 1, 1);
                msg.reply(createResponse(`✅ Removed user: ${removed}`));
            }
            return;
        }
    } // end admin commands

    // User commands
    // If user asks to contact support (various phrasing)
    if (body.toLowerCase().includes("contact support") || body.toLowerCase().includes("help me") || body.toLowerCase().includes("support")) {
        // Alert the admin by sending a message to the admin number.
        client.sendMessage(ADMIN_NUMBER, createResponse(`⚠️ User ${sender} is requesting support. Please reach out to them soon!`));
        msg.reply(createResponse("🙏 Thanks for reaching out! Our support team has been alerted and will contact you shortly."));
        return;
    }

    // Development help command
    if (body === '!devhelp') {
        msg.reply(createResponse("💡 Welcome to FY'S PROPERTY Development Support!\n\nSend your development queries, and I'll try to help you build amazing apps. For support, type 'contact support'."));
        return;
    }

    // Default response for any other message
    msg.reply(createResponse("🤖 Hi there! I'm here to help you develop amazing apps. Type '!devhelp' for assistance or 'contact support' if you need human help."));
});

// Periodically check for scheduled messages (runs every minute)
setInterval(() => {
    const now = new Date();
    scheduledMessages = scheduledMessages.filter(sch => {
        if (now >= sch.time) {
            client.sendMessage(sch.to, createResponse(sch.message));
            console.log(`Scheduled message sent to ${sch.to}`);
            return false; // remove this scheduled message
        }
        return true; // keep if not yet time
    });
}, 60 * 1000);

// Initialize the client
client.initialize();
