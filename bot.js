// index.js

// 🔹 Load environment variables
require("dotenv").config();

const express = require("express");
const { default: makeWASocket, useSingleFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const axios = require("axios");
const fs = require("fs");

// OpenAI setup
const { Configuration, OpenAIApi } = require("openai");
const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

// 🔹 Use SESSION_ID from env
const SESSION_ID = process.env.SESSION_ID || "";
const SESSION_FILE = "./session.json";

if (SESSION_ID) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ creds: SESSION_ID }));
}

async function startBot() {
  const { state, saveState } = useSingleFileAuthState(SESSION_FILE);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, qr } = update;
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === "open") console.log("✅ LYRICAL XMD Connected!");
  });

  sock.ev.on("creds.update", saveState);

  // 🔹 Listen for messages
  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    if (text.startsWith("!hi")) {
      await sock.sendMessage(from, { text: "👋 Hi! I'm *Lyrical XMD*." });
    } else if (text.startsWith("!help")) {
      await sock.sendMessage(from, {
        text:
          "📌 *Lyrical Bot Commands*\n\n" +
          "👉 !hi - Greet\n" +
          "👉 !ai <prompt> - Chat with AI\n" +
          "👉 !ytmp3 <url> - Download YouTube MP3\n" +
          "👉 !ytmp4 <url> - Download YouTube MP4\n",
      });
    }

    // 🤖 AI Chat
    else if (text.startsWith("!ai")) {
      const prompt = text.replace("!ai", "").trim();
      if (!prompt) {
        return await sock.sendMessage(from, {
          text: "⚠️ Example: *!ai tell me a joke*",
        });
      }
      try {
        const response = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
        });
        const reply = response.data.choices[0].message.content;
        await sock.sendMessage(from, { text: reply });
      } catch (e) {
        await sock.sendMessage(from, { text: "❌ AI error: " + e.message });
      }
    }

    // 🎵 YouTube MP3
    else if (text.startsWith("!ytmp3")) {
      const url = text.split(" ")[1];
      if (!url)
        return await sock.sendMessage(from, {
          text: "⚠️ Usage: *!ytmp3 <YouTube_URL>*",
        });
      try {
        const api = `https://apis.davidcyriltech.my.id/youtube/mp3?url=${encodeURIComponent(
          url
        )}`;
        const res = await axios.get(api);
        if (res.data && res.data.result) {
          await sock.sendMessage(from, { text: `🎶 MP3 Link:\n${res.data.result}` });
        } else {
          await sock.sendMessage(from, { text: "❌ Could not fetch MP3." });
        }
      } catch (e) {
        await sock.sendMessage(from, { text: "❌ Error: " + e.message });
      }
    }

    // 📹 YouTube MP4
    else if (text.startsWith("!ytmp4")) {
      const url = text.split(" ")[1];
      if (!url)
        return await sock.sendMessage(from, {
          text: "⚠️ Usage: *!ytmp4 <YouTube_URL>*",
        });
      try {
        const api = `https://apis.davidcyriltech.my.id/youtube/mp4?url=${encodeURIComponent(
          url
        )}`;
        const res = await axios.get(api);
        if (res.data && res.data.result) {
          await sock.sendMessage(from, { text: `📺 MP4 Link:\n${res.data.result}` });
        } else {
          await sock.sendMessage(from, { text: "❌ Could not fetch MP4." });
        }
      } catch (e) {
        await sock.sendMessage(from, { text: "❌ Error: " + e.message });
      }
    }
  });
}

startBot();

// 🔹 Keep-alive server (important for Render)
const app = express();
app.get("/", (req, res) => {
  res.send("🤖 LYRICAL XMD Bot is running.");
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Keep-alive server on port ${PORT}`));
