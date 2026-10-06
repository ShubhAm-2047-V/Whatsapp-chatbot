// ============================================================
//  SHUBDEEP LABS — ENTERPRISE MESSAGE SCHEDULER ENGINE
//  Handles automated delayed & scheduled WhatsApp message dispatch
//  Optimized with zero-disk in-memory queue & debounced persistence
// ============================================================

const fs = require("fs");
const path = require("path");
const { findContact, recordContact, loadContacts } = require("./contactsStore");

const DATA_DIR = path.join(__dirname, "..", "data");
const SCHEDULE_FILE = path.join(DATA_DIR, "scheduled_messages.json");
const CHAT_HISTORY_FILE = path.join(DATA_DIR, "chat_history.json");
const LEADS_FILE = path.join(__dirname, "..", "leads.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ------------------------------------------------------------
//  IN-MEMORY SCHEDULE QUEUE & PERSISTENCE
// ------------------------------------------------------------
let cachedScheduledMessages = null;
let schedulerSaveTimeout = null;
let isSchedulerDirty = false;

function loadScheduledMessages() {
  if (cachedScheduledMessages !== null) {
    return cachedScheduledMessages;
  }
  try {
    if (fs.existsSync(SCHEDULE_FILE)) {
      const data = fs.readFileSync(SCHEDULE_FILE, "utf-8");
      cachedScheduledMessages = JSON.parse(data || "[]");
      return cachedScheduledMessages;
    }
  } catch (err) {
    console.warn("⚠️ Could not load scheduled messages:", err.message);
  }
  cachedScheduledMessages = [];
  return cachedScheduledMessages;
}

function saveScheduledMessages(messages, immediate = false) {
  cachedScheduledMessages = messages;
  isSchedulerDirty = true;

  if (immediate) {
    if (schedulerSaveTimeout) clearTimeout(schedulerSaveTimeout);
    try {
      fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(cachedScheduledMessages, null, 2), "utf-8");
      isSchedulerDirty = false;
    } catch (err) {
      console.warn("⚠️ Could not save scheduled messages immediately:", err.message);
    }
    return;
  }

  if (schedulerSaveTimeout) clearTimeout(schedulerSaveTimeout);
  schedulerSaveTimeout = setTimeout(() => {
    try {
      if (isSchedulerDirty && cachedScheduledMessages) {
        fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(cachedScheduledMessages, null, 2), "utf-8");
        isSchedulerDirty = false;
      }
    } catch (err) {
      console.warn("⚠️ Could not save scheduled messages async:", err.message);
    }
  }, 300);
}

// Flush pending changes on process shutdown
process.on("exit", () => {
  if (isSchedulerDirty && cachedScheduledMessages) {
    try {
      fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(cachedScheduledMessages, null, 2), "utf-8");
    } catch (e) {}
  }
});

// ------------------------------------------------------------
//  RECIPIENT RESOLUTION
// ------------------------------------------------------------
function resolveRecipient(recipientInput) {
  if (!recipientInput) return null;
  const cleanInput = String(recipientInput).trim();

  // Search across WhatsApp contacts, aliases, CRM chat history & leads
  const found = findContact(cleanInput);
  if (found) {
    return {
      name: found.name,
      phone: found.phone || (found.chatId ? found.chatId.split("@")[0] : null),
      chatId: found.chatId,
      isExplicitPhone: !!found.isExplicitPhone,
      isAliasMatch: !!found.isAliasMatch,
    };
  }

  // If not found yet, create provisional record
  return {
    name: cleanInput.charAt(0).toUpperCase() + cleanInput.slice(1),
    phone: null,
    chatId: null,
    isUnregistered: true,
  };
}

// ------------------------------------------------------------
//  TIME & DATE PARSING ENGINE
// ------------------------------------------------------------
function parseScheduleTime(timeStr, baseTime = Date.now()) {
  if (!timeStr) return null;
  const raw = String(timeStr).trim().toLowerCase();

  // A. Relative duration parser (e.g., "10", "10 min", "15 mins", "30 sec", "2 hours", "1 day")
  const relativeMatch = raw.match(/^(\d+(?:\.\d+)?)\s*(s|sec|seconds?|m|min|mins?|minutes?|h|hr|hrs?|hours?|d|days?)?$/i) ||
                        raw.match(/(?:after|in)\s+(\d+(?:\.\d+)?)\s*(s|sec|seconds?|m|min|mins?|minutes?|h|hr|hrs?|hours?|d|days?)?/i);

  if (relativeMatch) {
    const value = parseFloat(relativeMatch[1]);
    const unit = (relativeMatch[2] || "m").toLowerCase();

    let ms = 0;
    if (unit.startsWith("s")) {
      ms = value * 1000;
    } else if (unit.startsWith("h")) {
      ms = value * 60 * 60 * 1000;
    } else if (unit.startsWith("d")) {
      ms = value * 24 * 60 * 60 * 1000;
    } else {
      // Default unit is minutes
      ms = value * 60 * 1000;
    }

    const targetTimestamp = baseTime + ms;
    return {
      targetTimestamp,
      delayMs: ms,
      isRelative: true,
    };
  }

  // B. Hindi / Marathi exact time (e.g. 'kal 10 baje', 'kal 10 ko', 'udya 10 vajta', 'kal shaam 5 baje', 'kal subah 10 baje')
  const regionalTime = raw.match(/(?:kal|udya|aaj|today|tomorrow)\s*(?:subah|sakali|shaam|sandhyakali|dupari|dopahar|raat)?\s*(\d{1,2})(?::(\d{2}))?\s*(?:ko|baje|vajta|am|pm)?/i);
  if (regionalTime) {
    let hours = parseInt(regionalTime[1], 10);
    const minutes = regionalTime[2] ? parseInt(regionalTime[2], 10) : 0;
    const isTom = /kal|udya|tomorrow/i.test(raw);
    const isPm = /shaam|sandhyakali|raat|pm|evening|night|dupari|dopahar/i.test(raw);
    if (isPm && hours < 12) hours += 12;
    if (!isPm && /subah|sakali|am|morning/i.test(raw) && hours === 12) hours = 0;

    // Default daytime hours (e.g. 10 -> 10 AM, 3 -> 3 PM)
    if (!isPm && !/subah|sakali|am/i.test(raw) && hours >= 1 && hours <= 6) hours += 12;

    const d = new Date(baseTime);
    if (isTom) d.setDate(d.getDate() + 1);
    d.setHours(hours, minutes, 0, 0);
    return {
      targetTimestamp: d.getTime(),
      delayMs: Math.max(0, d.getTime() - baseTime),
      isRelative: false,
    };
  }

  // C. Standard exact time & date parser (e.g. "tomorrow at 10 AM", "today at 5:30 PM", "at 6 PM")
  const dateObj = new Date(baseTime);
  let isTomorrow = false;
  let isToday = false;

  if (raw.includes("tomorrow") || raw.includes("udya") || raw.includes("kal")) {
    isTomorrow = true;
  } else if (raw.includes("today") || raw.includes("aaj")) {
    isToday = true;
  }

  // Extract time of day (e.g. "10:30 am", "5 pm", "17:00", "4:15pm")
  const timeMatch = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;

    if (isTomorrow) {
      dateObj.setDate(dateObj.getDate() + 1);
    }
    dateObj.setHours(hours, minutes, 0, 0);

    // If no day specified and calculated time is in the past for today, assume next day
    if (!isTomorrow && !isToday && dateObj.getTime() <= baseTime) {
      dateObj.setDate(dateObj.getDate() + 1);
    }

    return {
      targetTimestamp: dateObj.getTime(),
      delayMs: Math.max(0, dateObj.getTime() - baseTime),
      isRelative: false,
    };
  }

  // D. Absolute Date format (e.g., "25 Aug 4 PM", "2026-08-25 14:00")
  const parsedDate = new Date(raw);
  if (!isNaN(parsedDate.getTime()) && parsedDate.getTime() > baseTime - 60000) {
    return {
      targetTimestamp: parsedDate.getTime(),
      delayMs: Math.max(0, parsedDate.getTime() - baseTime),
      isRelative: false,
    };
  }

  return null;
}

// ------------------------------------------------------------
//  FORMATTER FOR OWNER CONFIRMATION
// ------------------------------------------------------------
function formatScheduleDisplay(targetTimestamp) {
  const now = Date.now();
  const diffMs = targetTimestamp - now;
  const targetDate = new Date(targetTimestamp);

  const timeStr = targetDate.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const nowDate = new Date(now).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
  const targetDateStr = targetDate.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });

  let dayLabel = "Today";
  if (targetDateStr !== nowDate) {
    const tomDate = new Date(now + 86400000).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
    dayLabel = targetDateStr === tomDate ? "Tomorrow" : targetDateStr;
  }

  // Human readable relative delay
  let relativeStr = "";
  if (diffMs > 0) {
    const totalSecs = Math.round(diffMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) relativeStr = ` (in ${days} day${days > 1 ? "s" : ""})`;
    else if (hours > 0) relativeStr = ` (in ${hours} hr${hours > 1 ? "s" : ""} ${mins % 60}m)`;
    else if (mins > 0) relativeStr = ` (in ${mins} minute${mins > 1 ? "s" : ""})`;
    else relativeStr = ` (in ${totalSecs} seconds)`;
  }

  return `${dayLabel} at ${timeStr} IST${relativeStr}`;
}

// ------------------------------------------------------------
//  COMMAND PARSER (Pattern & Natural Language Matching)
// ------------------------------------------------------------
function parseScheduleCommand(text) {
  if (!text) return null;
  const clean = text.trim();

  // 1. Fast commands: #scheduled, #listscheduled, show scheduled messages
  if (/^#(?:scheduled|listscheduled|schedules)$/i.test(clean) ||
      /^(?:show|list|view|check)\s+(?:scheduled|pending)\s*(?:messages|tasks)?$/i.test(clean)) {
    return { isListCommand: true };
  }

  // 2. Fast cancel commands: #cancel-schedule, cancel scheduled message to <name>
  const cancelMatch = clean.match(/^#cancel-schedule\s+(.+)$/i) ||
                      clean.match(/^cancel\s+(?:scheduled\s+)?(?:message\s+)?(?:to\s+)?([a-zA-Z0-9 +_#]+)$/i) ||
                      clean.match(/^delete\s+(?:scheduled\s+)?(?:message\s+)?(?:to\s+)?([a-zA-Z0-9 +_#]+)$/i);
  if (cancelMatch) {
    return {
      isCancelCommand: true,
      target: cancelMatch[1].trim(),
    };
  }

  // 3. Fast syntax: #schedule <recipient> <delay/time> <message>
  const hashScheduleMatch = clean.match(/^#schedule\s+([^\s]+)\s+([^\s]+)\s+([\s\S]+)$/i);
  if (hashScheduleMatch) {
    const recipient = hashScheduleMatch[1];
    const timeArg = hashScheduleMatch[2];
    const message = hashScheduleMatch[3];
    const timeParsed = parseScheduleTime(timeArg);
    if (timeParsed) {
      return {
        isScheduleCommand: true,
        recipient,
        timeParsed,
        message,
      };
    }
  }

  // 4. Delay Pattern A: "send <message> to <recipient> after/in <delay>" (e.g. "send hello to dad after 20sec", "send why to dad after 20sec")
  const directDelayMatch = clean.match(/^send\s+([\s\S]+?)\s+to\s+([a-zA-Z0-9 +_#@.-]+?)\s+(?:after|in)\s+(\d+(?:\.\d+)?\s*(?:s|sec|seconds?|m|min|mins?|minutes?|h|hr|hrs?|hours?|d|days?))$/i);
  if (directDelayMatch) {
    const message = directDelayMatch[1].trim().replace(/^["']|["']$/g, "");
    const recipient = directDelayMatch[2].trim();
    const timeParsed = parseScheduleTime(directDelayMatch[3].trim());
    if (timeParsed && message && recipient) {
      return {
        isScheduleCommand: true,
        recipient,
        timeParsed,
        message,
      };
    }
  }

  // 5. Pattern A: "Send this message to <Recipient> after <Time>: <Message>"
  const patA = clean.match(/^send\s+(?:this\s+)?(?:message\s+)?to\s+([a-zA-Z0-9 +_#@.-]+?)\s+(?:after|in|at)\s+([a-zA-Z0-9 :pmAM]+?)\s*:\s*([\s\S]+)$/i);
  if (patA) {
    const recipient = patA[1].trim();
    const timeSpec = patA[2].trim();
    const message = patA[3].trim();
    const timeParsed = parseScheduleTime(timeSpec);
    if (timeParsed) {
      return {
        isScheduleCommand: true,
        recipient,
        timeParsed,
        message,
      };
    }
  }

  // 6. Pattern B: "After/In <Time> send <Recipient> saying/with <Message>"
  const patB = clean.match(/^(?:after|in)\s+([0-9a-zA-Z :]+?)\s+(?:send|message|remind)\s+([a-zA-Z0-9 +_#@.-]+?)(?:\s+(?:saying|that|with message|with|:)\s*|\s*:\s*)([\s\S]+)$/i);
  if (patB) {
    const timeSpec = patB[1].trim();
    const recipient = patB[2].trim();
    const message = patB[3].trim();
    const timeParsed = parseScheduleTime(timeSpec);
    if (timeParsed) {
      return {
        isScheduleCommand: true,
        recipient,
        timeParsed,
        message,
      };
    }
  }

  // 7. Pattern C: "Schedule message to <Recipient> at/after <Time>: <Message>"
  const patC = clean.match(/^schedule\s+(?:message\s+)?to\s+([a-zA-Z0-9 +_#@.-]+?)\s+(?:at|after|in|for)\s+([a-zA-Z0-9 :pmAM]+?)\s*:\s*([\s\S]+)$/i);
  if (patC) {
    const recipient = patC[1].trim();
    const timeSpec = patC[2].trim();
    const message = patC[3].trim();
    const timeParsed = parseScheduleTime(timeSpec);
    if (timeParsed) {
      return {
        isScheduleCommand: true,
        recipient,
        timeParsed,
        message,
      };
    }
  }

  // 8. Instant direct send commands: "send <message> to <recipient>" (e.g. "send hello to mummy", "send to deepa: meeting at 5", "tell mummy hello")
  const directSendA = clean.match(/^send\s+([\s\S]+?)\s+to\s+([a-zA-Z0-9 +_#@.-]+)$/i);
  if (directSendA && !clean.toLowerCase().includes(" after ") && !clean.toLowerCase().includes(" in ")) {
    const message = directSendA[1].trim().replace(/^["']|["']$/g, "");
    const recipient = directSendA[2].trim();
    if (message && recipient) {
      return {
        isDirectSendCommand: true,
        recipient,
        message,
      };
    }
  }

  const directSendB = clean.match(/^send\s+to\s+([a-zA-Z0-9 +_#@.-]+?)(?:\s*:\s*|\s+saying\s+|\s+that\s+|\s+message\s+)([\s\S]+)$/i);
  if (directSendB) {
    const recipient = directSendB[1].trim();
    const message = directSendB[2].trim().replace(/^["']|["']$/g, "");
    if (message && recipient) {
      return {
        isDirectSendCommand: true,
        recipient,
        message,
      };
    }
  }

  const directSendC = clean.match(/^(?:tell|message)\s+([a-zA-Z0-9 +_#@.-]+?)(?:\s+saying\s+|\s+that\s+|\s*:\s*|\s+)([\s\S]+)$/i);
  if (directSendC) {
    const recipient = directSendC[1].trim();
    const message = directSendC[2].trim().replace(/^["']|["']$/g, "");
    if (message && recipient && !/^(?:after|in|tomorrow|today|kal|udya)/i.test(recipient)) {
      return {
        isDirectSendCommand: true,
        recipient,
        message,
      };
    }
  }

  // 9. Recipient follow-up reply: "to Deepa Dinesh Vernekar" or "to 919028833275"
  const directRecipientFollowup = clean.match(/^to\s+([a-zA-Z0-9 +_#@.-]+)$/i);
  if (directRecipientFollowup) {
    return {
      isDirectRecipientReply: true,
      recipient: directRecipientFollowup[1].trim(),
    };
  }

  return null;
}

// ------------------------------------------------------------
//  TASK MANAGEMENT (Add, Cancel, List, Due)
// ------------------------------------------------------------
function addScheduledMessage(recipientInput, targetTimestamp, message, scheduledBy = "Owner") {
  const currentList = loadScheduledMessages();
  const resolved = resolveRecipient(recipientInput);

  const taskId = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const task = {
    id: taskId,
    createdAt: Date.now(),
    targetTimestamp,
    targetTimeFormatted: formatScheduleDisplay(targetTimestamp),
    recipientInput,
    recipientName: resolved?.name || recipientInput,
    recipientPhone: resolved?.phone || null,
    targetChatId: resolved?.chatId || null,
    message,
    scheduledBy,
    status: "PENDING",
    isUnregistered: !!resolved?.isUnregistered,
  };

  currentList.push(task);
  saveScheduledMessages(currentList);

  console.log(`⏰ [SCHEDULED TASK CREATED] ID: ${task.id} | To: ${task.recipientName} | Time: ${task.targetTimeFormatted}`);
  return task;
}

function cancelScheduledMessage(targetQuery) {
  const currentList = loadScheduledMessages();
  const query = String(targetQuery).trim().toLowerCase();

  const idx = currentList.findIndex((m) => {
    if (m.status !== "PENDING") return false;
    if (m.id.toLowerCase() === query) return true;
    if (m.recipientName.toLowerCase().includes(query)) return true;
    if (m.recipientInput && m.recipientInput.toLowerCase().includes(query)) return true;
    if (m.recipientPhone && m.recipientPhone.includes(query.replace(/\D/g, ""))) return true;
    return false;
  });

  if (idx === -1) {
    return {
      success: false,
      message: `Could not find a pending scheduled message matching "${targetQuery}".`,
    };
  }

  const removed = currentList[idx];
  removed.status = "CANCELLED";
  removed.cancelledAt = Date.now();
  saveScheduledMessages(currentList);

  console.log(`🗑️ [SCHEDULE CANCELLED] ID: ${removed.id} for ${removed.recipientName}`);
  return {
    success: true,
    task: removed,
  };
}

function listScheduledMessages() {
  const currentList = loadScheduledMessages();
  return currentList.filter((m) => m.status === "PENDING");
}

function getDueScheduledMessages(currentTime = Date.now()) {
  const currentList = loadScheduledMessages();
  return currentList.filter((m) => m.status === "PENDING" && m.targetTimestamp <= currentTime);
}

function markMessageDelivered(taskId) {
  const currentList = loadScheduledMessages();
  const task = currentList.find((m) => m.id === taskId);
  if (task) {
    task.status = "DELIVERED";
    task.deliveredAt = Date.now();
    saveScheduledMessages(currentList);
  }
}

// ------------------------------------------------------------
//  ACTIVE BACKGROUND RUNNER (In-Memory Poller)
// ------------------------------------------------------------
let schedulerInterval = null;

function startSchedulerEngine(sock, dispatchFn, appendMemoryFn, notifyOwnerFn, ownerJid) {
  if (schedulerInterval) clearInterval(schedulerInterval);

  console.log("⏰ Message Scheduler Engine active (Checking every 3 seconds)");

  schedulerInterval = setInterval(async () => {
    try {
      if (!sock) return;

      const dueTasks = getDueScheduledMessages();
      for (const task of dueTasks) {
        let targetChatId = task.targetChatId;

        // If targetChatId was not known at schedule time, attempt re-resolution
        if (!targetChatId) {
          const resolved = resolveRecipient(task.recipientInput || task.recipientName);
          if (resolved?.chatId) {
            targetChatId = resolved.chatId;
            task.targetChatId = targetChatId;
            task.recipientPhone = resolved.phone;
          }
        }

        if (!targetChatId) {
          console.warn(`⚠️ [SCHEDULER] Cannot deliver to "${task.recipientName}": Chat ID or Phone number not found.`);
          task.status = "FAILED_NO_CHAT_ID";
          task.failedAt = Date.now();
          saveScheduledMessages(loadScheduledMessages().map((t) => (t.id === task.id ? task : t)));

          if (notifyOwnerFn && ownerJid) {
            const failMsg = `⚠️ *[SCHEDULED MESSAGE DELIVERY FAILED]* ❌\n\n👤 *Recipient:* ${task.recipientName}\n💬 *Message:* "${task.message}"\n\n_Reason: Recipient was not found in WhatsApp chat history or phone number was missing._`;
            await notifyOwnerFn(sock, ownerJid, { text: failMsg });
          }
          continue;
        }

        // Dispatch to recipient
        try {
          console.log(`🚀 [DISPATCHING SCHEDULED MESSAGE] To ${task.recipientName} (${targetChatId}): "${task.message}"`);
          if (dispatchFn) {
            await dispatchFn(sock, targetChatId, { text: task.message });
          }

          if (appendMemoryFn) {
            appendMemoryFn(targetChatId, "assistant", task.message, task.recipientName, true);
          }

          markMessageDelivered(task.id);

          // Confirm to Owner
          if (notifyOwnerFn && ownerJid) {
            const deliveryTimeStr = new Date().toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });
            const deliveryAlert = `🚀 *[SCHEDULED MESSAGE DELIVERED]* ⏰✨\n\n👤 *To:* ${task.recipientName} (+${targetChatId.split("@")[0]})\n📅 *Time:* ${deliveryTimeStr} IST\n💬 *Message Delivered:*\n"${task.message}"\n\n_Delivered automatically right on schedule!_ 🤝`;
            await notifyOwnerFn(sock, ownerJid, { text: deliveryAlert });
          }
        } catch (dispatchErr) {
          console.error(`❌ [SCHEDULER ERROR] Failed to dispatch to ${targetChatId}:`, dispatchErr.message);
        }
      }
    } catch (err) {
      console.warn("⚠️ Scheduler loop error:", err.message);
    }
  }, 3000);
}

module.exports = {
  loadScheduledMessages,
  saveScheduledMessages,
  resolveRecipient,
  parseScheduleTime,
  formatScheduleDisplay,
  parseScheduleCommand,
  addScheduledMessage,
  cancelScheduledMessage,
  listScheduledMessages,
  getDueScheduledMessages,
  markMessageDelivered,
  startSchedulerEngine,
};
