// bot.js

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const path = require('path');

// ----------------------------------------
// Configuration variables
// ----------------------------------------
let botName = "FY'S PROPERTY"; 
let openaiApiKey = ""; 
const ADMIN_NUMBER = '254701339573'; // Admin's WhatsApp number
const THUMB_URL = 'IMG-20250401-WA0011.jpg'; // The image to send as "thumbnail"

// In-memory storage for user data (demo purposes)
let savedUsers = [];
let scheduledMessages = []; // { to, message, time }

// ----------------------------------------
// Create WhatsApp client with local auth
// ----------------------------------------
const client = new Client({
    authStrategy: new LocalAuth()
});

// ----------------------------------------
// Express app for serving the QR code
// ----------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;
let latestQR = '';

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', async (req, res) => {
    if (!latestQR) {
        return res.send("<h1>QR Code is not generated yet. Please check your console.</h1>");
    }
    res.send(`
        <html>
            <head>
                <title>${botName} - Scan QR Code</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; background: #f9f9f9; }
                    h1 { color: #333; }
                    img { margin: 20px auto; border: 5px solid #ccc; border-radius: 10px; }
                </style>
            </head>
            <body>
                <h1>Welcome to ${botName}</h1>
                <p>Scan the QR Code below using WhatsApp to get started.</p>
                <img src="${latestQR}" alt="QR Code">
            </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
});

// ----------------------------------------
// Helper: Build the caption text
// ----------------------------------------
function buildCaption(text) {
    return `${text}\n\n🔥 **${botName}**: Your ultimate development support!\n✨ We are here to help you build amazing apps.`;
}

// ----------------------------------------
// Helper: Send image with caption (thumbnail style)
// ----------------------------------------
async function sendImageWithCaption(chatId, text) {
    try {
        // Try to fetch the image from the URL
        const media = await MessageMedia.fromUrl(THUMB_URL);
        await client.sendMessage(chatId, media, { caption: buildCaption(text) });
    } catch (error) {
        console.error("Error fetching or sending the image: ", error);
        // Fallback: just send the text if image fails
        await client.sendMessage(chatId, buildCaption(text));
    }
}

// ----------------------------------------
// Helper: Check if message is from private chat
// ----------------------------------------
function isPrivateChat(message) {
    // Group chats have a dash ('-') in their "from" field
    return !message.from.includes('-');
}

// ----------------------------------------
// Show admin commands
// ----------------------------------------
function adminHelpText() {
    return `
📣 *Admin Commands List* 📣

1) **admin** – Show this admin command list again.
2) **setapikey <NEW_API_KEY>** – Update the OpenAI API key.
3) **setname <New Bot Name>** – Change the bot name.
4) **saveuser <2547xxxxxx>** – Save a user number.
5) **bulk <Your message>** – Send a bulk message to all saved users.
6) **schedule <2547xxxxxx> <YYYY-MM-DDTHH:mm:ss> <Your message>** – Schedule a message.
7) **listusers** – View all saved users.
8) **removeuser <index>** – Remove a saved user by its list number.
`;
}

// ----------------------------------------
// WhatsApp Client Event Handlers
// ----------------------------------------

// 1) QR code received
client.on('qr', (qr) => {
    console.log('QR RECEIVED, scan it from the webpage or console.');
    qrcode.toDataURL(qr, (err, url) => {
        if (!err) {
            latestQR = url;
        }
    });
});

// 2) Client ready
client.on('ready', () => {
    console.log(`${botName} is ready and deployed!`);
});

// 3) Incoming messages
client.on('message', async msg => {
    if (!isPrivateChat(msg)) return; // ignore groups

    const sender = msg.from;
    const body = msg.body.trim().toLowerCase(); // for simpler matching
    console.log(`Message from ${sender}: ${msg.body}`);

    // If the sender is the admin
    if (sender.includes(ADMIN_NUMBER)) {
        // Admin typed "admin" => show commands
        if (body === 'admin') {
            await sendImageWithCaption(sender, adminHelpText());
            return;
        }

        // setapikey <NEW_API_KEY>
        if (body.startsWith('setapikey ')) {
            const newKey = msg.body.slice(9).trim(); // slice original msg.body
            openaiApiKey = newKey;
            await sendImageWithCaption(sender, "✅ OpenAI API Key updated successfully!");
            return;
        }

        // setname <New Bot Name>
        if (body.startsWith('setname ')) {
            const newName = msg.body.slice(8).trim(); // slice original msg.body
            botName = newName;
            await sendImageWithCaption(sender, `✅ Bot name updated successfully! Now it's "${botName}"`);
            return;
        }

        // saveuser <2547xxxxxx>
        if (body.startsWith('saveuser ')) {
            const newUser = msg.body.slice(8).trim(); // slice original msg.body
            if (!savedUsers.includes(newUser)) {
                savedUsers.push(newUser);
                await sendImageWithCaption(sender, `✅ User ${newUser} saved successfully!`);
            } else {
                await sendImageWithCaption(sender, `ℹ️ User ${newUser} is already saved.`);
            }
            return;
        }

        // bulk <Your message>
        if (body.startsWith('bulk ')) {
            const bulkMessage = msg.body.slice(5).trim();
            if (savedUsers.length === 0) {
                await sendImageWithCaption(sender, "ℹ️ No saved users to send bulk messages.");
                return;
            }
            for (const user of savedUsers) {
                await sendImageWithCaption(user, bulkMessage);
            }
            await sendImageWithCaption(sender, `✅ Bulk message sent to ${savedUsers.length} users.`);
            return;
        }

        // schedule <2547xxxxxx> <YYYY-MM-DDTHH:mm:ss> <Your message>
        if (body.startsWith('schedule ')) {
            const parts = msg.body.split(' ');
            if (parts.length < 4) {
                await sendImageWithCaption(sender, "❌ Invalid schedule format. Use: schedule <user> <ISO dateTime> <message>");
                return;
            }
            const scheduledUser = parts[1];
            const scheduledTime = new Date(parts[2]);
            if (isNaN(scheduledTime.getTime())) {
                await sendImageWithCaption(sender, "❌ Invalid date/time format. Please use ISO format (YYYY-MM-DDTHH:mm:ss)");
                return;
            }
            const scheduledMsg = parts.slice(3).join(' ');
            scheduledMessages.push({ to: scheduledUser, message: scheduledMsg, time: scheduledTime });
            await sendImageWithCaption(sender, `✅ Message scheduled for ${scheduledUser} at ${scheduledTime.toString()}`);
            return;
        }

        // listusers
        if (body === 'listusers') {
            if (savedUsers.length === 0) {
                await sendImageWithCaption(sender, "ℹ️ No saved users.");
            } else {
                const list = savedUsers.map((u, i) => `${i + 1}. ${u}`).join('\n');
                await sendImageWithCaption(
                    sender,
                    `📋 Saved Users:\n${list}\n\nTo remove a user, type: removeuser <index>`
                );
            }
            return;
        }

        // removeuser <index>
        if (body.startsWith('removeuser ')) {
            const index = parseInt(msg.body.slice(10).trim());
            if (isNaN(index) || index < 1 || index > savedUsers.length) {
                await sendImageWithCaption(sender, "❌ Invalid index provided.");
            } else {
                const removed = savedUsers.splice(index - 1, 1);
                await sendImageWithCaption(sender, `✅ Removed user: ${removed}`);
            }
            return;
        }
    }

    // ------------------------------------
    // Non-admin / user commands
    // ------------------------------------
    // If user specifically wants dev help
    if (body === 'devhelp') {
        await sendImageWithCaption(
            sender,
            "💡 Welcome to FY'S PROPERTY Development Support! Type 'support' if you need to chat with a human."
        );
        return;
    }

    // If user requests support in any phrasing
    if (body.includes('support') || body.includes('help me') || body.includes('contact support')) {
        // Alert admin
        await sendImageWithCaption(
            ADMIN_NUMBER,
            `⚠️ User ${sender} is requesting support. Please reach out to them soon!`
        );
        // Notify user
        await sendImageWithCaption(
            sender,
            "🙏 Thanks for reaching out! Our support team has been alerted and will contact you shortly."
        );
        return;
    }

    // Default fallback response for any other message
    await sendImageWithCaption(
        sender,
        "🤖 Hi there! I'm here to help you build amazing apps. Type 'devhelp' for dev support or 'support' if you need human assistance."
    );
});

// ----------------------------------------
// Periodic check for scheduled messages
// ----------------------------------------
setInterval(async () => {
    const now = new Date();
    // Filter out messages that are due and send them
    const dueMessages = scheduledMessages.filter(sch => now >= sch.time);
    for (const sch of dueMessages) {
        await sendImageWithCaption(sch.to, sch.message);
        console.log(`Scheduled message sent to ${sch.to}`);
    }
    // Remove sent messages from the list
    scheduledMessages = scheduledMessages.filter(sch => now < sch.time);
}, 60 * 1000);

// ----------------------------------------
// Initialize the WhatsApp client
// ----------------------------------------
client.initialize();
