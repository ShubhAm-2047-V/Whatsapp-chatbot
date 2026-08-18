// ============================================================
//  SHUBDEEP LABS — ENTERPRISE CONVERSATIONAL AI AGENT
//  WhatsApp: Baileys Engine
//  AI Brain: Google Gemini API
// ============================================================

require("dotenv").config();
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
//  INTENT CLASSIFIER (Strict Business vs. Personal Filter)
// ------------------------------------------------------------
async function classifyMessageIntent(userMessage, history = []) {
  if (!FILTER_PERSONAL_MESSAGES) {
    return { isBusinessRelated: true, isLead: false, reason: "Filter disabled" };
  }

  const cleanText = userMessage.trim().toLowerCase();

  // If there's NO previous business history and message is just a generic casual 1-word greeting, SKIP!
  // (Because friends often text "hi", "hello", "kasa ahes", "bhai")
  if (history.length === 0) {
    const genericCasualGreetings = [
      "hi", "hii", "hiii", "hello", "hey", "heyy", "namaste", "namaskar", 
      "kasa ahes", "kasa kay", "kay challay", "kaha hai", "kya chal raha", "bhai", "bro"
    ];
    if (genericCasualGreetings.includes(cleanText)) {
      return { 
        isBusinessRelated: false, 
        isLead: false, 
        reason: "Generic 1-word greeting without business context (likely a friend/personal contact)" 
      };
    }
  }

  const apiKey = (process.env.GEMINI_API_KEY || GEMINI_API_KEY || "").trim();
  const prompt = `You are a strict AI intent classifier for the WhatsApp account of "Shubdeep Labs".
Your objective is to determine whether an incoming WhatsApp message is a GENUINE BUSINESS INQUIRY or a PERSONAL / CASUAL message between friends, family, or personal acquaintances that the automated bot should SKIP.

--- BUSINESS CONTEXT ---
${businessInfo}
--- END BUSINESS CONTEXT ---

Recent Conversation Context:
${history.map((h) => `${h.role === "user" ? "Customer" : "Assistant"}: ${h.text}`).join("\n")}

Incoming Message: "${userMessage}"

STRICT CLASSIFICATION RULES:
1. PERSONAL / CASUAL (isBusinessRelated: false) -> SKIP:
   - Standalone casual greetings with no business inquiry ("hi", "hello", "kasa ahes", "kaha hai bhai", "call kar", "bhai dinner?", "udya yenar ka").
   - Friend/family chats in any language (English, Hindi, Marathi, etc.).
2. BUSINESS / CUSTOMER INQUIRY (isBusinessRelated: true) -> REPLY:
   - Inquiries mentioning software, website, app, AI bot, pricing, college/diploma/btech project, quote, portfolio, founder/owner inquiry, or business meeting.
   - Ongoing conversation where customer is providing their name, requirements, or deadline in response to the bot.

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

  return { isBusinessRelated: false, isLead: false, reason: "Fallback default safe skip" };
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
// Global process error handlers to prevent unexpected crashes
process.on("uncaughtException", (err) => {
  console.warn("⚠️ [RECOVERED] Uncaught Exception:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.warn("⚠️ [RECOVERED] Unhandled Rejection:", reason?.message || reason);
});

// ------------------------------------------------------------
async function processBatchedMessages(chatId, sock) {
  const queueData = messageQueue.get(chatId);
  if (!queueData || queueData.messages.length === 0) return;

  messageQueue.delete(chatId);

  const combinedText = queueData.messages.join("\n");
  const senderName = queueData.senderName;
  const lastMsgKey = queueData.msgKey;

  console.log(`📩 Processing [${senderName} (${chatId})]: "${combinedText.replace(/\n/g, " ")}"`);

  try {
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
      const activeSock = currentSock || sock;
      if (lastMsgKey && activeSock) await activeSock.readMessages([lastMsgKey]);
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
      const activeSock = currentSock || sock;
      if (activeSock) await activeSock.sendPresenceUpdate("composing", chatId);
    } catch (e) {}

    const typingDuration = calculateHumanTypingTime(reply);
    await new Promise((r) => setTimeout(r, typingDuration));

    try {
      const activeSock = currentSock || sock;
      if (activeSock) await activeSock.sendPresenceUpdate("paused", chatId);
    } catch (e) {}

    await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));

    // 6. Send the message with active socket & safety fallback
    const activeSock = currentSock || sock;
    if (activeSock) {
      await activeSock.sendMessage(chatId, { text: reply });

      // 7. Save conversation history
      history.push({ role: "user", text: combinedText });
      history.push({ role: "assistant", text: reply });
      chatHistory.set(chatId, history.slice(-MAX_HISTORY_TURNS * 2));

      console.log(`🤖 [REPLIED] To ${senderName}: "${reply.replace(/\n/g, " ")}"`);
    } else {
      console.warn(`⚠️ Could not send reply to ${senderName}: Socket is reconnecting.`);
    }
  } catch (err) {
    console.error(`⚠️ Error processing message for ${chatId}:`, err.message);
  }
}

// ------------------------------------------------------------
//  SESSION PERSISTENCE (Environment Variable Backup)
// ------------------------------------------------------------
function restoreSessionFromEnv() {
  const sessionData = process.env.SESSION_DATA;
  if (!sessionData) return;

  const authDir = path.join(__dirname, "auth_session");
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  try {
    const decoded = Buffer.from(sessionData, "base64").toString("utf-8");
    if (decoded.startsWith("{")) {
      const parsed = JSON.parse(decoded);
      if (parsed["creds.json"]) {
        for (const [filename, content] of Object.entries(parsed)) {
          fs.writeFileSync(path.join(authDir, filename), typeof content === "string" ? content : JSON.stringify(content), "utf-8");
        }
        console.log("🔑 Restored WhatsApp session files from SESSION_DATA environment variable!");
        return;
      } else if (parsed.noiseKey || parsed.account) {
        fs.writeFileSync(path.join(authDir, "creds.json"), decoded, "utf-8");
        console.log("🔑 Restored WhatsApp creds.json from SESSION_DATA environment variable!");
        return;
      }
    }
    fs.writeFileSync(path.join(authDir, "creds.json"), decoded, "utf-8");
    console.log("🔑 Restored WhatsApp creds.json from SESSION_DATA!");
  } catch (e) {
    console.warn("⚠️ Could not restore SESSION_DATA:", e.message);
  }
}

function exportSessionString() {
  const authDir = path.join(__dirname, "auth_session");
  if (!fs.existsSync(authDir)) return null;

  try {
    const credsPath = path.join(authDir, "creds.json");
    if (!fs.existsSync(credsPath)) return null;

    const data = {};
    const files = fs.readdirSync(authDir);
    for (const f of files) {
      if (f === "creds.json" || f.startsWith("app-state-sync-key")) {
        data[f] = fs.readFileSync(path.join(authDir, f), "utf-8");
      }
    }
    return Buffer.from(JSON.stringify(data)).toString("base64");
  } catch (e) {
    return null;
  }
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

  // Restore session from environment variable if available
  restoreSessionFromEnv();

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

      const sessionStr = exportSessionString();
      if (sessionStr && !process.env.SESSION_DATA) {
        console.log("💡 [SESSION BACKUP] To permanently prevent having to scan QR codes across redeploys, add this to your Render / Cloud Environment Variables:\n");
        console.log(`SESSION_DATA=${sessionStr}\n`);
        console.log("===================================================\n");
      }
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