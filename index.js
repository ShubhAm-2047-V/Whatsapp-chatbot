// ============================================================
//  SHUBDEEP LABS — ENTERPRISE CONVERSATIONAL AI AGENT
//  WhatsApp: Baileys Engine
//  AI Brain: Google Gemini API
// ============================================================

require("dotenv").config();
const http = require("http");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode-terminal");
const businessInfo = require("./business-info");
const { GEMINI_API_KEY, GEMINI_MODEL } = require("./config");

// ---------- CONFIG ----------
const PORT = process.env.PORT || 3000;
const IGNORE_GROUPS = true; // set false if you also want the bot to reply in groups
const FILTER_PERSONAL_MESSAGES = true; // true = skip casual friend/family chats, only answer business queries
const MAX_HISTORY_TURNS = 12;
const LEADS_FILE = path.join(__dirname, "leads.json");

// In-memory conversation state & message debounce queue
const chatHistory = new Map();
const messageQueue = new Map(); // chatId -> { timer, messages: [], senderName, msgKey }
let currentSock = null;
let isReconnecting = false;

// ------------------------------------------------------------
//  CLOUD HEALTH CHECK SERVER (For Render / Cloud 24/7 Hosting)
// ------------------------------------------------------------
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`
    <html>
      <head><title>ShubDeep Labs WhatsApp AI Bot</title></head>
      <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
        <div style="text-align: center; padding: 30px; background: #1e293b; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <h1 style="color: #34d399; margin-bottom: 10px;">⚡ ShubDeep Labs AI Agent</h1>
          <p style="color: #94a3b8; font-size: 16px;">WhatsApp Bot is <strong>LIVE & RUNNING 24/7</strong> in the cloud! 🚀</p>
        </div>
      </body>
    </html>
  `);
}).listen(PORT, () => {
  console.log(`🌐 Cloud Health Check server listening on port ${PORT}`);
});

// ------------------------------------------------------------
//  AUTOMATIC LEAD CAPTURE SYSTEM
// ------------------------------------------------------------
function saveLead(leadData) {
  try {
    let leads = [];
    if (fs.existsSync(LEADS_FILE)) {
      const raw = fs.readFileSync(LEADS_FILE, "utf-8");
      leads = JSON.parse(raw || "[]");
    }
    leads.unshift({
      id: Date.now().toString(36),
      timestamp: new Date().toISOString(),
      ...leadData,
    });
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), "utf-8");
    console.log(`🔥 [LEAD SAVED] Captured project inquiry from ${leadData.name || leadData.chatId}`);
  } catch (e) {
    console.warn("Could not save lead:", e.message);
  }
}

// ------------------------------------------------------------
//  INTENT CLASSIFIER (Business vs. Personal Message Filter)
// ------------------------------------------------------------
async function classifyMessageIntent(userMessage, history = []) {
  if (!FILTER_PERSONAL_MESSAGES) {
    return { isBusinessRelated: true, isLead: false, reason: "Filter disabled" };
  }

  const apiKey = (process.env.GEMINI_API_KEY || GEMINI_API_KEY || "").trim();
  const prompt = `You are an AI intent classifier for the WhatsApp account of "Shubdeep Labs".
Your objective is to determine whether an incoming WhatsApp message is a BUSINESS INQUIRY (services, pricing, websites, chatbots, tech support, general customer greeting, portfolio, founder/owner info, project quotes, name sharing) OR a PERSONAL / CASUAL message between friends, family, or personal acquaintances that the automated bot should SKIP.

--- BUSINESS CONTEXT ---
${businessInfo}
--- END BUSINESS CONTEXT ---

Recent Conversation Context:
${history.map((h) => `${h.role === "user" ? "Customer" : "Assistant"}: ${h.text}`).join("\n")}

Incoming Message: "${userMessage}"

RULES:
1. PERSONAL / CASUAL (isBusinessRelated: false):
   - Casual chit-chat between friends or family in ANY language (e.g. "kaha hai bhai", "dinner plan", "bhai call kar", "udya college la yenar ka", "kay kartos", "photo bhej", "mom ne kya bola").
2. BUSINESS / CUSTOMER INQUIRY (isBusinessRelated: true):
   - Any customer message asking about services, projects, pricing, websites, college projects, founder, or answering the bot's onboarding questions (e.g. sharing their name, project details, deadline).
   - Greetings from clients ("Hello", "Hi", "Hey", "Namaste", "Mala website pahije").

Respond ONLY with a valid JSON object matching this schema:
{
  "isBusinessRelated": boolean,
  "isLead": boolean,
  "reason": "Short 1-sentence explanation"
}`;

  const modelsToTry = [GEMINI_MODEL, "gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);

      return {
        isBusinessRelated: !!parsed.isBusinessRelated,
        isLead: !!parsed.isLead,
        reason: parsed.reason || "Classified by Gemini",
      };
    } catch (e) {
      // try fallback
    }
  }

  return { isBusinessRelated: true, isLead: false, reason: "Fallback default" };
}

// ------------------------------------------------------------
//  HIGH-LEVEL GEMINI CONVERSATIONAL ENGINE (STEP-BY-STEP FUNNEL)
// ------------------------------------------------------------
async function askGemini(userMessage, history = []) {
  const apiKey = (process.env.GEMINI_API_KEY || GEMINI_API_KEY || "").trim();
  if (!apiKey || apiKey === "PASTE_YOUR_FREE_API_KEY_HERE" || apiKey === "PASTE_YOUR_GEMINI_API_KEY_HERE") {
    throw new Error("Gemini API key is not configured! Please add your key in .env or config.js");
  }

  const systemInstruction = `You are the friendly, tech-savvy AI Client Coordinator for "ShubDeep Labs" on WhatsApp.

Your goal is to talk like a warm, engaging friend and guide the customer STEP-BY-STEP through a natural interactive conversation. 

CRITICAL CONVERSATIONAL RULES:
1. NEVER DUMP FULL PRICING LISTS OR MULTIPLE QUESTIONS AT ONCE.
   - Keep messages short (2 to 3 short sentences max) with lively emojis! ✨🚀
   - Ask only ONE single question at a time!

2. STEP-BY-STEP CONVERSATION FLOW:
   - **Step 1 (First contact / New inquiry)**:
     * Greet warmly with energy! 👋✨
     * Acknowledge what they said, and ask for their NAME first!
     *(Example: "Namaskar! 👋 ShubDeep Labs madhe tumcha khup swagat ahe! ✨ Website banavnyacha plan khup mast ahe! 🚀 Aadhi mala tumcha shubhnaav (Name) sangal ka please? 😊")*
   
   - **Step 2 (After they tell their name)**:
     * Call them by their name warmly! ("Great to meet you, [Name]! 😊🙌")
     * Ask what type of website/business they want to build (e.g. Online Store/Shop, Business Landing Page, Portfolio, or Custom Web App).
   
   - **Step 3 (After they describe their project)**:
     * Give the exact matching starting price tier for THAT specific project only! (e.g. "For a business website, our packages start at just ₹3,999 ✨").
     * Ask about their timeline/deadline or any specific special features they want.
   
   - **Step 4 (Final step)**:
     * Invite them to finalize requirements or schedule a 15-minute quick call with Founder Shubham Vernekar (+91 90288 33275) / shubdeeplabs@gmail.com! 📞🤝

3. DIRECT QUESTIONS:
   - If they specifically ask for "Website link", "Founder", or "Official Email", provide it crisply and warmly with emojis!

4. LANGUAGE MATCHING:
   - Always reply in the exact language the user used (Marathi, Hindi, Hinglish, English). Match their language with equal warmth and fluency!

--- KNOWLEDGE BASE REFERENCE ---
${businessInfo}
--- END KNOWLEDGE BASE ---`;

  const contents = [];
  for (const h of history) {
    contents.push({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.text }],
    });
  }
  contents.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  const modelsToTry = [GEMINI_MODEL, "gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (text.trim()) return text.trim();
    } catch (err) {
      console.warn(`[Gemini API] Failed with ${model}, trying fallback:`, err.message);
    }
  }

  throw new Error("Unable to get response from Gemini API");
}

// ------------------------------------------------------------
//  HUMAN-LIKE TYPING DELAY CALCULATOR
// ------------------------------------------------------------
function calculateHumanTypingTime(text) {
  const baseSpeed = text.length * 28;
  const jitter = Math.floor(Math.random() * 400) + 300;
  return Math.min(Math.max(baseSpeed + jitter, 1800), 4500);
}

// ------------------------------------------------------------
//  PROCESS BUFFERED INCOMING MESSAGES (DEBOUNCED BATCHING)
// ------------------------------------------------------------
async function processBatchedMessages(chatId, sock) {
  const queueData = messageQueue.get(chatId);
  if (!queueData || queueData.messages.length === 0) return;

  messageQueue.delete(chatId);

  const combinedText = queueData.messages.join("\n");
  const senderName = queueData.senderName;
  const lastMsgKey = queueData.msgKey;

  console.log(`📩 Processing [${senderName} (${chatId})]: "${combinedText.replace(/\n/g, " ")}"`);

  const history = chatHistory.get(chatId) || [];

  // 1. Intent Classification Check
  const classification = await classifyMessageIntent(combinedText, history);

  if (!classification.isBusinessRelated) {
    console.log(`⏩ [SKIPPED] Personal chat detected from ${senderName}: "${combinedText}" (Reason: ${classification.reason})`);
    return; // Do NOT reply to personal chat
  }

  // If flagged as lead inquiry, save to CRM file
  if (classification.isLead) {
    saveLead({
      name: senderName,
      chatId,
      inquiry: combinedText,
    });
  }

  // 2. Mark as read (blue ticks)
  try {
    if (lastMsgKey) await sock.readMessages([lastMsgKey]);
  } catch (e) {}

  // 3. Human reading delay (1.0 - 2.0s)
  const readingDelay = Math.min(Math.max(combinedText.length * 15, 1000), 2000);
  await new Promise((r) => setTimeout(r, readingDelay));

  // 4. Generate AI response from Gemini
  let reply;
  try {
    reply = await askGemini(combinedText, history);
  } catch (err) {
    console.error("Gemini error:", err.message);
    reply =
      "Sorry, I had a quick technical hiccup! 😅 Please feel free to reach out directly to Shubham at +91 90288 33275 or shubdeeplabs@gmail.com. 🚀";
  }

  if (!reply) {
    reply = "Hey there! 👋 Welcome to ShubDeep Labs! ✨ How can I help you with your project today? 😊";
  }

  // 5. Realistic Human Typing Simulation
  try {
    await sock.sendPresenceUpdate("composing", chatId);
  } catch (e) {}

  const typingDuration = calculateHumanTypingTime(reply);
  await new Promise((r) => setTimeout(r, typingDuration));

  try {
    await sock.sendPresenceUpdate("paused", chatId);
  } catch (e) {}

  await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));

  // 6. Send the message
  await sock.sendMessage(chatId, { text: reply });

  // 7. Save conversation history
  history.push({ role: "user", text: combinedText });
  history.push({ role: "assistant", text: reply });
  chatHistory.set(chatId, history.slice(-MAX_HISTORY_TURNS * 2));

  console.log(`🤖 [REPLIED] To ${senderName}: "${reply.replace(/\n/g, " ")}"`);
}

// ------------------------------------------------------------
//  START BOT
// ------------------------------------------------------------
async function startBot() {
  if (isReconnecting) return;
  isReconnecting = true;

  if (currentSock) {
    try {
      currentSock.ev.removeAllListeners();
      currentSock.end(undefined);
    } catch (e) {}
    currentSock = null;
  }

  console.log("⏳ Initializing WhatsApp session...");
  const { state: authState, saveCreds } = await useMultiFileAuthState("./auth_session");

  const sock = makeWASocket({
    auth: authState,
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    syncFullHistory: false,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
  });

  currentSock = sock;
  isReconnecting = false;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\nScan this QR code with WhatsApp (Linked Devices):\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

      if (isLoggedOut) {
        console.log("\n⚠️ WhatsApp session was logged out. Clearing old session to generate a fresh QR code...");
        try {
          fs.rmSync("./auth_session", { recursive: true, force: true });
        } catch (e) {}
        setTimeout(() => startBot(), 1500);
      } else {
        console.log(`Connection dropped (code: ${statusCode || 'unknown'}). Reconnecting in 3s...`);
        setTimeout(() => startBot(), 3000);
      }
    } else if (connection === "open") {
      console.log("\n===================================================");
      console.log("✅ Connected to WhatsApp! ShubDeep Labs AI Agent is LIVE.");
      console.log("===================================================\n");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;

        const chatId = msg.key.remoteJid;
        const senderName = msg.pushName || chatId.split("@")[0];

        if (IGNORE_GROUPS && chatId.endsWith("@g.us")) continue;

        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          "";

        if (!text.trim()) continue;

        const existing = messageQueue.get(chatId) || {
          timer: null,
          messages: [],
          senderName,
          msgKey: msg.key,
        };

        if (existing.timer) clearTimeout(existing.timer);

        existing.messages.push(text.trim());
        existing.senderName = senderName;
        existing.msgKey = msg.key;

        existing.timer = setTimeout(() => {
          processBatchedMessages(chatId, sock);
        }, 2200);

        messageQueue.set(chatId, existing);
      } catch (err) {
        console.error("Error queueing message:", err);
      }
    }
  });
}

console.log("\n===================================================");
console.log("  ShubDeep Labs — WhatsApp AI Agent");
console.log("===================================================\n");
console.log("[INFO] Starting WhatsApp Bot...");

startBot().catch((err) => console.error("Failed to start WhatsApp bot:", err));