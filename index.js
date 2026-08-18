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
const { GEMINI_API_KEY, GEMINI_MODEL } = require("./config");
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

// Filter noisy internal libsignal session debug logs
const originalConsoleLog = console.log;
console.log = (...args) => {
  if (typeof args[0] === "string" && (
    args[0].startsWith("Closing session") ||
    args[0].startsWith("Closing open session") ||
    args[0].startsWith("Session error") ||
    args[0].startsWith("Failed to decrypt")
  )) {
    return;
  }
  originalConsoleLog.apply(console, args);
};

const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === "string" && (
    args[0].startsWith("Closing session") ||
    args[0].startsWith("Closing open session") ||
    args[0].startsWith("Session error") ||
    args[0].startsWith("Failed to decrypt")
  )) {
    return;
  }
  originalConsoleError.apply(console, args);
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
  const apiKey = (process.env.GEMINI_API_KEY || GEMINI_API_KEY || "").trim();
  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: `Based on these customer inquiries: "${allUserText}", summarize what project the customer wants to build in 4 to 8 words (e.g. "Gold E-Commerce Website with Live Rates"). Return ONLY the short title.` }]
          }],
          generationConfig: { maxOutputTokens: 30, temperature: 0.1 }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (summary) return summary.replace(/["\n]/g, "");
      }
    } catch (e) {}
  }

  return currentText;
}

// ------------------------------------------------------------
//  INTELLIGENT CHAT CONVERSATION SUMMARIZER
// ------------------------------------------------------------
async function generateChatSummary(history = [], currentText = "") {
  if (history.length === 0) return `• Initial message: "${currentText}"`;

  const conversationLines = history.slice(-12).map((h) => `${h.role === "user" ? "Client" : "Assistant"}: ${h.text}`);
  if (currentText) conversationLines.push(`Client: ${currentText}`);

  const apiKey = (process.env.GEMINI_API_KEY || GEMINI_API_KEY || "").trim();
  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        })
      });
      if (res.ok) {
        const data = await res.json();
        let summary = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        // Strip any filler text before the first bullet
        const bulletIndex = summary.indexOf("•");
        if (bulletIndex !== -1) {
          summary = summary.substring(bulletIndex).trim();
        }
        if (summary.length > 10) return summary;
      }
    } catch (e) {}
  }

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
            maxOutputTokens: 500,
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
        priority: parsed.priority || "WARM",
        reason: parsed.reason || "Classified by Gemini",
      };
    } catch (e) {}
  }

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

  const { timeGap, clientName, mediaBuffers = [] } = options;
  const knowledge = loadDynamicKnowledge();

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

  const systemInstruction = `You are the friendly, tech-savvy AI Client Coordinator for "ShubDeep Labs" on WhatsApp.

Your goal is to talk like a warm, engaging human team member and guide the customer STEP-BY-STEP through a natural interactive conversation. 
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

    // 0. Admin Commands & Takeover Mode
    if (chatId === OWNER_JID || cleanCmd.startsWith("#")) {
      if (cleanCmd === "#stats" || cleanCmd === "#leads") {
        const allData = loadAllChatHistory();
        const total = Object.keys(allData).length;
        const businessChats = Object.values(allData).filter((c) => c.isBusinessChat).length;
        const hotLeads = Object.values(allData).filter((c) => c.priority === "HOT").length;
        const statsReply = `📊 *[SHUBDEEP LABS AI STATS]* 📊\n\n• Total Active Chats: *${total}*\n• Business Inquiries: *${businessChats}*\n• Hot Leads: *${hotLeads}*\n• AI Engine: *Active & Online* ✅`;
        if (activeSock) await activeSock.sendMessage(chatId, { text: statsReply });
        return;
      }
      if (cleanCmd === "#pause") {
        pausedChats.add(chatId);
        if (activeSock) await activeSock.sendMessage(chatId, { text: "⏸️ *AI Bot paused for this chat.* You can now chat directly. Send `#resume` anytime to turn AI back on." });
        return;
      }
      if (cleanCmd === "#resume") {
        pausedChats.delete(chatId);
        if (activeSock) await activeSock.sendMessage(chatId, { text: "▶️ *AI Bot resumed for this chat.*" });
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
        if (activeSock) await activeSock.sendMessage(chatId, { text: helpReply });
        return;
      }
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
        if (!msg.message || msg.key.fromMe) continue;

        const chatId = msg.key.remoteJid;
        const senderName = msg.pushName || chatId.split("@")[0];

        if (IGNORE_GROUPS && chatId.endsWith("@g.us")) continue;

        // Extract text content
        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption ||
          "";

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