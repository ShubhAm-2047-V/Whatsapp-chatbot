// ============================================================
//  SHUBDEEP LABS — ENTERPRISE CONVERSATIONAL AI AGENT
//  WhatsApp Engine: Baileys Multi-Device
//  AI Brain: Google Gemini Multimodal API (Text, Audio, Vision)
// ============================================================

require("dotenv").config();
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  downloadMediaMessage,
} = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode-terminal");
const businessInfo = require("./business-info");
const { GEMINI_API_KEY, GEMINI_API_KEYS, GEMINI_MODEL } = require("./config");
const { generateQuotationPDF } = require("./utils/pdfGenerator");
const { generatePaymentQR } = require("./utils/paymentQR");

// ---------- CONFIG & OWNER CONTACT ----------
const OWNER_PHONE = "+91 90288 33275";
const OWNER_JID = "919028833275@s.whatsapp.net";
const IGNORE_GROUPS = true;
const FILTER_PERSONAL_MESSAGES = true;
const MAX_HISTORY_TURNS = 20;

const DATA_DIR = path.join(__dirname, "data");
const KNOWLEDGE_DIR = path.join(__dirname, "data", "knowledge");
const LEADS_FILE = path.join(__dirname, "leads.json");
const CHAT_HISTORY_FILE = path.join(__dirname, "data", "chat_history.json");

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(KNOWLEDGE_DIR)) fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });

// In-memory queue & socket state
const messageQueue = new Map(); // chatId -> { timer, messages: [], mediaItems: [], senderName, msgKey }
let currentSock = null;
let isReconnecting = false;

// Filter noisy internal libsignal session debug logs (console.log, console.info, console.warn, console.error)
function isNoisyLog(arg) {
  if (typeof arg === "string") {
    return (
      arg.startsWith("Closing session") ||
      arg.startsWith("Closing open session") ||
      arg.startsWith("Opening session") ||
      arg.startsWith("Session error") ||
      arg.startsWith("Failed to decrypt") ||
      arg.startsWith("Session already")
    );
  }
  return false;
}

const origLog = console.log;
console.log = (...args) => {
  if (isNoisyLog(args[0])) return;
  origLog.apply(console, args);
};

const origInfo = console.info;
console.info = (...args) => {
  if (isNoisyLog(args[0])) return;
  origInfo.apply(console, args);
};

const origWarn = console.warn;
console.warn = (...args) => {
  if (isNoisyLog(args[0])) return;
  origWarn.apply(console, args);
};

const origError = console.error;
console.error = (...args) => {
  if (isNoisyLog(args[0])) return;
  origError.apply(console, args);
};

// Global process error handlers
process.on("uncaughtException", (err) => {
  console.warn("⚠️ [RECOVERED] Uncaught Exception:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.warn("⚠️ [RECOVERED] Unhandled Rejection:", reason?.message || reason);
});

// Admin state
const pausedChats = new Set();
const processedMsgKeys = new Set();

// ------------------------------------------------------------
//  DYNAMIC KNOWLEDGE BASE AUTO-LOADER (data/knowledge/)
// ------------------------------------------------------------
function loadDynamicKnowledge() {
  let extraKnowledge = "";
  try {
    if (fs.existsSync(KNOWLEDGE_DIR)) {
      const files = fs.readdirSync(KNOWLEDGE_DIR);
      for (const file of files) {
        if (file.endsWith(".md") || file.endsWith(".txt")) {
          const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf-8");
          extraKnowledge += `\n\n--- [ADDITIONAL KNOWLEDGE: ${file}] ---\n${content}\n`;
        }
      }
    }
  } catch (e) {
    console.warn("⚠️ Could not load dynamic knowledge files:", e.message);
  }
  return businessInfo + extraKnowledge;
}

// ------------------------------------------------------------
//  MULTI-KEY ROTATING & MULTI-MODEL FALLBACK ENGINE
// ------------------------------------------------------------
const GEMINI_MODELS = [
  GEMINI_MODEL,
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
];

function getAllApiKeys() {
  const envRaw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  const fromEnv = envRaw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k && !k.startsWith("PASTE_"));

  const combined = Array.from(new Set([...fromEnv, ...(GEMINI_API_KEYS || []), GEMINI_API_KEY].filter(Boolean)));
  return combined;
}

let activeKeyIndex = 0;

async function executeGeminiRequest(payload) {
  const keys = getAllApiKeys();
  if (keys.length === 0) {
    throw new Error("No Gemini API keys configured!");
  }

  const totalKeys = keys.length;
  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const keyIdx = (activeKeyIndex + attempt) % totalKeys;
    const key = keys[keyIdx];

    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.status === 429) {
          console.warn(`⚠️ [API KEY ROTATION] Key #${keyIdx + 1} quota limit reached (429). Rotating to next API key...`);
          activeKeyIndex = (keyIdx + 1) % totalKeys;
          break; // Break model loop, try next key immediately
        }

        if (!res.ok) continue;

        const data = await res.json();
        return data;
      } catch (err) {
        console.warn(`[Gemini API] Key #${keyIdx + 1} (${model}) error:`, err.message);
      }
    }
  }

  throw new Error("All Gemini API keys & fallback models are currently unavailable.");
}

// Helper to distinguish owner self-chats from real client chats
function isOwnerChatId(chatId, chat = null) {
  if (!chatId) return true;
  if (chatId === OWNER_JID) return true;
  const myJid = currentSock?.user?.id;
  const myLid = currentSock?.user?.lid;
  if (myJid && chatId.startsWith(myJid.split(":")[0])) return true;
  if (myLid && chatId === myLid) return true;
  const cleanPhone = chatId.split("@")[0].replace(/\D/g, "");
  if (cleanPhone === "919028833275" || cleanPhone === "9028833275") return true;
  if (chat && chat.name && /Shubham \(Owner\)/i.test(chat.name)) return true;
  return false;
}

// In-memory state for pending owner-approved quotes waiting for dispatch
const pendingQuoteDispatches = new Map(); // OWNER_JID -> { targetChatId, clientName, messageText, revisedPrice }
let lastActiveClientChatId = null;

function cleanAndParseJson(rawText) {
  if (!rawText) return null;
  try {
    let clean = String(rawText)
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }

    return JSON.parse(clean);
  } catch (e) {
    try {
      const relaxed = String(rawText)
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
        .replace(/'/g, '"');
      const firstBrace = relaxed.indexOf("{");
      const lastBrace = relaxed.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        return JSON.parse(relaxed.substring(firstBrace, lastBrace + 1));
      }
    } catch (e2) {}
    console.warn("⚠️ JSON parse warning:", e.message);
    return null;
  }
}

// ------------------------------------------------------------
//  LIVE WHATSAPP SELF-CONFIGURATION ENGINE (Train/Config via WhatsApp)
// ------------------------------------------------------------
async function handleOwnerConfiguration(userMessage) {
  const prompt = `You are the Live Configuration & Memory Engine for Shubham Vernekar's WhatsApp AI Agent.
Shubham is sending a direct message from his WhatsApp. Determine if he is instructing you to:
1. UPDATE PRICING (e.g. "Change basic website price to 5k", "Ecommerce starts at 15000 now")
2. ADD OR UPDATE SERVICES (e.g. "We now do Flutter mobile apps", "Add SEO audit service")
3. ADD BUSINESS RULES / INSTRUCTIONS (e.g. "Always offer 10% discount if they are students", "Reply in polite Marathi", "Do not mention discounts on Gold stores")
4. UPDATE CONTACT / COMPANY INFO (e.g. "New office address is Pune", "Office hours are 10am to 7pm")
5. ADD CUSTOM POLICIES / NOTES (e.g. "Remember we don't work on Sundays", "Delivery time is now 10 days")

Owner's Message: "${userMessage}"

If the message is a CONFIGURATION or INSTRUCTION update, respond ONLY with valid JSON:
{
  "isConfigUpdate": true,
  "category": "PRICING | SERVICE | RULE | CONTACT | POLICY | GENERAL",
  "ruleTitle": "Short title of the update",
  "ruleDetails": "Precise instruction for the AI bot to permanently remember and apply across all customer interactions",
  "confirmationMessage": "Warm, enthusiastic confirmation message to Shubham explaining what was updated in the bot's live brain! ✨"
}

If it is just a normal query (e.g. "Show me active chats", "Who is Deepa?", "Hello", "What is the status?"), respond with:
{
  "isConfigUpdate": false
}`;

  try {
    const data = await executeGeminiRequest({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 600,
        responseMimeType: "application/json",
      },
    });

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = cleanAndParseJson(raw);

    if (parsed && parsed.isConfigUpdate && parsed.ruleDetails) {
      const customRulesFile = path.join(KNOWLEDGE_DIR, "custom_rules.md");
      const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      const newEntry = `\n### [CUSTOM RULE: ${parsed.category || "GENERAL"}] ${parsed.ruleTitle || "Rule"} (Added: ${timestamp})\n${parsed.ruleDetails}\n`;

      fs.appendFileSync(customRulesFile, newEntry, "utf-8");
      console.log(`🧠 [LIVE CONFIG SAVED VIA WHATSAPP]: "${parsed.ruleTitle}"`);

      return parsed.confirmationMessage || `✅ *Configuration Updated Successfully!*\n\n• *Category:* ${parsed.category}\n• *Update:* ${parsed.ruleTitle}\n• *Details:* ${parsed.ruleDetails}\n\n_I have permanently saved this to my brain and will apply it to all customer chats!_ 🚀✨`;
    }
  } catch (e) {
    console.warn("Could not parse owner configuration:", e.message);
  }

  return null;
}

// ------------------------------------------------------------
//  CLIENT-SPECIFIC QUOTE, RULES & ACTION DISPATCH ENGINE
// ------------------------------------------------------------
async function handleClientQuoteOverride(userMessage, history = [], sock = null) {
  const allData = loadAllChatHistory();
  const knownClients = Object.entries(allData)
    .filter(([cid, c]) => !isOwnerChatId(cid, c))
    .map(([cid, c]) => ({
      chatId: cid,
      name: c.name || "Client",
      phone: cid.split("@")[0],
      project: c.messages?.filter((m) => m.role === "user").map((m) => m.text).join(" | ") || "",
    }));

  if (knownClients.length === 0) return null;

  const prompt = `You are an AI Executive Sales Assistant for Shubham Vernekar (Founder of ShubDeep Labs).
Shubham is sending a command in his WhatsApp console to send something to a client or customize terms/rules/quotation.

Recent Discussion Context with Owner:
${history.slice(-6).map((h) => `${h.role === "user" ? "Shubham" : "AI Assistant"}: ${h.text}`).join("\n")}

Known Active Clients in CRM:
${JSON.stringify(knownClients, null, 2)}

Owner's Command: "${userMessage}"

Determine if Shubham is instructing you to:
1. SEND A QUOTATION / REVISED PRICE (e.g. "quote Deepa 13000", "Send quotation of 13000 to her")
2. SEND RULES, TERMS & CONDITIONS / ONBOARDING (e.g. "Then send the rules and conditions to her", "Give her the terms and conditions", "Send rules to Deepa")
3. SEND CUSTOM MESSAGE / FOLLOW-UP TO CLIENT

Respond ONLY with valid JSON:
{
  "isActionMatched": boolean,
  "shouldAutoDispatch": boolean,
  "actionTitle": "Short title (e.g. Project Terms & Onboarding Guidelines / Revised Quotation)",
  "matchedChatId": "exact chatId string from known clients",
  "clientName": "Client Name",
  "proposedMessage": "Warm, highly professional WhatsApp message for the client in their language explaining the terms (50% advance booking ₹6,500, 2-3 weeks delivery, 100% full source code ownership, 30 days support) or quotation."
}`;

  try {
    const data = await executeGeminiRequest({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 800,
        responseMimeType: "application/json",
      },
    });

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed = cleanAndParseJson(raw);

    // Fallback: match keywords like "rules", "conditions", "terms", "deepa"
    if (!parsed || !parsed.matchedChatId) {
      const isRulesIntent = /rules|conditions|terms|onboarding/i.test(userMessage);
      const isQuoteIntent = /quotation|quote|\d{4,5}/i.test(userMessage);
      const matched = knownClients.find(c => /deepa/i.test(c.name)) || knownClients[0];

      if (matched && isRulesIntent) {
        parsed = {
          isActionMatched: true,
          shouldAutoDispatch: true,
          actionTitle: "Project Terms & Conditions",
          matchedChatId: matched.chatId,
          clientName: matched.name,
          proposedMessage: `Namaste ${matched.name.split(" ")[0]}! 👋✨ Here are the official project terms & onboarding guidelines for your Gold & Jewellery E-Commerce platform: 💎📋\n\n1️⃣ **Approved Investment:** Fixed at ₹13,000 for complete custom store with live daily rates, cart & payment gateway.\n2️⃣ **Booking Advance:** 50% advance payment (₹6,500) to lock your development slot & initiate UI design.\n3️⃣ **Delivery Timeline:** 2 to 3 weeks with live demo staging preview.\n4️⃣ **Source Code Ownership:** 100% full unencumbered code ownership & deployment upon final handover.\n5️⃣ **Post-Launch Support:** 30 days of free technical maintenance & training.\n\nShubham will share the official booking invoice & UPI payment QR link with you shortly! 🚀🤝`
        };
      } else if (matched && isQuoteIntent) {
        parsed = {
          isActionMatched: true,
          shouldAutoDispatch: true,
          actionTitle: "Revised Project Quotation",
          matchedChatId: matched.chatId,
          clientName: matched.name,
          proposedMessage: `Namaste ${matched.name.split(" ")[0]}! 👋✨ Following up on our discussion for your Gold & Jewellery E-Commerce website, our founder Shubham Vernekar has specially approved a revised quote of *₹13,000* for your complete platform with live rates, cart, and payment gateway! 🚀🤝 Would you like us to start the kickoff?`
        };
      }
    }

    if (parsed && (parsed.isActionMatched || parsed.isQuoteOverride) && parsed.matchedChatId) {
      lastActiveClientChatId = parsed.matchedChatId;

      // If Shubham instructed to send immediately -> DIRECTLY DISPATCH TO CLIENT ON WHATSAPP!
      if (parsed.shouldAutoDispatch && sock && parsed.proposedMessage) {
        await sock.sendMessage(parsed.matchedChatId, { text: parsed.proposedMessage });
        appendToChatMemory(parsed.matchedChatId, "assistant", parsed.proposedMessage, parsed.clientName, true);
        console.log(`🚀 [AUTO DISPATCHED TO CLIENT] Sent to ${parsed.clientName} (${parsed.matchedChatId})`);

        return (
`🚀 *[${(parsed.actionTitle || 'MESSAGE').toUpperCase()} SENT DIRECTLY TO ${parsed.clientName.toUpperCase()} ON WHATSAPP]* ✨

👤 *Client:* ${parsed.clientName} (+${parsed.matchedChatId.split("@")[0]})

💬 *Message Dispatched to Client:*
"${parsed.proposedMessage}"

_The client has received this message in their WhatsApp chat!_ 🤝`
        );
      }

      // Otherwise store pending dispatch and show proposed message
      pendingQuoteDispatches.set(OWNER_JID, {
        targetChatId: parsed.matchedChatId,
        clientName: parsed.clientName,
        messageText: parsed.proposedMessage,
        revisedPrice: parsed.revisedPrice || "Custom",
      });

      const cleanPhone = parsed.matchedChatId.split("@")[0];

      return (
`🎯 *[${(parsed.actionTitle || 'PROPOSED MESSAGE').toUpperCase()} FOR ${parsed.clientName.toUpperCase()}]* 💼

👤 *Client:* ${parsed.clientName} (+${cleanPhone})

💬 *Proposed Message for ${parsed.clientName}:*
"${parsed.proposedMessage}"

━━━━━━━━━━━━━━━━━━━━
👉 _To send this directly to ${parsed.clientName} on WhatsApp, simply reply:_ *Send to ${parsed.clientName.split(" ")[0]}* (or *Yes*)`
      );
    }
  } catch (e) {
    console.warn("Could not process client action:", e.message);
  }

  return null;
}

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
    priority: "WARM",
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
    priority: "WARM",
    followUpCount: 0,
    lastFollowUp: null,
    messages: [],
  };

  if (senderName && !chat.name) chat.name = senderName;
  chat.lastInteraction = Date.now();
  chat.lastSender = role;
  if (isBusiness) chat.isBusinessChat = true;
  if (role === "user") chat.followUpCount = 0;

  chat.messages.push({
    role,
    text,
    timestamp: Date.now(),
  });

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
  if (diffDays >= 30) return "1 month";
  if (diffDays >= 7) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} weeks`;
  }
  if (diffDays >= 2) return `${diffDays} days`;
  return null;
}

function isOutsideBusinessHours() {
  const istHour = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).getHours();
  return istHour < 9 || istHour >= 20; // Outside 9:00 AM - 8:00 PM IST
}

// ------------------------------------------------------------
//  INTELLIGENT PROJECT REQUIREMENT EXTRACTOR
// ------------------------------------------------------------
async function extractProjectRequirement(history = [], currentText = "") {
  const userMessages = history.filter((h) => h.role === "user").map((h) => h.text);
  if (currentText) userMessages.push(currentText);

  if (userMessages.length === 0) return currentText || "General Software Inquiry";

  const allUserText = userMessages.join(" | ");

  // Fast pattern recognition
  if (/gold|jewel|ornament/i.test(allUserText)) {
    return "Gold / Jewelry E-Commerce Website (Live rates, Cart, Payment Gateway)";
  }
  if (/hospital|clinic|doctor|patient|opd/i.test(allUserText)) {
    return "Hospital / Clinic Management Core Desk";
  }
  if (/face|biometric|attendance/i.test(allUserText)) {
    return "Face Recognition Biometric Attendance System";
  }
  if (/chat\s*bot|ai\s*bot|agent|whatsapp bot/i.test(allUserText)) {
    return "Custom 24/7 AI WhatsApp / Web Support Agent";
  }
  if (/mobile app|android|flutter|ios/i.test(allUserText)) {
    return "Mobile App Development (Flutter / Android / iOS)";
  }
  if (/e-commerce|ecommerce|store|online shop|shopping/i.test(allUserText)) {
    return "E-Commerce Online Store with Payment Gateway";
  }
  if (/btech|diploma|college|project|mca|bca|academic|thesis|final year/i.test(allUserText)) {
    return "Academic / College Software Engineering Project";
  }
  if (/portfolio|personal website/i.test(allUserText)) {
    return "Personal Portfolio Website";
  }
  if (/website|landing page|web app|saas/i.test(allUserText)) {
    return "Custom Web Application / Business Landing Page";
  }

  // Ask Gemini for a crisp 1-line requirement title
  try {
    const data = await executeGeminiRequest({
      contents: [{
        role: "user",
        parts: [{ text: `Based on these customer inquiries: "${allUserText}", summarize what project the customer wants to build in 4 to 8 words (e.g. "Gold E-Commerce Website with Live Rates"). Return ONLY the short title.` }]
      }],
      generationConfig: { maxOutputTokens: 30, temperature: 0.1 }
    });
    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (summary) return summary.replace(/["\n]/g, "");
  } catch (e) {}

  return currentText;
}

// ------------------------------------------------------------
//  INTELLIGENT CHAT CONVERSATION SUMMARIZER
// ------------------------------------------------------------
async function generateChatSummary(history = [], currentText = "") {
  if (history.length === 0) return `• Initial message: "${currentText}"`;

  const conversationLines = history.slice(-12).map((h) => `${h.role === "user" ? "Client" : "Assistant"}: ${h.text}`);
  if (currentText) conversationLines.push(`Client: ${currentText}`);

  try {
    const data = await executeGeminiRequest({
      systemInstruction: {
        parts: [{
          text: "You are an executive CRM assistant. Output ONLY 2 to 3 bullet points starting immediately with '•'. Do NOT write any introduction or preamble like 'Here is a summary'. Directly start with '•'."
        }]
      },
      contents: [{
        role: "user",
        parts: [{ text: `Summarize this client sales chat into 2-3 crisp bullet points covering client needs, key features requested, and next action:\n\n${conversationLines.join("\n")}` }]
      }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.2 }
    });
    let summary = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    // Strip any filler text before the first bullet
    const bulletIndex = summary.indexOf("•");
    if (bulletIndex !== -1) {
      summary = summary.substring(bulletIndex).trim();
    }
    if (summary.length > 10) return summary;
  } catch (e) {}

  // Fallback if API fails
  const lastUserMessages = history.filter((h) => h.role === "user").slice(-3).map((h) => `• ${h.text}`);
  if (currentText) lastUserMessages.push(`• Latest: ${currentText}`);
  return lastUserMessages.join("\n");
}

// ------------------------------------------------------------
//  INSTANT OWNER NOTIFICATION DISPATCHER (WhatsApp Alert)
// ------------------------------------------------------------
async function notifyOwner(clientName, chatId, projectRequirement, chatSummary, latestMsg, priority = "HOT") {
  if (!currentSock) return;
  try {
    const cleanPhone = chatId.split("@")[0];
    const alertMessage = 
`🚨 *[${priority} LEAD NOTIFICATION]* 🚨

👤 *Client:* ${clientName || "New Client"}
📱 *WhatsApp:* +${cleanPhone}
💡 *Project Requirement:* ${projectRequirement}

📋 *Full Chat Summary:*
${chatSummary}

💬 *Latest Message:* "${latestMsg}"
⏰ *Time:* ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit' })}

👉 _Call or message the client now to close the deal!_ 🚀`;

    await currentSock.sendMessage(OWNER_JID, { text: alertMessage });
    console.log(`🔔 [OWNER ALERT DISPATCHED] Sent lead notification to Shubham Vernekar (${OWNER_PHONE})`);
  } catch (e) {
    console.warn("⚠️ Could not dispatch owner alert:", e.message);
  }
}

// ------------------------------------------------------------
//  AUTOMATIC LEAD CAPTURE & CRM STORAGE
// ------------------------------------------------------------
function saveLead(leadData) {
  try {
    let leads = [];
    if (fs.existsSync(LEADS_FILE)) {
      const raw = fs.readFileSync(LEADS_FILE, "utf-8");
      leads = JSON.parse(raw || "[]");
    }

    const newLead = {
      id: Date.now().toString(36),
      timestamp: new Date().toISOString(),
      priority: leadData.priority || "HOT",
      ...leadData,
    };

    leads.unshift(newLead);
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), "utf-8");
    console.log(`🔥 [LEAD CAPTURED] ${leadData.name || leadData.chatId} — Priority: ${newLead.priority}`);
  } catch (e) {
    console.warn("Could not save lead:", e.message);
  }
}

// ------------------------------------------------------------
//  INTENT CLASSIFIER (Smart Business vs. Personal Filter)
// ------------------------------------------------------------
async function classifyMessageIntent(userMessage, history = []) {
  if (!FILTER_PERSONAL_MESSAGES) {
    return { isBusinessRelated: true, isLead: false, priority: "WARM", reason: "Filter disabled" };
  }

  const cleanText = userMessage.trim().toLowerCase();

  // 1. Direct answer to Assistant question (Name, budget, etc.)
  const lastBotMsg = history.filter((h) => h.role === "assistant").pop()?.text || "";
  const isAnsweringBotPrompt = /name|tumcha shubhnaav|shubhnaav|naam|budget|project|website|app|requirements|timeline|cotation|price/i.test(lastBotMsg);

  if (isAnsweringBotPrompt && history.length > 0 && userMessage.trim().split(/\s+/).length <= 8) {
    return {
      isBusinessRelated: true,
      isLead: true,
      priority: "HOT",
      reason: "User is answering a direct business prompt from the assistant",
    };
  }

  // 2. Ongoing business conversation
  if (history.length > 0) {
    const hasBusinessHistory = history.some((h) =>
      /website|app|software|bot|shubdeep|project|pricing|service|demo|contact|call|shubham/i.test(h.text)
    );
    if (hasBusinessHistory && !["bye", "goodnight", "gn"].includes(cleanText)) {
      const isUrgent = /call|quickly|urgent|today|quote|cotation|price|payment|qr/i.test(cleanText);
      return {
        isBusinessRelated: true,
        isLead: isUrgent,
        priority: isUrgent ? "HOT" : "WARM",
        reason: "Ongoing business conversation continuation",
      };
    }
  }

  // 3. Generic 1-word greeting without history
  if (history.length === 0) {
    const genericCasualGreetings = [
      "hi", "hii", "hiii", "hello", "hey", "heyy", "namaste", "namaskar", 
      "kasa ahes", "kasa kay", "kay challay", "kaha hai", "kya chal raha", "bhai", "bro"
    ];
    if (genericCasualGreetings.includes(cleanText)) {
      return { 
        isBusinessRelated: false, 
        isLead: false, 
        priority: "COLD",
        reason: "Generic 1-word greeting without business context" 
      };
    }
  }

  const apiKey = (process.env.GEMINI_API_KEY || GEMINI_API_KEY || "").trim();
  const knowledge = loadDynamicKnowledge();
  const prompt = `You are a strict AI intent classifier for the WhatsApp business account of "Shubdeep Labs".
Your objective is to determine whether an incoming WhatsApp message is a GENUINE BUSINESS INQUIRY or a PERSONAL / CASUAL message between friends/family.

--- BUSINESS CONTEXT ---
${knowledge}
--- END BUSINESS CONTEXT ---

Recent Conversation Context:
${history.map((h) => `${h.role === "user" ? "Customer" : "Assistant"}: ${h.text}`).join("\n")}

Incoming Message: "${userMessage}"

RULES:
1. BUSINESS / INQUIRY (isBusinessRelated: true):
   - Inquiries about website, software, mobile apps, AI bots, pricing, college projects, portfolio, payment, quotations, or asking Shubham to call/message.
   - Ongoing conversation where customer provides their name (e.g., "Deepa"), requirements, or answers.
2. PERSONAL / CASUAL (isBusinessRelated: false):
   - Casual family/friend chit-chat ("kasa ahes", "dinner la yenar ka", "bhai call kar").

Respond ONLY with valid JSON:
{
  "isBusinessRelated": boolean,
  "isLead": boolean,
  "priority": "HOT" | "WARM" | "COLD",
  "reason": "Short 1-sentence explanation"
}`;

  try {
    const data = await executeGeminiRequest({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500,
        responseMimeType: "application/json",
      },
    });

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    return {
      isBusinessRelated: !!parsed.isBusinessRelated,
      isLead: !!parsed.isLead,
      priority: parsed.priority || "WARM",
      reason: parsed.reason || "Classified by Gemini",
    };
  } catch (e) {}

  return {
    isBusinessRelated: history.length > 0,
    isLead: false,
    priority: "WARM",
    reason: history.length > 0 ? "Defaulted to reply with history context" : "Fallback safe skip",
  };
}

// ------------------------------------------------------------
//  GEMINI MULTIMODAL ENGINE (Text, Vision & Voice Notes)
// ------------------------------------------------------------
async function askGemini(userMessage, history = [], options = {}) {
  const apiKey = (process.env.GEMINI_API_KEY || GEMINI_API_KEY || "").trim();
  if (!apiKey || apiKey === "PASTE_YOUR_FREE_API_KEY_HERE") {
    throw new Error("Gemini API key is not configured! Please add your key in .env or config.js");
  }

  const { timeGap, clientName, mediaBuffers = [], isOwner = false, approvedQuote = null } = options;
  const knowledge = loadDynamicKnowledge();

  let systemInstruction = "";

  if (isOwner) {
    const allData = loadAllChatHistory();
    const crmSummary = Object.entries(allData)
      .filter(([cid, c]) => !isOwnerChatId(cid, c))
      .map(([cid, c]) => {
        const phone = cid.split("@")[0];
        const quoteNote = c.approvedQuote ? ` [Owner Approved Quote: ${c.approvedQuote}]` : "";
        const clientMsgs = (c.messages || [])
          .slice(-10)
          .map((m) => `    ${m.role === "user" ? "Client" : "AI Assistant"}: "${m.text}"`)
          .join("\n");

        return (
`============================================================
CLIENT RECORD: ${c.name || "Client"} (+${phone})
• Priority: ${c.priority || "WARM"} | Lead Status: ${c.isBusinessChat ? "Active Business Lead 🔥" : "Casual Chat"}${quoteNote}
• Last Active: ${new Date(c.lastInteraction).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
• Conversation History & Requirements Discussed:
${clientMsgs || "    No message history."}
============================================================`
        );
      })
      .join("\n\n");

    systemInstruction = `You are the brilliant, highly intelligent Executive AI Chief of Staff for Shubham Vernekar, the Founder & Owner of ShubDeep Labs.
You have real-time, live access to all active client conversations, project specifications, quotations, and leads in the company CRM.

--- LIVE CRM CLIENT DATABASE & CONVERSATION TRANSCRIPTS ---
${crmSummary || "No active client conversations yet."}
--- END CRM DATABASE ---

KNOWLEDGE BASE REFERENCE:
${knowledge}

CORE DIRECTIVES WHEN TALKING TO SHUBHAM:
1. BE PROACTIVE, CRISP & INCREDIBLY CLEVER:
   - When Shubham asks about ANY client (e.g. "What's the status of Deepa", "Tell me about Deepa", "Who wants a gold website?"), match their name or requirements immediately from the database above (e.g. "Deepa" matches "Deepa Dinesh Vernekar").
   - Give a rich, intelligent status summary:
     * 👤 **Client Name & Phone:** (e.g. Deepa Dinesh Vernekar +112666236477622)
     * 💡 **Project Scope & Requirements:** (e.g. Gold E-Commerce Website with live daily rates, shopping cart, customer login, payment gateway)
     * 💰 **Quotation Status:** (e.g. Ballpark quoted: ₹9,999 – ₹14,999 or Owner approved quote)
     * 🔥 **Lead Priority & Urgency:** (e.g. HOT — Client has repeatedly requested an urgent callback to finalize)
     * 💬 **Last Message & Time:**
     * 🎯 **Next Recommended Step:**
   - NEVER be vague or ask Shubham "which Deepa do you mean? A team member or client?". You already have all the client records right in front of you!
2. GENERAL QUERIES & COMMANDS:
   - When asked for "all leads" or "active chats", provide a clean, organized bulleted list with client names, project topics, and phone numbers.
   - Speak naturally with executive professionalism and warmth (English, Marathi, Hindi).`;
  } else {
    let approvedQuoteInstruction = "";
    if (approvedQuote) {
      approvedQuoteInstruction = `
\n🎯 FOUNDER-APPROVED SPECIAL QUOTE:
- Founder Shubham Vernekar has officially approved an exclusive custom package rate of **${approvedQuote}** specifically for this client (${clientName || 'Valued Client'})!
- When discussing pricing, quote this exact price (${approvedQuote}) as a special approved rate from the founder!
`;
    }

    let timeGapInstruction = "";
    if (timeGap) {
      timeGapInstruction = `
\n⚠️ TIME-GAP AWARENESS:
- The customer is replying after **${timeGap}**!
- Warmly greet them like an old friend: "Hey ${clientName || 'there'}! 👋 So great to hear from you again! Hope you have been doing great! ✨ Where have you been? 😃"
- Recall what you were discussing previously and invite them to pick up right where you left off!
`;
    }

    let nightInstruction = "";
    if (isOutsideBusinessHours() && history.length <= 2) {
      nightInstruction = `
\n🌙 AFTER-HOURS LOGIC:
- It is currently outside our regular 9:00 AM – 8:00 PM IST office hours.
- Mention: "Our standard office hours are 9 AM – 8 PM, but I can connect you with Shubham right away if it's urgent! ✨ Would you prefer him to call/message you right now, or should we talk tomorrow morning at 10 AM? 📞😊"
`;
    }

    systemInstruction = `You are the friendly, tech-savvy AI Client Coordinator for "ShubDeep Labs" on WhatsApp.

Your goal is to talk like a warm, engaging human team member and guide the customer STEP-BY-STEP through a natural interactive conversation. 
${approvedQuoteInstruction}
${timeGapInstruction}
${nightInstruction}

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
   - Do NOT use robotic legal disclaimer language.
   - Weave the estimate and owner contact smoothly into the response.
   - Always quote a realistic range (e.g., ₹9,999 – ₹14,999) rather than a single fixed number.

4. DIRECT ANSWERS:
   - If they specifically ask for "Website link" (https://shubh-deep-labs.vercel.app), "Founder" (Shubham Vernekar), or "Official Email" (shubdeeplabs@gmail.com), provide it crisply and warmly with emojis!

5. LANGUAGE MATCHING:
   - Always reply in the exact language the user used (Marathi, Hindi, Hinglish, English). Match their language with equal warmth and fluency!

--- KNOWLEDGE BASE REFERENCE ---
${knowledge}
--- END KNOWLEDGE BASE ---`;
  }

  const contents = [];
  for (const h of history) {
    contents.push({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.text }],
    });
  }

  // Assemble current user turn (including any images or audio buffers)
  const currentParts = [];
  for (const media of mediaBuffers) {
    currentParts.push({
      inlineData: {
        mimeType: media.mimetype,
        data: media.buffer.toString("base64"),
      },
    });
  }
  if (userMessage.trim()) {
    currentParts.push({ text: userMessage });
  } else if (mediaBuffers.length > 0) {
    currentParts.push({ text: "Please review and analyze this media in the context of ShubDeep Labs software solutions." });
  }

  contents.push({ role: "user", parts: currentParts });

  const payload = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  };

  const data = await executeGeminiRequest(payload);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (text.trim()) return text.trim();

  throw new Error("Unable to get response from Gemini API");
}

// ------------------------------------------------------------
//  PROCESS BUFFERED INCOMING MESSAGES (DEBOUNCED BATCHING)
// ------------------------------------------------------------
async function processBatchedMessages(chatId, sock) {
  const queueData = messageQueue.get(chatId);
  if (!queueData || (queueData.messages.length === 0 && queueData.mediaItems.length === 0)) return;

  messageQueue.delete(chatId);

  const combinedText = queueData.messages.join("\n");
  const senderName = queueData.senderName;
  const lastMsgKey = queueData.msgKey;
  const mediaItems = queueData.mediaItems || [];

  console.log(`📩 Processing [${senderName} (${chatId})]: "${combinedText.replace(/\n/g, " ")}" (Media: ${mediaItems.length})`);

  try {
    const memory = getChatMemory(chatId);
    const history = memory.messages || [];
    const timeGap = formatTimeGap(memory.lastInteraction);
    const cleanCmd = combinedText.trim().toLowerCase();
    const activeSock = currentSock || sock;

    // 0. Admin Fast Commands (#stats, #pause, #resume, #help)
    const isSelfChat = !!queueData.isSelfChat || (chatId === OWNER_JID);
    const targetJid = isSelfChat ? OWNER_JID : chatId;

    if (cleanCmd.startsWith("#")) {
      if (cleanCmd === "#stats" || cleanCmd === "#leads") {
        const allData = loadAllChatHistory();
        const total = Object.keys(allData).length;
        const businessChats = Object.values(allData).filter((c) => c.isBusinessChat).length;
        const hotLeads = Object.values(allData).filter((c) => c.priority === "HOT").length;
        const statsReply = `📊 *[SHUBDEEP LABS AI STATS]* 📊\n\n• Total Active Chats: *${total}*\n• Business Inquiries: *${businessChats}*\n• Hot Leads: *${hotLeads}*\n• AI Engine: *Active & Online* ✅`;
        
        if (activeSock) {
          await activeSock.sendMessage(targetJid, { text: statsReply });
        }
        console.log(`📊 [ADMIN STATS DISPATCHED] Sent to ${targetJid}`);
        return;
      }
      if (cleanCmd === "#pause") {
        pausedChats.add(chatId);
        if (activeSock) {
          await activeSock.sendMessage(targetJid, { text: "⏸️ *AI Bot paused for this chat.* You can now chat directly. Send `#resume` anytime to turn AI back on." });
        }
        console.log(`⏸️ [PAUSED] AI Bot paused for ${chatId}`);
        return;
      }
      if (cleanCmd === "#resume") {
        pausedChats.delete(chatId);
        if (activeSock) {
          await activeSock.sendMessage(targetJid, { text: "▶️ *AI Bot resumed for this chat.*" });
        }
        console.log(`▶️ [RESUMED] AI Bot resumed for ${chatId}`);
        return;
      }
      if (cleanCmd === "#help" || cleanCmd === "#commands") {
        const helpReply = 
`🛠️ *[AVAILABLE BOT COMMANDS]* 🛠️

👑 *Admin Commands (You can send):*
• \`#stats\` or \`#leads\` — View total active leads & stats
• \`#pause\` — Pause AI bot for this customer chat
• \`#resume\` — Resume AI bot for this customer chat

💬 *Customer Triggers (What clients can ask):*
• *"Pricing / Cost / Quote"* — Ballpark estimates + Founder intro
• *"Send PDF / Proposal"* — Auto-generates branded PDF Proposal
• *"Payment / UPI / QR Scanner"* — Sends UPI QR Code + Owner Phone
• *"Voice Note"* — Auto transcribes & replies in Marathi/Hindi/English
• *"Screenshot / Wireframe"* — Gemini Vision analyzes layout
• *"Call Shubham / Contact Owner"* — Hot lead alert sent to your WhatsApp!`;
        if (activeSock) {
          await activeSock.sendMessage(targetJid, { text: helpReply });
        }
        console.log(`🛠️ [ADMIN HELP DISPATCHED] Sent to ${targetJid}`);
        return;
      }
    }

    // 1. If Owner is in Self Chat -> Executive AI Co-Pilot, Live Quote Customizer & Self-Configurator!
    if (isSelfChat) {
      console.log(`👑 [OWNER EXECUTIVE QUERY] "${combinedText}"`);
      try {
        await activeSock.sendPresenceUpdate("composing", targetJid);
      } catch (e) {}

      // A. Check if owner is confirming a pending quote dispatch (e.g. "Send", "Send to Deepa", "Yes", "go and send it", "it is correct so send her", "send her on whatsapp")
      const pending = pendingQuoteDispatches.get(OWNER_JID);
      const isSendCmd = /^(send|yes|send it|send to|ok send|dispatch|it is correct|send her|go and send|send on whatsapp|correct|ha pathav|pathav)/i.test(cleanCmd) ||
                        /send her|send it|go and send|send on whatsapp|correct so send/i.test(combinedText.toLowerCase());

      if (pending && isSendCmd) {
        pendingQuoteDispatches.delete(OWNER_JID);
        try {
          await activeSock.sendMessage(pending.targetChatId, { text: pending.messageText });
          appendToChatMemory(pending.targetChatId, "assistant", pending.messageText, pending.clientName, true);
          console.log(`🚀 [DISPATCHED REVISED QUOTE] Sent to ${pending.clientName} (${pending.targetChatId})`);
          
          const confirmMsg = `🚀 *Quotation of ${pending.revisedPrice || 'Approved Rate'} Sent Directly to ${pending.clientName} on WhatsApp!* ✨\n\n💬 *Message Sent:* \n"${pending.messageText}"`;
          await activeSock.sendMessage(targetJid, { text: confirmMsg });
          return;
        } catch (sendErr) {
          await activeSock.sendMessage(targetJid, { text: `⚠️ Could not send to client: ${sendErr.message}` });
          return;
        }
      }

      // B. Check if owner is asking to customize/revise a quote for a specific client
      const quoteOverrideReply = await handleClientQuoteOverride(combinedText, history, activeSock);
      let ownerReply = quoteOverrideReply;

      // C. Check if owner is teaching or customizing the bot
      if (!ownerReply) {
        ownerReply = await handleOwnerConfiguration(combinedText);
      }

      // D. Otherwise, process with Executive AI Co-Pilot with full CRM context
      if (!ownerReply) {
        try {
          ownerReply = await askGemini(combinedText, history, {
            isOwner: true,
            clientName: "Shubham Vernekar",
            mediaBuffers: mediaItems,
          });
        } catch (err) {
          ownerReply = `⚠️ Executive AI Error: ${err.message}`;
        }
      }

      await activeSock.sendMessage(targetJid, { text: ownerReply });

      appendToChatMemory(chatId, "user", combinedText, "Shubham (Owner)", true);
      appendToChatMemory(chatId, "assistant", ownerReply, "Shubham (Owner)", true);
      console.log(`🤖 [EXECUTIVE AI REPLIED TO OWNER]: "${ownerReply.replace(/\n/g, " ")}"`);
      return;
    }

    if (pausedChats.has(chatId)) {
      console.log(`⏸️ [PAUSED] AI Bot is paused for ${senderName} (${chatId})`);
      return;
    }

    // 1. Intent Classification Check
    const classification = await classifyMessageIntent(combinedText, history);

    if (!classification.isBusinessRelated && mediaItems.length === 0) {
      console.log(`⏩ [SKIPPED] Personal chat detected from ${senderName}: "${combinedText}" (Reason: ${classification.reason})`);
      return;
    }

    // 2. Lead Capture & Instant Owner Alert
    const cleanLower = combinedText.toLowerCase();
    const isUrgentHandoff = /call|quickly|urgent|contact|shubham|meet|talk|phone|quote|proposal|price/i.test(cleanLower);

    if (classification.isLead || isUrgentHandoff) {
      saveLead({
        name: senderName,
        chatId,
        inquiry: combinedText,
        priority: classification.priority || (isUrgentHandoff ? "HOT" : "WARM"),
      });

      // Dispatch real-time WhatsApp alert directly to Shubham Vernekar
      if (chatId !== OWNER_JID) {
        const projectRequirement = await extractProjectRequirement(history, combinedText);
        const chatSummary = await generateChatSummary(history, combinedText);
        notifyOwner(senderName, chatId, projectRequirement, chatSummary, combinedText, classification.priority || "HOT");
      }
    }

    // 3. Mark as read immediately
    try {
      if (lastMsgKey && activeSock) await activeSock.readMessages([lastMsgKey]);
    } catch (e) {}

    // 4. Special Dynamic Actions: UPI Payment QR or PDF Proposal
    const isPaymentRequest = /pay|payment|upi|qr|scanner|advance|deposit|google pay|phonepe|paytm/i.test(cleanLower);
    const isProposalPDFRequest = /pdf quote|proposal pdf|send pdf|official quotation|download proposal/i.test(cleanLower);

    if (!activeSock) return;

    if (isPaymentRequest) {
      console.log(`💳 [PAYMENT QR TRIGGERED] Generating UPI QR for ${senderName}...`);
      try {
        const qrBuffer = await generatePaymentQR({
          vpa: "9028833275@ybl",
          name: "Shubham Vernekar",
          note: "ShubDeep Labs Project Booking",
        });

        const paymentCaption = 
`💳 *ShubDeep Labs — Official Payment QR* ✨

You can scan this QR code to pay securely via **Google Pay / PhonePe / Paytm / BHIM UPI**.

👤 *Payee:* Shubham Vernekar
📱 *UPI / Phone:* ${OWNER_PHONE}
🏦 *UPI ID:* \`9028833275@ybl\`

Once completed, please share the transaction screenshot here to confirm your project kickoff! 🚀🤝`;

        await activeSock.sendMessage(chatId, {
          image: qrBuffer,
          caption: paymentCaption,
        });

        appendToChatMemory(chatId, "user", combinedText, senderName, true);
        appendToChatMemory(chatId, "assistant", paymentCaption, senderName, true);
        return;
      } catch (err) {
        console.warn("⚠️ Could not generate payment QR:", err.message);
      }
    }

    if (isProposalPDFRequest) {
      console.log(`📄 [PDF PROPOSAL TRIGGERED] Generating quotation PDF for ${senderName}...`);
      try {
        const pdfBuffer = await generateQuotationPDF({
          clientName: memory.name || senderName,
          projectType: "Custom Full-Stack Web / E-Commerce Solution",
          priceRange: "₹9,999 – ₹14,999 (Estimated)",
          timeline: "2–3 Weeks",
        });

        await activeSock.sendMessage(chatId, {
          document: pdfBuffer,
          mimetype: "application/pdf",
          fileName: `ShubDeep_Labs_Proposal_${(memory.name || senderName).replace(/\s+/g, "_")}.pdf`,
          caption: `Here is your official project estimate proposal PDF! 📄✨ Let us know your thoughts or connect directly with Shubham (${OWNER_PHONE}) to finalize! 🚀`,
        });

        appendToChatMemory(chatId, "user", combinedText, senderName, true);
        appendToChatMemory(chatId, "assistant", "Sent Official Project Proposal PDF", senderName, true);
        return;
      } catch (err) {
        console.warn("⚠️ Could not generate PDF proposal:", err.message);
      }
    }

    // 5. Short typing status while Gemini generates response
    try {
      await activeSock.sendPresenceUpdate("composing", chatId);
    } catch (e) {}

    // 6. Ask Gemini (with Multimodal Text/Vision/Audio)
    let reply;
    try {
      reply = await askGemini(combinedText, history, {
        timeGap,
        clientName: memory.name || senderName,
        mediaBuffers: mediaItems,
        approvedQuote: memory.approvedQuote || null,
      });
    } catch (err) {
      console.error("Gemini error:", err.message);
      reply =
        `Sorry, I had a quick technical hiccup! 😅 Please feel free to reach out directly to Shubham at ${OWNER_PHONE} or shubdeeplabs@gmail.com. 🚀`;
    }

    if (!reply) {
      reply = "Hey there! 👋 Welcome to ShubDeep Labs! ✨ How can I help you with your project today? 😊";
    }

    // Brief realistic pause (400ms)
    await new Promise((r) => setTimeout(r, 400));

    // 7. Send the message
    await activeSock.sendMessage(chatId, { text: reply });

    // 8. Persist to long-term memory file on disk
    appendToChatMemory(chatId, "user", combinedText || "[Media Attachment]", senderName, true);
    appendToChatMemory(chatId, "assistant", reply, senderName, true);

    console.log(`🤖 [REPLIED] To ${senderName}: "${reply.replace(/\n/g, " ")}"`);
  } catch (err) {
    console.error(`⚠️ Error processing message for ${chatId}:`, err.message);
  }
}

// ------------------------------------------------------------
//  AUTOMATED POLITE FOLLOW-UP & 8:00 PM DAILY DIGEST ENGINE
// ------------------------------------------------------------
let followUpInterval = null;
let lastDigestDate = "";

function startFollowUpEngine() {
  if (followUpInterval) clearInterval(followUpInterval);

  console.log("⏰ Smart Follow-Up & Daily Digest Engine active (Interval: 30 mins)");

  followUpInterval = setInterval(async () => {
    try {
      if (!currentSock) return;

      const allData = loadAllChatHistory();
      const now = Date.now();
      const todayStr = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
      const currentHour = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).getHours();

      // --- 8:00 PM DAILY EXECUTIVE LEAD DIGEST ---
      if (currentHour === 20 && lastDigestDate !== todayStr) {
        lastDigestDate = todayStr;
        let todayLeads = 0;
        let hotLeads = 0;

        for (const chat of Object.values(allData)) {
          if (!chat.isBusinessChat) continue;
          const chatDate = new Date(chat.lastInteraction).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
          if (chatDate === todayStr) {
            todayLeads++;
            if (chat.priority === "HOT" || chat.lastSender === "user") hotLeads++;
          }
        }

        const digestMessage = 
`📰 *[SHUBDEEP LABS — DAILY LEAD DIGEST]* 📊
📅 *Date:* ${todayStr}

• Total Active Inquiries Today: *${todayLeads}*
• Hot Leads Awaiting Follow-up: *${hotLeads}*
• 24/7 AI WhatsApp Agent: *Online & Active* ✅

👉 _Review recent chat logs in leads.json & connect with pending prospects!_ 🚀`;

        try {
          await currentSock.sendMessage(OWNER_JID, { text: digestMessage });
          console.log(`📊 [DAILY DIGEST SENT] Dispatched 8:00 PM summary to Shubham Vernekar`);
        } catch (e) {}
      }

      // --- 24-HOUR POLITE RE-ENGAGEMENT NUDGE ---
      const HOURS_24 = 24 * 60 * 60 * 1000;
      const DAYS_5 = 5 * 24 * 60 * 60 * 1000;

      for (const [chatId, chat] of Object.entries(allData)) {
        if (!chat.isBusinessChat) continue;
        if (chat.lastSender !== "assistant") continue;
        if ((chat.followUpCount || 0) >= 1) continue;
        if (chatId === OWNER_JID) continue;

        const timeSinceLastMsg = now - (chat.lastInteraction || 0);

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
  }, 30 * 60 * 1000);
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

  const msgRetryCounterMap = new Map();
  const msgRetryCounterCache = {
    get: (key) => msgRetryCounterMap.get(key),
    set: (key, val) => msgRetryCounterMap.set(key, val),
    del: (key) => msgRetryCounterMap.delete(key),
  };

  const sock = makeWASocket({
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, P({ level: "fatal" })),
    },
    logger: P({ level: "fatal" }),
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
      console.log("✅ Connected to WhatsApp! ShubDeep Labs Enterprise AI Agent is LIVE.");
      console.log(`📱 Alerts will be dispatched to Owner: ${OWNER_PHONE}`);
      console.log("===================================================\n");

      startFollowUpEngine();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.message) continue;

        const msgId = msg.key.id;
        if (processedMsgKeys.has(msgId)) continue;
        processedMsgKeys.add(msgId);
        if (processedMsgKeys.size > 3000) {
          const firstKey = processedMsgKeys.values().next().value;
          processedMsgKeys.delete(firstKey);
        }

        // Extract text content
        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption ||
          "";

        const chatId = msg.key.remoteJid;
        const fromMe = !!msg.key.fromMe;

        // Check if this chat belongs to an existing client in CRM
        const allData = loadAllChatHistory();
        const isClientChat = !!(allData[chatId] && !isOwnerChatId(chatId, allData[chatId]));

        // If fromMe is true and it's NOT inside a known client chat, it is Shubham in Self-Chat!
        const isSelfChat = isOwnerChatId(chatId) || (fromMe && !isClientChat);
        const isCommand = text.trim().startsWith("#");

        // Skip our own manual outgoing typing inside client chats, but ALLOW ALL messages in Owner Self-Chat
        if (fromMe && isClientChat && !isCommand) continue;

        const senderName = isSelfChat ? "Shubham (Owner)" : (msg.pushName || chatId.split("@")[0]);

        if (IGNORE_GROUPS && chatId.endsWith("@g.us")) continue;

        // Extract multimodal media (Images / Audio voice notes)
        const mediaItems = [];

        if (msg.message.imageMessage) {
          try {
            const buffer = await downloadMediaMessage(msg, "buffer", {});
            mediaItems.push({ mimetype: "image/jpeg", buffer });
            console.log(`🖼️ [IMAGE RECEIVED] From ${senderName}`);
          } catch (e) {
            console.warn("Could not download image:", e.message);
          }
        }

        if (msg.message.audioMessage) {
          try {
            const buffer = await downloadMediaMessage(msg, "buffer", {});
            mediaItems.push({ mimetype: "audio/ogg", buffer });
            console.log(`🎙️ [VOICE NOTE RECEIVED] From ${senderName}`);
          } catch (e) {
            console.warn("Could not download voice note:", e.message);
          }
        }

        if (!text.trim() && mediaItems.length === 0) continue;

        const existing = messageQueue.get(chatId) || {
          timer: null,
          messages: [],
          mediaItems: [],
          senderName,
          msgKey: msg.key,
          isSelfChat,
        };

        if (existing.timer) clearTimeout(existing.timer);

        if (text.trim()) existing.messages.push(text.trim());
        if (mediaItems.length > 0) existing.mediaItems.push(...mediaItems);
        existing.senderName = senderName;
        existing.msgKey = msg.key;

        existing.timer = setTimeout(() => {
          processBatchedMessages(chatId, sock);
        }, 600); // 600ms fast debounce

        messageQueue.set(chatId, existing);
      } catch (err) {
        console.error("Error queueing message:", err);
      }
    }
  });
}

console.log("\n===================================================");
console.log("  ShubDeep Labs — Enterprise WhatsApp AI Agent");
console.log("===================================================\n");
console.log("[INFO] Starting WhatsApp Bot...");

startBot().catch((err) => console.error("Failed to start WhatsApp bot:", err));