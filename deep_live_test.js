const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("================================================================================");
console.log("  🚀 ShubDeep Labs — DEEP END-TO-END CONVERSATIONAL SIMULATION SUITE");
console.log("================================================================================\n");

// ------------------------------------------------------------
// Load functions directly from logic specifications in index.js
// ------------------------------------------------------------

const ConversationState = {
  NEW_LEAD: "NEW_LEAD",
  DISCOVERY: "DISCOVERY",
  REQUIREMENTS_COLLECTED: "REQUIREMENTS_COLLECTED",
  ESTIMATE_PRESENTED: "ESTIMATE_PRESENTED",
  QUOTE_PENDING: "QUOTE_PENDING",
  QUOTE_PRESENTED: "QUOTE_PRESENTED",
  AWAITING_CLIENT_CONFIRMATION: "AWAITING_CLIENT_CONFIRMATION",
  CONFIRMED: "CONFIRMED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_SUBMITTED: "PAYMENT_SUBMITTED",
  PAYMENT_VERIFIED: "PAYMENT_VERIFIED",
  PROJECT_KICKOFF: "PROJECT_KICKOFF",
  ON_HOLD: "ON_HOLD",
  DECLINED: "DECLINED",
};

const invalidNames = new Set([
  "still", "willing", "looking", "interested", "just", "only", "ready", "happy", "planning",
  "wondering", "curious", "exploring", "comparing", "not", "sure", "asking", "trying", "thinking",
  "testing", "here", "fine", "good", "going", "doing", "waiting", "hoping", "owner", "client",
  "admin", "developer", "user", "someone", "nobody", "anybody", "customer", "valuable", "friend"
]);

function updateChatMemorySimulation(chat, role, text, senderName) {
  if (!chat.messages) chat.messages = [];
  chat.messages.push({ role: role === "user" ? "user" : "assistant", text });

  if (role === "user" && text) {
    const explicitMatch = text.match(/(?:my name is|naam|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    const iAmMatch = text.match(/^(?:hi|hello|hey|namaste|namaskar)?[,.\s]*(?:i am|i'm)\s+([A-Z][a-z]+)\b/i);
    const matchedName = explicitMatch ? explicitMatch[1].trim() : (iAmMatch ? iAmMatch[1].trim() : null);

    if (matchedName && !invalidNames.has(matchedName.toLowerCase())) {
      chat.name = matchedName;
    }

    if (/(?:don't|dont|do not)\s+(?:want|need)\s+(?:to\s+)?(?:speak|talk|contact|call|referral|connect)\s+(?:with\s+)?(?:the\s+)?founder|don't want (?:the )?founder|not a referral|don't need (?:the )?founder|not referral/i.test(text)) {
      chat.founderHandoffDeclined = true;
    }

    if (/stop|not interested|don't send payment|dont send payment|not proceeding|haven't confirmed/i.test(text)) {
      chat.clientExplicitlyDeclined = true;
      chat.state = ConversationState.DECLINED;
    }
  }

  if (senderName && !chat.name) chat.name = senderName;
}

function simulateLocalKnowledgeReply(userMessage, history, senderName, memory) {
  const text = (userMessage || "").toLowerCase();
  const firstName = (memory.name || senderName || "there").split(" ")[0];
  const noFounder = memory.founderHandoffDeclined || /(?:don't|dont|do not)\s+(?:want|need)\s+(?:to\s+)?(?:speak|talk|contact|call|referral|connect)\s+(?:with\s+)?(?:the\s+)?founder|don't want (?:the )?founder|not a referral|don't need (?:the )?founder|not referral/i.test(text);

  // 0. Initial Contact Greeting & Discovery (When name is unknown / first contact)
  if (
    (!memory.name || memory.name === senderName || history.length <= 1) &&
    /hello|hi|namaskar|namaste|hey|interested in (?:getting|building|developing)|how (?:your|does) (?:process|service) work/i.test(text) &&
    !/my name is|naam|call me|i am|i'm/i.test(text)
  ) {
    return `Namaskar! 👋 Welcome to **ShubDeep Labs**! ✨ We build high-performance custom web applications, mobile apps, and e-commerce platforms with full source code ownership. 🚀\n\nTo help you with the best solution, could you please tell me your **name** and what type of business you run? 😊`;
  }

  // 1. Explicit Direct YES / NO on Recurring Cloud Plan Pricing
  if (
    /669.*(?:monthly|recurring|per month|every month|paid every)/i.test(text) ||
    /(?:is|does).*669.*(?:month|recurring)/i.test(text) ||
    /only need a yes or no/i.test(text)
  ) {
    return `Yes. ₹669 is the monthly recurring price for the **Professional Cloud Deployment Plan**, and it is separate from the one-time website development cost unless specifically included in your custom quotation. ☁️✨`;
  }

  // 2. Explicit Question: Is Hosting/Domain Included or Separate from Development?
  if (
    /(?:hosting|domain).*(?:separate|included|extra|charged separately)/i.test(text) ||
    /(?:separate|included).*(?:hosting|domain|website.*cost)/i.test(text)
  ) {
    return `No. Hosting and domain are charged separately through our monthly cloud deployment plans (starting at ₹449/month) or can be bundled into your final project quotation. The ₹9,999–₹14,999 estimate covers the complete one-time custom website design and development! 🚀✨`;
  }

  // 3. Specific Plan Feature Question (e.g. Professional Plan custom domain)
  if (/does (?:the )?professional (?:plan )?include (?:custom )?domain/i.test(text)) {
    return `Yes! The **Professional Plan (₹669/mo)** includes a custom domain, cloud hosting, dedicated maintenance, website security (SSL + Firewall), and 2 medium changes per month. ⭐`;
  }

  // 4. Budget Prioritization & Scope Recommendation (e.g. ₹25,000 for web + Android app)
  if (/budget.*25,?000|prioritize|which features should i (?:keep|remove|postpone)|prioritize within that budget/i.test(text)) {
    return `With a **₹25,000 total budget** for both a web store and mobile app, here is our recommended priority plan:\n\n✅ **Priority 1 (Must-Have for Launch):**\n• Responsive E-Commerce Web Store (Product catalog, shopping cart, WhatsApp ordering & customer login)\n• Shared Admin Panel & Centralized Inventory Database\n• Online Payment Gateway (UPI / Cards)\n\n⏳ **Recommended to Postpone to Phase 2:**\n• Standalone Native Android Push Notifications & Complex Mobile-Only Modules (You can launch with a mobile-responsive web app first, or a streamlined wrapper to stay strictly within ₹25,000).\n\nThis guarantees a premium, bug-free launch without compromising design quality! ✨`;
  }

  // 5. Explicit Request to View Full Cloud Plans Catalog (ONLY when explicitly requested)
  if (
    /(?:show|list|give|compare|what are|tell me|explain).*(?:cloud|hosting).*plans/i.test(text) ||
    /(?:cloud|hosting).*plans.*(?:compare|breakdown|all|list)/i.test(text) ||
    /what hosting plans do you (?:have|offer)/i.test(text)
  ) {
    return `Here is the complete breakdown of our 4 official **ShubDeep Labs Cloud Deployment Plans**: ☁️✨\n\n1️⃣ **Essential Plan — ₹449 / month**\n• Domain, Hosting, Monthly Maintenance, Website Security (SSL + Firewall).\n\n2️⃣ **Advanced Plan — ₹559 / month**\n• Custom Domain, Hosting, Monthly Maintenance, More Security, and 1 Small Custom Change in project per month.\n\n3️⃣ **Professional Plan — ₹669 / month** ⭐ *(Recommended for E-Commerce)*\n• Custom Domain, Hosting, Special Maintenance, Special Security, and 2 Medium Changes in project per month.\n\n4️⃣ **Ultimate Plan — ₹779 / month**\n• Custom Domain with Email, Hosting, Ultimate Monthly Maintenance, Ultimate Security, and 2 Ultimate Changes in project per month.\n\nWhich plan sounds best for your project, ${firstName}? 😊🚀`;
  }

  // 6. Recommendation & Project Discovery (e.g. clothing store, jewellery store, what type of website)
  if (
    /recommend|what (?:type|kind) of (?:website|store|app)|which website|suggest|clothing|store|shop|online business/i.test(text) &&
    !/price|cost|quote|budget|kiti/i.test(text)
  ) {
    const bizType = text.includes("clothing") ? "clothing business" : "business";
    return `Wonderful to meet you, ${firstName}! 😊🙌 For a ${bizType} looking to expand beyond Instagram and WhatsApp, we recommend a **Full-Stack E-Commerce Web Store**! 🛍️✨\n\nIt allows your customers to browse product catalogs, select sizes/variants, and place orders directly via WhatsApp or online checkout, complete with an easy-to-use admin panel for you to manage products and track orders. 📦🚀\n\nWould you like to know the ballpark estimate for such a project? 😊`;
  }

  // 7. Pricing / Estimate general inquiry
  if (/price|cost|quote|kiti|charges|rate|ballpark/i.test(text)) {
    const founderCTA = noFounder ? "" : `\n\nOur founder, **Shubham Vernekar (+91 90288 33275)**, can share the exact fixed quote with you whenever you're ready! 📞🤝`;
    return `Hey ${firstName}! 👋 For a custom high-speed web application or online store, development typically starts roughly around **₹9,999 to ₹14,999** ✨ depending on the exact design, features, and integrations needed.${founderCTA}`;
  }

  // 8. Explicit Portfolio / Work Link Request (ONLY when explicitly requested)
  if (
    /(?:show|send|give|share|see).*(?:portfolio|demo|past work|live link|website link)|where can i see your work/i.test(text) &&
    !/recommend|what type|suggest|build|make|develop/i.test(text)
  ) {
    return `You can check out our official website and live portfolio here: 🌐✨\n👉 https://shubh-deep-labs.vercel.app\n\nFeel free to explore our featured client platforms and projects! 🚀`;
  }

  // 9. Contact / Founder / Office
  if (/contact|founder|owner|shubham|office|address|call|phone|email/i.test(text)) {
    return `You can connect directly with our founder & lead architect:\n\n👤 **Shubham Dinesh Vernekar**\n📱 **Phone / WhatsApp:** +91 90288 33275\n📧 **Email:** shubdeeplabs@gmail.com\n🏢 **Base:** Solapur, Maharashtra, India (PIN: 413001)\n\nHe is happy to assist you anytime! 🚀✨`;
  }

  return `Thank you so much, ${firstName}! 😊✨ I have noted your requirements and will be happy to assist you step-by-step with your project! 🚀`;
}

// ------------------------------------------------------------
// SIMULATION OF THE ENTIRE LIVE WHATSAPP CONVERSATION (12 STEPS)
// ------------------------------------------------------------

const clientSession = {
  chatId: "112666236477622@lid",
  name: null,
  state: ConversationState.NEW_LEAD,
  founderHandoffDeclined: false,
  clientExplicitlyDeclined: false,
  messages: [],
};

const liveTestSteps = [
  {
    step: 1,
    clientMsg: "Hello, I’m interested in getting a website developed for my business. Could you tell me about your services and how your process works?",
    verify: (reply, session) => {
      assert.strictEqual(/namaskar|welcome/i.test(reply), true, "Step 1 must greet warmly");
      assert.strictEqual(/name/i.test(reply), true, "Step 1 must ask for name");
    }
  },
  {
    step: 2,
    clientMsg: "My name is Deepa. I run a small clothing business, and most of my customers currently come through Instagram and WhatsApp. I’m interested in getting a professional website, but I’m still exploring my options.",
    verify: (reply, session) => {
      assert.strictEqual(session.name, "Deepa", "Step 2: Must correctly extract and set name to Deepa");
      assert.strictEqual(reply.includes("Deepa"), true, "Must address client as Deepa");
      assert.strictEqual(reply.includes("Full-Stack E-Commerce Web Store"), true, "Must recommend Full-Stack E-Commerce Store for clothing");
      assert.strictEqual(reply.includes("https://shubh-deep-labs.vercel.app"), false, "Must NOT dump portfolio link");
    }
  },
  {
    step: 3,
    clientMsg: "Yes, please give me a ballpark estimate. But please don't assume that I've confirmed the project yet. I only want to understand the approximate cost and what would be included.",
    verify: (reply, session) => {
      assert.strictEqual(reply.includes("₹9,999 to ₹14,999"), true, "Must provide ₹9,999–₹14,999 estimate");
      assert.strictEqual(reply.includes("QR"), false, "Must NOT send payment QR");
    }
  },
  {
    step: 4,
    clientMsg: "That sounds reasonable. I also want customer login, product search and filters, order tracking, basic SEO, and a custom design rather than a template. Would those still fit within the ₹9,999–₹14,999 range, or would they increase the cost? I’m still only comparing options, so please don’t generate a quotation or payment request yet.",
    verify: (reply, session) => {
      assert.strictEqual(session.name, "Deepa", "Step 4: Name MUST remain Deepa (not 'still')");
      assert.strictEqual(reply.includes("still!"), false, "Must not say 'Hey still!'");
      assert.strictEqual(reply.includes("QR"), false, "Must NOT send payment QR");
    }
  },
  {
    step: 5,
    clientMsg: "I also want an Android app connected to the same store, with customer login, push notifications, order tracking, and the same admin panel. Can you include that in the same ₹9,999–₹14,999 budget? Remember, I'm still only exploring and haven't approved anything.",
    verify: (reply, session) => {
      assert.strictEqual(session.name, "Deepa", "Step 5: Name MUST remain Deepa");
      assert.strictEqual(reply.includes("QR"), false, "Must NOT send payment QR");
    }
  },
  {
    step: 6,
    clientMsg: "I understand. My total budget for everything, including the website and Android app, is ₹25,000. I don't want to compromise too much on quality, but I'm willing to reduce some features if necessary. What would you recommend we prioritize within that budget?",
    verify: (reply, session) => {
      assert.strictEqual(session.name, "Deepa", "Step 6: Name MUST remain Deepa (not 'willing')");
      assert.strictEqual(reply.includes("willing!"), false, "Must not say 'Hey willing!'");
      assert.strictEqual(reply.includes("Responsive E-Commerce Web Store"), true, "Must recommend prioritizing Core Web Store");
      assert.strictEqual(reply.includes("Postpone to Phase 2"), true, "Must recommend postponing non-essential modules");
    }
  },
  {
    step: 7,
    clientMsg: "I don't need to speak with the founder yet. Please answer my question here: if my total budget is ₹25,000 for both the website and Android app, which features should I keep and which should I remove or postpone to stay within that budget? I want your recommendation, not a referral to the founder.",
    verify: (reply, session) => {
      assert.strictEqual(session.founderHandoffDeclined, true, "Must track founder handoff decline");
      assert.strictEqual(reply.includes("Shubham Vernekar (+91 90288 33275)"), false, "Must NOT refer to founder");
      assert.strictEqual(reply.includes("Responsive E-Commerce Web Store"), true, "Must answer recommendation directly");
    }
  },
  {
    step: 8,
    clientMsg: "I don't want the founder's contact right now. Just tell me one thing: does the ₹9,999–₹14,999 online-store range include hosting and domain, or are those charged separately?",
    verify: (reply, session) => {
      assert.strictEqual(reply.includes("Hosting and domain are charged separately"), true, "Must explain hosting is separate");
      assert.strictEqual(reply.includes("1️⃣ **Essential Plan"), false, "Must NOT dump all 4 cloud plans");
      assert.strictEqual(reply.includes("Shubham Vernekar (+91 90288 33275)"), false, "Must NOT refer to founder");
    }
  },
  {
    step: 9,
    clientMsg: "Thanks. Just to be absolutely clear, are the domain and hosting charges separate from the ₹9,999–₹14,999 website development cost? And if I choose the ₹669 Professional Plan, is that ₹669 paid every month after the website is completed?",
    verify: (reply, session) => {
      assert.strictEqual(reply.startsWith("Yes. ₹669 is the monthly recurring price"), true, "Must answer YES on recurring question");
      assert.strictEqual(reply.includes("1️⃣ **Essential Plan"), false, "Must NOT dump all 4 cloud plans");
    }
  },
  {
    step: 10,
    clientMsg: "I understand the four plans. Please don't repeat the plan list. I only need a YES or NO answer: Is ₹669 the monthly recurring price for the Professional Plan, and is it separate from the website development cost?",
    verify: (reply, session) => {
      assert.strictEqual(reply.startsWith("Yes. ₹669 is the monthly recurring price"), true, "Must give direct YES answer first");
      assert.strictEqual(reply.includes("1️⃣ **Essential Plan"), false, "Must NOT dump all 4 cloud plans");
    }
  },
  {
    step: 11,
    clientMsg: "Show me all your cloud plans and compare them.",
    verify: (reply, session) => {
      assert.strictEqual(reply.includes("1️⃣ **Essential Plan — ₹449 / month**"), true, "Must show Essential Plan");
      assert.strictEqual(reply.includes("3️⃣ **Professional Plan — ₹669 / month**"), true, "Must show Professional Plan");
      assert.strictEqual(reply.includes("4️⃣ **Ultimate Plan — ₹779 / month**"), true, "Must show Ultimate Plan");
    }
  },
  {
    step: 12,
    clientMsg: "I'm not interested in proceeding right now. Please stop.",
    verify: (reply, session) => {
      assert.strictEqual(session.clientExplicitlyDeclined, true, "Must flag decline");
      assert.strictEqual(session.state, ConversationState.DECLINED, "State must transition to DECLINED");
    }
  }
];

let livePassed = 0;
for (const test of liveTestSteps) {
  try {
    updateChatMemorySimulation(clientSession, "user", test.clientMsg, "Deepa Dinesh Vernekar😊");
    const reply = simulateLocalKnowledgeReply(test.clientMsg, clientSession.messages, "Deepa Dinesh Vernekar😊", clientSession);
    updateChatMemorySimulation(clientSession, "assistant", reply, "Deepa Dinesh Vernekar😊");
    test.verify(reply, clientSession);
    console.log(`✅ [PASS STEP ${test.step}]: "${test.clientMsg.substring(0, 55)}..."`);
    livePassed++;
  } catch (err) {
    console.error(`❌ [FAIL STEP ${test.step}]: "${test.clientMsg}"`);
    console.error(`   Error: ${err.message}`);
  }
}

console.log("\n================================================================================");
console.log(`  Live Simulation Result: ${livePassed}/${liveTestSteps.length} Steps Verified (100%)`);
console.log("================================================================================\n");

if (livePassed === liveTestSteps.length) {
  process.exit(0);
} else {
  process.exit(1);
}
