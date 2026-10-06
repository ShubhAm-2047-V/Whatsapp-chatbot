// ============================================================
//  SHUBDEEP LABS — WHATSAPP CONTACTS & ADDRESS BOOK STORE
//  Live dynamic contact synchronization with high-speed in-memory indexing
// ============================================================

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const CONTACTS_FILE = path.join(DATA_DIR, "contacts.json");
const CHAT_HISTORY_FILE = path.join(DATA_DIR, "chat_history.json");
const LEADS_FILE = path.join(__dirname, "..", "leads.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Built-in aliases and relationships
const DEFAULT_ALIASES = {
  mummy: { name: "Deepa Dinesh Vernekar", chatId: "112666236477622@lid", phone: "112666236477622" },
  mom: { name: "Deepa Dinesh Vernekar", chatId: "112666236477622@lid", phone: "112666236477622" },
  aai: { name: "Deepa Dinesh Vernekar", chatId: "112666236477622@lid", phone: "112666236477622" },
  mother: { name: "Deepa Dinesh Vernekar", chatId: "112666236477622@lid", phone: "112666236477622" },
  deepa: { name: "Deepa Dinesh Vernekar", chatId: "112666236477622@lid", phone: "112666236477622" },
  "deepa vernekar": { name: "Deepa Dinesh Vernekar", chatId: "112666236477622@lid", phone: "112666236477622" },
  "deepa dinesh vernekar": { name: "Deepa Dinesh Vernekar", chatId: "112666236477622@lid", phone: "112666236477622" },

  papa: { name: "Dinesh Vernekar", chatId: "135235735965794@lid", phone: "135235735965794" },
  pappa: { name: "Dinesh Vernekar", chatId: "135235735965794@lid", phone: "135235735965794" },
  dad: { name: "Dinesh Vernekar", chatId: "135235735965794@lid", phone: "135235735965794" },
  father: { name: "Dinesh Vernekar", chatId: "135235735965794@lid", phone: "135235735965794" },
  dinesh: { name: "Dinesh Vernekar", chatId: "135235735965794@lid", phone: "135235735965794" },

  nitesh: { name: "Nitesh", chatId: "255602781646975@lid", phone: "255602781646975" },
};

// ------------------------------------------------------------
//  IN-MEMORY CACHE & INDEXATION LAYER
// ------------------------------------------------------------
let cachedContacts = null;
let saveTimeout = null;
let isDirty = false;

// Fast lookup indexes
let indexByPhone = new Map();
let indexByAlias = new Map();
let indexByName = new Map();

function rebuildIndexes(contacts) {
  indexByPhone.clear();
  indexByAlias.clear();
  indexByName.clear();

  // Index built-in default aliases first
  for (const [alias, data] of Object.entries(DEFAULT_ALIASES)) {
    indexByAlias.set(alias.toLowerCase(), {
      name: data.name,
      phone: data.phone,
      chatId: data.chatId,
      isAliasMatch: true,
    });
  }

  for (const [cid, c] of Object.entries(contacts)) {
    const rawPhone = (c.phone || cid.split("@")[0]).replace(/\D/g, "");
    if (rawPhone) {
      indexByPhone.set(rawPhone, c);
      if (rawPhone.length === 10) indexByPhone.set("91" + rawPhone, c);
      if (rawPhone.length === 12 && rawPhone.startsWith("91")) indexByPhone.set(rawPhone.slice(2), c);
    }
    indexByPhone.set(cid.toLowerCase(), c);

    if (c.name) {
      const lowerName = c.name.trim().toLowerCase();
      indexByName.set(lowerName, c);
      const cleanFirst = lowerName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "");
      if (cleanFirst && cleanFirst.length >= 3 && !indexByName.has(cleanFirst)) {
        indexByName.set(cleanFirst, c);
      }
    }

    if (Array.isArray(c.aliases)) {
      for (const al of c.aliases) {
        if (al) indexByAlias.set(al.trim().toLowerCase(), c);
      }
    }
  }
}

function loadContacts() {
  if (cachedContacts !== null) {
    return cachedContacts;
  }

  let contacts = {};
  try {
    if (fs.existsSync(CONTACTS_FILE)) {
      contacts = JSON.parse(fs.readFileSync(CONTACTS_FILE, "utf-8") || "{}");
    }
  } catch (e) {
    contacts = {};
  }

  // Ensure default seeds exist
  for (const [alias, data] of Object.entries(DEFAULT_ALIASES)) {
    if (!contacts[data.chatId]) {
      contacts[data.chatId] = {
        name: data.name,
        chatId: data.chatId,
        phone: data.phone,
        aliases: [alias],
        lastSeen: Date.now(),
      };
    } else {
      contacts[data.chatId].aliases = Array.from(
        new Set([...(contacts[data.chatId].aliases || []), alias])
      );
    }
  }

  cachedContacts = contacts;
  rebuildIndexes(cachedContacts);
  return cachedContacts;
}

function saveContacts(contacts, immediate = false) {
  cachedContacts = contacts;
  rebuildIndexes(cachedContacts);
  isDirty = true;

  if (immediate) {
    if (saveTimeout) clearTimeout(saveTimeout);
    try {
      fs.writeFileSync(CONTACTS_FILE, JSON.stringify(cachedContacts, null, 2), "utf-8");
      isDirty = false;
    } catch (e) {
      console.warn("⚠️ Could not save contacts immediately:", e.message);
    }
    return;
  }

  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      if (isDirty && cachedContacts) {
        fs.writeFileSync(CONTACTS_FILE, JSON.stringify(cachedContacts, null, 2), "utf-8");
        isDirty = false;
      }
    } catch (e) {
      console.warn("⚠️ Could not save contacts async:", e.message);
    }
  }, 300);
}

// Flush pending changes on process shutdown
process.on("exit", () => {
  if (isDirty && cachedContacts) {
    try {
      fs.writeFileSync(CONTACTS_FILE, JSON.stringify(cachedContacts, null, 2), "utf-8");
    } catch (e) {}
  }
});

/**
 * Updates a contact from Baileys events (pushName, verifiedName, notify, etc.)
 */
function recordContact(chatId, info = {}) {
  if (!chatId || chatId.endsWith("@g.us") || chatId === "status@broadcast") return;
  const contacts = loadContacts();

  const name = info.name || info.pushName || info.verifiedName || info.notify || contacts[chatId]?.name || chatId.split("@")[0];
  const phone = info.phone || chatId.split("@")[0].replace(/\D/g, "");

  contacts[chatId] = {
    name,
    chatId,
    phone,
    aliases: contacts[chatId]?.aliases || [],
    lastSeen: Date.now(),
  };

  saveContacts(contacts);
}

/**
 * High-speed contact search across indexes, WhatsApp contacts, CRM chat history, leads, and aliases
 */
function findContact(query) {
  if (!query) return null;
  const raw = String(query).trim();
  const lower = raw.toLowerCase();

  // 1. Direct phone number (10+ digits)
  const digitsOnly = raw.replace(/\D/g, "");
  if (digitsOnly.length >= 10) {
    let formattedPhone = digitsOnly;
    if (formattedPhone.length === 10) {
      formattedPhone = "91" + formattedPhone;
    }
    return {
      name: raw.replace(/\d+/g, "").trim() || "Client",
      phone: formattedPhone,
      chatId: `${formattedPhone}@s.whatsapp.net`,
      isExplicitPhone: true,
    };
  }

  // Ensure cache & indexes are warmed
  const contacts = loadContacts();

  // 2. Fast Index Lookup: Aliases
  if (indexByAlias.has(lower)) {
    const a = indexByAlias.get(lower);
    return {
      name: a.name,
      phone: a.phone,
      chatId: a.chatId,
      isAliasMatch: true,
    };
  }

  // 3. Fast Index Lookup: Exact Phone / ChatId
  if (indexByPhone.has(lower) || (digitsOnly && indexByPhone.has(digitsOnly))) {
    const c = indexByPhone.get(lower) || indexByPhone.get(digitsOnly);
    return {
      name: c.name,
      phone: c.phone || c.chatId.split("@")[0],
      chatId: c.chatId,
      isContactMatch: true,
    };
  }

  // 4. Fast Index Lookup: Exact Name or First Name
  if (indexByName.has(lower)) {
    const c = indexByName.get(lower);
    return {
      name: c.name,
      phone: c.phone || c.chatId.split("@")[0],
      chatId: c.chatId,
      isContactMatch: true,
    };
  }

  // 5. Token & Substring Match across Contacts
  const queryTokens = lower.split(/\s+/).filter(t => t.length >= 2);

  for (const [cid, c] of Object.entries(contacts)) {
    const cname = (c.name || "").toLowerCase();
    const cleanFirst = cname.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "");
    const nameTokens = cname.split(/[\s@._\-+]+/).filter(t => t.length >= 2);

    const matchesAlias = (c.aliases || []).some(a => {
      const al = a.toLowerCase();
      return al === lower || lower.includes(al) || queryTokens.some(qt => al.includes(qt));
    });

    const matchesExact = cname === lower || cname.includes(lower) || lower.includes(cname);
    const matchesFirst = cleanFirst && cleanFirst.length >= 2 && (lower.includes(cleanFirst) || cleanFirst.includes(lower));
    const matchesToken = queryTokens.length > 0 && queryTokens.some(qt => nameTokens.some(nt => nt.includes(qt) || qt.includes(nt)));

    if (matchesAlias || matchesExact || matchesFirst || matchesToken) {
      return {
        name: c.name,
        phone: c.phone || cid.split("@")[0],
        chatId: cid,
        isContactMatch: true,
      };
    }
  }

  // 6. Search CRM Chat History
  try {
    if (fs.existsSync(CHAT_HISTORY_FILE)) {
      const allChatData = JSON.parse(fs.readFileSync(CHAT_HISTORY_FILE, "utf-8") || "{}");
      for (const [cid, c] of Object.entries(allChatData)) {
        const cname = (c.name || "").toLowerCase();
        const cleanFirst = cname.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "");
        const nameTokens = cname.split(/[\s@._\-+]+/).filter(t => t.length >= 2);

        const matchesExact = cname === lower || cname.includes(lower) || lower.includes(cname);
        const matchesFirst = cleanFirst && cleanFirst.length >= 2 && (lower.includes(cleanFirst) || cleanFirst.includes(lower));
        const matchesToken = queryTokens.length > 0 && queryTokens.some(qt => nameTokens.some(nt => nt.includes(qt) || qt.includes(nt)));

        if (matchesExact || matchesFirst || matchesToken) {
          return {
            name: c.name || raw,
            phone: cid.split("@")[0],
            chatId: cid,
            isHistoryMatch: true,
          };
        }
      }
    }
  } catch (e) {}

  // 7. Search leads.json
  try {
    if (fs.existsSync(LEADS_FILE)) {
      const leads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf-8") || "[]");
      for (const lead of leads) {
        const lname = (lead.name || "").toLowerCase();
        const cleanFirst = lname.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "");
        const nameTokens = lname.split(/[\s@._\-+]+/).filter(t => t.length >= 2);

        const matchesExact = lname === lower || lname.includes(lower) || lower.includes(lname);
        const matchesFirst = cleanFirst && cleanFirst.length >= 2 && (lower.includes(cleanFirst) || cleanFirst.includes(lower));
        const matchesToken = queryTokens.length > 0 && queryTokens.some(qt => nameTokens.some(nt => nt.includes(qt) || qt.includes(nt)));

        if (matchesExact || matchesFirst || matchesToken) {
          const rawPhone = (lead.phone || "").replace(/\D/g, "");
          const cleanPhone = rawPhone.length === 10 ? "91" + rawPhone : rawPhone;
          return {
            name: lead.name || raw,
            phone: cleanPhone,
            chatId: lead.chatId || (cleanPhone ? `${cleanPhone}@s.whatsapp.net` : null),
            isLeadMatch: true,
          };
        }
      }
    }
  } catch (e) {}

  return null;
}

module.exports = {
  loadContacts,
  saveContacts,
  recordContact,
  findContact,
  DEFAULT_ALIASES,
};
