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
const MAX_HISTORY_TURNS = 20;
const LEADS_FILE = path.join(__dirname, "leads.json");
const CHAT_HISTORY_FILE = path.join(__dirname, "data", "chat_history.json");

// Ensure data folder exists
if (!fs.existsSync(path.join(__dirname, "data"))) {
  fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
}

// In-memory debounce queue
const messageQueue = new Map(); // chatId -> { timer, messages: [], senderName, msgKey }
let currentSock = null;
let isReconnecting = false;

// ------------------------------------------------------------
//  PERSISTENT CHAT HISTORY STORAGE (Remembers 1-3+ Months)
// ------------------------------------------------------------
function loadAllChatHistory() {
  try {
    if (fs.existsSync(CHAT_HISTORY_FILE)) {
      const raw = fs.readFileSync(CHAT_HISTORY_FILE, "utf-8");
      return JSON.parse(raw || "{}");
    }
  } catch (e) {
    console.warn("⚠️ Could not load chat history file:", e.message);
  }
  return {};
}

function saveAllChatHistory(allData) {
  try {
    fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(allData, null, 2), "utf-8");
  } catch (e) {
    console.warn("⚠️ Could not write chat history file:", e.message);
  }
}

function getChatMemory(chatId) {
  const all = loadAllChatHistory();
  return all[chatId] || {
    name: "",
    firstContact: new Date().toISOString(),
    lastInteraction: 0,
    lastSender: "",
    isBusinessChat: false,
    followUpCount: 0,
    lastFollowUp: null,
    messages: [],
  };
}

function appendToChatMemory(chatId, role, text, senderName = "", isBusiness = true) {
  const all = loadAllChatHistory();
  const chat = all[chatId] || {
    name: senderName,
    firstContact: new Date().toISOString(),
    lastInteraction: Date.now(),
    lastSender: role,
    isBusinessChat: isBusiness,
    followUpCount: 0,
    lastFollowUp: null,
    messages: [],
  };

  if (senderName && !chat.name) chat.name = senderName;
  chat.lastInteraction = Date.now();
  chat.lastSender = role;
  if (isBusiness) chat.isBusinessChat = true;
  if (role === "user") chat.followUpCount = 0; // reset follow-up count if user responded

  chat.messages.push({
    role,
    text,
    timestamp: Date.now(),
  });

  // Keep last 40 message turns per contact
  if (chat.messages.length > MAX_HISTORY_TURNS * 2) {
    chat.messages = chat.messages.slice(-MAX_HISTORY_TURNS * 2);
  }

  all[chatId] = chat;
  saveAllChatHistory(all);
}

function formatTimeGap(lastTimestamp) {
  if (!lastTimestamp) return null;
  const diffMs = Date.now() - lastTimestamp;
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 60) {
    const months = Math.floor(diffDays / 30);
    return `${months} months`;
  }
  if (diffDays >= 30) {
    return "1 month";
  }
  if (diffDays >= 7) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} weeks`;
  }
  if (diffDays >= 2) {
    return `${diffDays} days`;
  }
  return null;
}

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
//  INTENT CLASSIFIER (Smart Business vs. Personal Filter)
// ------------------------------------------------------------
async function classifyMessageIntent(userMessage, history = [], lastSender = "") {
  if (!FILTER_PERSONAL_MESSAGES) {
    return { isBusinessRelated: true, isLead: false, reason: "Filter disabled" };
  }

  const cleanText = userMessage.trim().toLowerCase();

  // 1. If previous message from Assistant asked for Name/Requirements/Budget, ANY direct answer is VALID business response!
  const lastBotMsg = history.filter((h) => h.role === "assistant").pop()?.text || "";
  const isAnsweringBotPrompt = /name|tumcha shubhnaav|shubhnaav|naam|budget|project|website|app|requirements|timeline/i.test(lastBotMsg);

  if (isAnsweringBotPrompt && history.length > 0 && userMessage.trim().split(/\s+/).length <= 6) {
    return {
      isBusinessRelated: true,
      isLead: true,
      reason: "User is answering a direct question from the assistant (e.g. name or requirements)",
    };
  }

  // 2. If ongoing active conversation, don't drop replies
  if (history.length > 0) {
    const hasBusinessHistory = history.some((h) =>
      /website|app|software|bot|shubdeep|project|pricing|service|demo|contact/i.test(h.text)
    );
    if (hasBusinessHistory && !["bye", "goodnight", "gn"].includes(cleanText)) {
      return {
        isBusinessRelated: true,
        isLead: false,
        reason: "Ongoing business conversation continuation",
      };
    }
  }

  // 3. If there's NO history and it's just a generic 1-word greeting from a casual friend, skip
  if (history.length === 0) {
    const genericCasualGreetings = [
      "hi", "hii", "hiii", "hello", "hey", "heyy", "namaste", "namaskar", 
      "kasa ahes", "kasa kay", "kay challay", "kaha hai", "kya chal raha", "bhai", "bro"
    ];
    if (genericCasualGreetings.includes(cleanText)) {
      return { 
        isBusinessRelated: false, 
        isLead: false, 
        reason: "Generic 1-word greeting without business context" 
      };
    }
  }

  const apiKey = (process.env.GEMINI_API_KEY || GEMINI_API_KEY || "").trim();
  const prompt = `You are a strict AI intent classifier for the WhatsApp business account of "Shubdeep Labs".
Your objective is to determine whether an incoming WhatsApp message is a GENUINE BUSINESS INQUIRY or a PERSONAL / CASUAL message between friends/family.

--- BUSINESS CONTEXT ---
${businessInfo}
--- END BUSINESS CONTEXT ---

Recent Conversation Context:
${history.map((h) => `${h.role === "user" ? "Customer" : "Assistant"}: ${h.text}`).join("\n")}

Incoming Message: "${userMessage}"

STRICT CLASSIFICATION RULES:
1. BUSINESS / CUSTOMER INQUIRY (isBusinessRelated: true) -> REPLY:
   - Mentions software, website, app, AI bot, pricing, college/btech project, portfolio, founder inquiry, services.
   - Ongoing conversation where customer provides their name (e.g., "Deepa", "Rahul"), contact, or answers a question.
2. PERSONAL / CASUAL (isBusinessRelated: false) -> SKIP:
   - Pure friend/family casual talks ("kasa ahes", "dinner la yenar ka", "call kar bhai").

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
    } catch (e) {}
  }

  // If history exists, default to reply rather than skip
  return {
    isBusinessRelated: history.length > 0,
    isLead: false,
    reason: history.length > 0 ? "Defaulted to reply with history context" : "Fallback safe skip",
  };
}

// ------------------------------------------------------------
//  HIGH-LEVEL GEMINI CONVERSATIONAL ENGINE (STEP-BY-STEP FUNNEL)
// ------------------------------------------------------------
async function askGemini(userMessage, history = [], timeGap = null, clientName = "") {
  const apiKey = (process.env.GEMINI_API_KEY || GEMINI_API_KEY || "").trim();
  if (!apiKey || apiKey === "PASTE_YOUR_FREE_API_KEY_HERE" || apiKey === "PASTE_YOUR_GEMINI_API_KEY_HERE") {
    throw new Error("Gemini API key is not configured! Please add your key in .env or config.js");
  }

  let timeGapInstruction = "";
  if (timeGap) {
    timeGapInstruction = `
\n⚠️ TIME-GAP AWARENESS (LONG TIME NO SEE):
- The customer is replying after **${timeGap}**!
- Warmly greet them like an old acquaintance: "Hey ${clientName || 'there'}! 👋 So great to hear from you again! Hope you have been doing great! ✨ Where have you been? 😃"
- Briefly recall what you were discussing previously and invite them to pick up right where you left off!
`;
  }

  const systemInstruction = `You are the friendly, tech-savvy AI Client Coordinator for "ShubDeep Labs" on WhatsApp.

Your goal is to talk like a warm, engaging human partner and guide the customer STEP-BY-STEP through a natural interactive conversation. 
${timeGapInstruction}

CRITICAL CONVERSATIONAL RULES:
1. TALK LIKE A REAL HUMAN, NOT A ROBOT:
   - Speak naturally, directly, and warmly.
   - Keep messages short (2 to 3 short sentences max) with lively emojis! ✨🚀
   - Ask only ONE single question at a time!

2. STEP-BY-STEP CONVERSATION FLOW:
   - **Step 1 (First contact / New inquiry)**:
     * Greet warmly with energy! 👋✨
     * Acknowledge what they said, and ask for their NAME first!
     *(Example: "Namaskar! 👋 ShubDeep Labs madhe tumcha khup swagat ahe! ✨ Website banavnyacha plan khup mast ahe! 🚀 Aadhi mala tumcha shubhnaav (Name) sangal ka please? 😊")*
   
   - **Step 2 (After they tell their name, e.g. 'Deepa')**:
     * Call them by their name warmly! ("Great to meet you, [Name]! 😊🙌")
     * Ask what type of website/business they want to build (e.g. Online Store/Shop, Business Landing Page, Portfolio, or Custom Web App).
   
   - **Step 3 (When discussing pricing / quotation)**:
     * Give a natural ballpark estimate directly: *(e.g., "A custom gold e-commerce store with these features usually starts roughly around **₹9,999 to ₹14,999** ✨")*
     * In the next sentence, explain directly that since every shop has unique design and feature needs, the exact final cost depends on the specific requirements.
     * Offer to connect directly with the owner for the final quote: *(e.g., "Our founder, **Shubham Vernekar (+91 90288 33275)**, can share the exact final quote with you. Would you like a quick 5-minute chat with him to finalize? 📞🤝")*

3. NATURAL & DIRECT PRICING STYLE:
   - Do NOT use robotic legal disclaimer language (e.g., avoid "Please note that this is an estimated starting figure...").
   - Weave the estimate and owner contact smoothly and conversationally into the response.
   - Always quote a realistic range (e.g., ₹9,999 – ₹14,999) rather than a single fixed number, and directly introduce Shubham for the final quotation.

4. DIRECT QUESTIONS:
   - If they specifically ask for "Website link", "Founder", or "Official Email", provide it crisply and warmly with emojis!

5. LANGUAGE MATCHING:
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
    // 1. Load persistent chat memory
    const memory = getChatMemory(chatId);
    const history = memory.messages || [];
    const timeGap = formatTimeGap(memory.lastInteraction);

    // 2. Intent Classification Check
    const classification = await classifyMessageIntent(combinedText, history, memory.lastSender);

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

    // 3. Mark as read (blue ticks) immediately
    try {
      const activeSock = currentSock || sock;
      if (lastMsgKey && activeSock) await activeSock.readMessages([lastMsgKey]);
    } catch (e) {}

    // 4. Realistic short typing status while generating response
    try {
      const activeSock = currentSock || sock;
      if (activeSock) await activeSock.sendPresenceUpdate("composing", chatId);
    } catch (e) {}

    // 5. Generate AI response from Gemini with long-term memory & time-gap context
    let reply;
    try {
      reply = await askGemini(combinedText, history, timeGap, memory.name || senderName);
    } catch (err) {
      console.error("Gemini error:", err.message);
      reply =
        "Sorry, I had a quick technical hiccup! 😅 Please feel free to reach out directly to Shubham at +91 90288 33275 or shubdeeplabs@gmail.com. 🚀";
    }

    if (!reply) {
      reply = "Hey there! 👋 Welcome to ShubDeep Labs! ✨ How can I help you with your project today? 😊";
    }

    // 6. Brief realistic pause (400ms)
    await new Promise((r) => setTimeout(r, 400));

    // 7. Send the message immediately
    const activeSock = currentSock || sock;
    if (activeSock) {
      await activeSock.sendMessage(chatId, { text: reply });

      // 8. Persist to long-term memory file on disk
      appendToChatMemory(chatId, "user", combinedText, senderName, true);
      appendToChatMemory(chatId, "assistant", reply, senderName, true);

      console.log(`🤖 [REPLIED] To ${senderName}: "${reply.replace(/\n/g, " ")}"`);
    } else {
      console.warn(`⚠️ Could not send reply to ${senderName}: Socket is reconnecting.`);
    }
  } catch (err) {
    console.error(`⚠️ Error processing message for ${chatId}:`, err.message);
  }
}

// ------------------------------------------------------------
//  AUTOMATED POLITE FOLLOW-UP ENGINE (Re-engages Silent Leads)
// ------------------------------------------------------------
let followUpInterval = null;
function startFollowUpEngine() {
  if (followUpInterval) clearInterval(followUpInterval);

  console.log("⏰ Smart Follow-Up Engine initialized (Checks every 30 mins)");

  followUpInterval = setInterval(async () => {
    try {
      if (!currentSock) return;

      const allData = loadAllChatHistory();
      const now = Date.now();
      const HOURS_24 = 24 * 60 * 60 * 1000;
      const DAYS_5 = 5 * 24 * 60 * 60 * 1000;

      for (const [chatId, chat] of Object.entries(allData)) {
        if (!chat.isBusinessChat) continue;
        if (chat.lastSender !== "assistant") continue; // Client has not replied
        if ((chat.followUpCount || 0) >= 1) continue; // Only 1 polite follow-up nudge

        const timeSinceLastMsg = now - (chat.lastInteraction || 0);

        // Check if between 24 hours and 5 days of silence
        if (timeSinceLastMsg >= HOURS_24 && timeSinceLastMsg <= DAYS_5) {
          const clientName = chat.name ? chat.name.split(" ")[0] : "";
          const greetingName = clientName ? ` ${clientName}` : "";

          const followUpText = `Hey${greetingName}! 👋 Just checking in warmly to see if you had any questions or needed any help with your project? 😊 Whenever you're ready, feel free to drop a message! 🚀✨`;

          console.log(`⏰ [AUTO FOLLOW-UP] Sending polite nudge to ${chat.name || chatId}...`);

          try {
            await currentSock.sendMessage(chatId, { text: followUpText });

            chat.followUpCount = (chat.followUpCount || 0) + 1;
            chat.lastFollowUp = now;
            chat.lastInteraction = now;
            chat.messages.push({
              role: "assistant",
              text: followUpText,
              timestamp: now,
            });

            saveAllChatHistory(allData);
          } catch (sendErr) {
            console.warn(`Could not send follow-up to ${chatId}:`, sendErr.message);
          }
        }
      }
    } catch (err) {
      console.warn("⚠️ Follow-up engine error:", err.message);
    }
  }, 30 * 60 * 1000); // Run every 30 minutes
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

  // In-memory retry counter cache for Signal decryption retries
  const msgRetryCounterMap = new Map();
  const msgRetryCounterCache = {
    get: (key) => msgRetryCounterMap.get(key),
    set: (key, val) => msgRetryCounterMap.set(key, val),
    del: (key) => msgRetryCounterMap.delete(key),
  };

  const sock = makeWASocket({
    auth: authState,
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    syncFullHistory: false,
    msgRetryCounterCache,
    getMessage: async (key) => {
      return { conversation: "" };
    },
    browser: ["Windows", "Chrome", "122.0.0.0"],
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

      // Start automatic follow-up background engine
      startFollowUpEngine();
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
        }, 600); // 600ms debounce (fast instant response)

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