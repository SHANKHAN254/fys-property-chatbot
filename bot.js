// bot.js

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const path = require('path');

// ----------------------------------------
// Configuration variables
// ----------------------------------------
let botName = "FY'S PROPERTY";
let openaiApiKey = "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"; // Preconfigured API key
const ADMIN_NUMBER = '254701339573@c.us'; // Correct admin WhatsApp number
const LOCAL_IMG_PATH = './IMG-20250401-WA0011.jpg'; // Local image file path

// In-memory storage for saved users and scheduled messages
let savedUsers = [];
let scheduledMessages = []; // Each element: { to, message, time }

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
                <h1>Welcome to ${botName}!</h1>
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
    return `${text}\n\n🔥 **${botName}** – Your ultimate development partner! 🚀\n✨ Let's build amazing apps together!`;
}

// ----------------------------------------
// Helper: Send image with caption
// ----------------------------------------
async function sendImageWithCaption(chatId, text) {
    try {
        // Fetch the image from a local file path
        const media = MessageMedia.fromFilePath(LOCAL_IMG_PATH);
        await client.sendMessage(chatId, media, { caption: buildCaption(text) });
    } catch (error) {
        console.error("Error sending image:", error);
        // Fallback: send just the text reply
        await client.sendMessage(chatId, buildCaption(text));
    }
}

// ----------------------------------------
// Helper: Check if the message is from a private chat
// ----------------------------------------
function isPrivateChat(message) {
    return !message.from.includes('-'); // Groups have a dash in the "from" field
}

// ----------------------------------------
// Admin Help Text
// ----------------------------------------
function adminHelpText() {
    return `
📣 *Admin Commands List* 📣

1) **admin** – Show this admin command list.
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

// When QR code is received
client.on('qr', (qr) => {
    console.log('QR RECEIVED - scan it from the webpage or console.');
    qrcode.toDataURL(qr, (err, url) => {
        if (!err) {
            latestQR = url;
        }
    });
});

// When client is ready
client.on('ready', () => {
    console.log(`${botName} is ready and deployed!`);
});

// When a message is received
client.on('message', async msg => {
    if (!isPrivateChat(msg)) return; // ignore group messages

    const sender = msg.from;
    const body = msg.body.trim();
    const lowerBody = body.toLowerCase();
    console.log(`Message from ${sender}: ${body}`);

    // ----------------------------
    // Admin Commands (no prefix needed)
    // ----------------------------
    if (sender === ADMIN_NUMBER) {
        // Show admin help if admin types "admin"
        if (lowerBody === 'admin') {
            await sendImageWithCaption(sender, adminHelpText());
            return;
        }
        // Set API key: setapikey <NEW_API_KEY>
        if (lowerBody.startsWith('setapikey ')) {
            openaiApiKey = body.substring(10).trim();
            await sendImageWithCaption(sender, "✅ OpenAI API Key updated successfully!");
            return;
        }
        // Set bot name: setname <New Bot Name>
        if (lowerBody.startsWith('setname ')) {
            botName = body.substring(8).trim();
            await sendImageWithCaption(sender, `✅ Bot name updated successfully! Now it's "${botName}"`);
            return;
        }
        // Save a user: saveuser <2547xxxxxx>
        if (lowerBody.startsWith('saveuser ')) {
            const newUser = body.substring(9).trim();
            if (!savedUsers.includes(newUser)) {
                savedUsers.push(newUser);
                await sendImageWithCaption(sender, `✅ User ${newUser} saved successfully!`);
            } else {
                await sendImageWithCaption(sender, `ℹ️ User ${newUser} is already saved.`);
            }
            return;
        }
        // Bulk messaging: bulk <Your message>
        if (lowerBody.startsWith('bulk ')) {
            const bulkMessage = body.substring(5).trim();
            if (savedUsers.length === 0) {
                await sendImageWithCaption(sender, "ℹ️ No saved users to send bulk messages.");
                return;
            }
            for (const user of savedUsers) {
                // Ensure the user number is in the proper format (append "@c.us" if needed)
                const formattedUser = user.includes('@c.us') ? user : `${user}@c.us`;
                await sendImageWithCaption(formattedUser, bulkMessage);
            }
            await sendImageWithCaption(sender, `✅ Bulk message sent to ${savedUsers.length} users.`);
            return;
        }
        // Schedule a message: schedule <2547xxxxxx> <YYYY-MM-DDTHH:mm:ss> <Your message>
        if (lowerBody.startsWith('schedule ')) {
            const parts = body.split(' ');
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
        // List saved users: listusers
        if (lowerBody === 'listusers') {
            if (savedUsers.length === 0) {
                await sendImageWithCaption(sender, "ℹ️ No saved users.");
            } else {
                const list = savedUsers.map((u, i) => `${i + 1}. ${u}`).join('\n');
                await sendImageWithCaption(sender, `📋 Saved Users:\n${list}\n\nTo remove a user, type: removeuser <index>`);
            }
            return;
        }
        // Remove a user: removeuser <index>
        if (lowerBody.startsWith('removeuser ')) {
            const index = parseInt(body.substring(11).trim());
            if (isNaN(index) || index < 1 || index > savedUsers.length) {
                await sendImageWithCaption(sender, "❌ Invalid index provided.");
            } else {
                const removed = savedUsers.splice(index - 1, 1);
                await sendImageWithCaption(sender, `✅ Removed user: ${removed}`);
            }
            return;
        }
    }

    // ----------------------------
    // User Commands (no prefix needed)
    // ----------------------------
    // If the user types "devhelp"
    if (lowerBody === 'devhelp') {
        await sendImageWithCaption(
            sender,
            "💡 Welcome to FY'S PROPERTY Development Support! Type 'support' if you need to chat with a human."
        );
        return;
    }

    // When the user requests support
    if (lowerBody.includes('support') || lowerBody.includes('help me') || lowerBody.includes('contact support')) {
        // Alert the admin (ensuring the admin ID is in the correct format)
        await sendImageWithCaption(
            ADMIN_NUMBER,
            `⚠️ User ${sender} is requesting support. Please reach out to them soon!`
        );
        // Notify the user with a friendly message
        await sendImageWithCaption(
            sender,
            "🙏 Thanks for reaching out! Our dedicated support team has been alerted and will contact you shortly."
        );
        return;
    }

    // Default reply for any other message
    await sendImageWithCaption(
        sender,
        "🤖 Hi there! I'm here to help you build amazing apps. Type 'devhelp' for development tips or 'support' if you need human assistance."
    );
});

// ----------------------------------------
// Periodic check for scheduled messages (every minute)
// ----------------------------------------
setInterval(async () => {
    const now = new Date();
    const dueMessages = scheduledMessages.filter(sch => now >= sch.time);
    for (const sch of dueMessages) {
        // Format user number to include "@c.us" if missing
        const formattedUser = sch.to.includes('@c.us') ? sch.to : `${sch.to}@c.us`;
        await sendImageWithCaption(formattedUser, sch.message);
        console.log(`Scheduled message sent to ${formattedUser}`);
    }
    scheduledMessages = scheduledMessages.filter(sch => now < sch.time);
}, 60 * 1000);

// ----------------------------------------
// Initialize the WhatsApp client
// ----------------------------------------
client.initialize();
