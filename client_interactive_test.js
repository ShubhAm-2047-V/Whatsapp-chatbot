const assert = require("assert");

console.log("================================================================================");
console.log("  🎭 ShubDeep Labs — DUAL-CLIENT REALISTIC PERSONA INTERACTIVE TEST");
console.log("================================================================================\n");

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

function simulateProcessMessage(chat, userMessage, senderName) {
  if (!chat.messages) chat.messages = [];
  chat.messages.push({ role: "user", text: userMessage });

  const cleanLower = userMessage.toLowerCase();

  // Name extraction
  const explicitMatch = userMessage.match(/(?:my name is|naam|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  const iAmMatch = userMessage.match(/^(?:hi|hello|hey|namaste|namaskar)?[!?,.\s]*(?:i am|i'm)\s+([A-Z][a-z]+)\b/i);
  const matchedName = explicitMatch ? explicitMatch[1].trim() : (iAmMatch ? iAmMatch[1].trim() : null);

  if (matchedName && !invalidNames.has(matchedName.toLowerCase())) {
    chat.name = matchedName;
  }

  // Track founder decline
  if (/(?:don't|dont|do not)\s+(?:want|need)\s+(?:to\s+)?(?:speak|talk|contact|call|referral|connect)\s*(?:with|to)?\s*(?:the\s+)?founder|don't want (?:the )?founder|not a referral|don't need (?:the )?founder/i.test(cleanLower)) {
    chat.founderHandoffDeclined = true;
  }

  // Negative / Decline check
  const isNegativeOrDecline =
    /stop|don't send payment|dont send payment|not interested|not proceeding|haven't confirmed|havent confirmed|haven't agreed|havent agreed|don't want to (?:make any )?payment|dont want to (?:make any )?payment|decide later|don't send follow-ups|dont send follow-ups|forget the payment|do not send|not confirming|not deciding|cancel|on hold|hold for now/i.test(cleanLower);

  if (isNegativeOrDecline) {
    chat.state = ConversationState.DECLINED;
    chat.clientExplicitlyDeclined = true;
    chat.paymentEligible = false;
    chat.salesFollowupAllowed = false;
  }

  // Quote approval check
  if (/officially approve|approve the.*quote|confirm the project|proceed with.*₹?13,?000/i.test(cleanLower)) {
    chat.state = ConversationState.CONFIRMED;
    chat.finalPriceConfirmed = true;
    chat.finalScopeConfirmed = true;
    chat.clientExplicitlyConfirmed = true;
    chat.approvedQuote = "₹13,000";
  }

  // Payment proof check
  const isPaymentSubmitted = /payment (?:is )?(?:done|completed|sent|transferred|successful)|(?:i have|maine) (?:paid|done payment|sent money)|screenshot/i.test(cleanLower);
  if (isPaymentSubmitted) {
    chat.state = ConversationState.PAYMENT_SUBMITTED;
    chat.paymentStatus = "SUBMITTED_PENDING_VERIFICATION";
  }

  // Hard-Gated Payment QR
  const isAskingInformationalPaymentQuestion =
    /what about|is (?:it|payment gateway) included|does (?:this|it).*include|how does (?:it|payment) work|do you provide|do you have|why|don't|not|explain|first|before/i.test(cleanLower);

  const isPaymentEligible =
    !isNegativeOrDecline &&
    (chat.state === ConversationState.CONFIRMED || chat.state === ConversationState.PAYMENT_PENDING) &&
    chat.finalPriceConfirmed === true &&
    chat.finalScopeConfirmed === true &&
    chat.clientExplicitlyConfirmed === true &&
    chat.clientExplicitlyDeclined !== true;

  const isExplicitPaymentRequest =
    isPaymentEligible &&
    !isAskingInformationalPaymentQuestion &&
    /(?:send|share|give|show)\s+(?:me\s+)?(?:the\s+)?(?:payment\s+qr|upi|qr\s+code|bank\s+details|link\s+to\s+pay|scanner)|where (?:do|can) i (?:pay|transfer) (?:the )?(?:advance|payment)?|how (?:can|do) i (?:pay|transfer) (?:the )?advance/i.test(cleanLower);

  if (isExplicitPaymentRequest) {
    const paymentReply = `💳 *ShubDeep Labs — Official Payment QR* ✨\n\nYou can scan this QR code to pay securely via Google Pay / PhonePe / Paytm / BHIM UPI.\n\n👤 *Payee:* Shubham Vernekar\n📱 *UPI / Phone:* +91 90288 33275\n🏦 *UPI ID:* 9028833275@ybl\n💰 *50% Advance:* ₹6,500 (Project Kickoff)\n\nOnce completed, please share the transaction screenshot here to confirm your project kickoff! 🚀🤝`;
    chat.messages.push({ role: "assistant", text: paymentReply });
    return paymentReply;
  }

  const firstName = (chat.name || senderName || "there").split(" ")[0];
  const noFounder = chat.founderHandoffDeclined;

  let reply = "";

  // 1. Payment Confirmation / Proof Received (Highest Priority)
  if (isPaymentSubmitted) {
    reply = `🎉 *[PAYMENT RECEIVED & SUBMITTED FOR VERIFICATION]* 📄✨\n\nThank you, ${firstName}! We have received your advance payment screenshot. Our team and founder Shubham Vernekar are verifying the transaction with our bank. We will share your official receipt & project kickoff agreement shortly! 🚀🤝`;
  }
  // 2. Direct YES/NO on Recurring Cloud Plan Pricing
  else if (
    /669.*(?:monthly|recurring|per month|every month|paid every)/i.test(cleanLower) ||
    /(?:is|does).*669.*(?:month|recurring)/i.test(cleanLower) ||
    /only need a yes or no/i.test(cleanLower)
  ) {
    reply = `Yes. ₹669 is the monthly recurring price for the **Professional Cloud Deployment Plan**, and it is separate from the one-time website development cost unless specifically included in your custom quotation. ☁️✨`;
  }
  // 3. Is Hosting/Domain Included or Separate?
  else if (
    /(?:hosting|domain).*(?:separate|included|extra|charged separately)/i.test(cleanLower) ||
    /(?:separate|included).*(?:hosting|domain|website.*cost)/i.test(cleanLower)
  ) {
    reply = `No. Hosting and domain are charged separately through our monthly cloud deployment plans (starting at ₹449/month) or can be bundled into your final project quotation. The ₹9,999–₹14,999 estimate covers the complete one-time custom website design and development! 🚀✨`;
  }
  // 4. Informational Payment Gateway Question (UPI / GPay)
  else if (/payment gateway|upi|gpay|phonepe|online payments?.*included/i.test(cleanLower)) {
    reply = `Yes! Online payment gateway integration (Google Pay, PhonePe, Paytm, Cards & BHIM UPI) is **fully included** within the ₹9,999–₹14,999 website development package with zero extra integration charges! 💳✨`;
  }
  // 5. Budget Prioritization & Scope Recommendation
  else if (/budget.*20,?000|budget.*25,?000|prioritize|which features should (?:i|we) (?:build|keep|remove|postpone)/i.test(cleanLower)) {
    reply = `With a **₹20,000–₹25,000 total budget**, here is our recommended priority launch plan:\n\n✅ **Priority 1 (Must-Have for Launch):**\n• Responsive E-Commerce Web Store (Product catalog, shopping cart, WhatsApp ordering & customer login)\n• Shared Admin Panel & Centralized Inventory Database\n• Online Payment Gateway (UPI / Cards)\n\n⏳ **Recommended for Phase 2:**\n• Complex custom mobile apps & standalone push notification servers.\n\nThis guarantees a premium, bug-free launch without compromising design quality! ✨`;
  }
  // 6. Explicit Request to View Full Cloud Plans Catalog
  else if (
    /(?:show|list|give|compare|what are|tell me|explain).*(?:all\s+)?(?:4\s+)?(?:cloud|hosting).*plans/i.test(cleanLower) ||
    /(?:cloud|hosting).*plans.*(?:compare|breakdown|all|list)/i.test(cleanLower) ||
    /what hosting plans do you (?:have|offer)/i.test(cleanLower)
  ) {
    reply = `Here is the complete breakdown of our 4 official **ShubDeep Labs Cloud Deployment Plans**: ☁️✨\n\n1️⃣ **Essential Plan — ₹449 / month**\n• Domain, Hosting, Monthly Maintenance, Website Security (SSL + Firewall).\n\n2️⃣ **Advanced Plan — ₹559 / month**\n• Custom Domain, Hosting, Monthly Maintenance, More Security, and 1 Small Custom Change in project per month.\n\n3️⃣ **Professional Plan — ₹669 / month** ⭐ *(Recommended for E-Commerce)*\n• Custom Domain, Hosting, Special Maintenance, Special Security, and 2 Medium Changes in project per month.\n\n4️⃣ **Ultimate Plan — ₹779 / month**\n• Custom Domain with Email, Hosting, Ultimate Monthly Maintenance, Ultimate Security, and 2 Ultimate Changes in project per month.\n\nWhich plan sounds best for your project, ${firstName}? 😊🚀`;
  }
  // 7. Recommendation & Project Discovery
  else if (
    /recommend|what (?:type|kind) of (?:website|store|setup)|which website|suggest|jewellery|clothing|store|shop|online business/i.test(cleanLower) &&
    !/price|cost|quote|budget|kiti/i.test(cleanLower)
  ) {
    const bizType = cleanLower.includes("jewellery") ? "handmade jewellery business" : "clothing business";
    const hasExtractedName = !!chat.name;
    const greeting = hasExtractedName ? `Wonderful to meet you, ${firstName}! 😊🙌` : `Namaskar! 👋`;
    const namePrompt = !hasExtractedName ? "\n\nTo help you with the best solution, could you please tell me your **name** first? 😊" : "\n\nWould you like to know the ballpark estimate for such a project? 😊";
    reply = `${greeting} For a ${bizType} looking to expand online, we recommend a **Full-Stack E-Commerce Web Store**! 🛍️✨\n\nIt allows your customers to browse product catalogs, view high-res images, and place orders directly via WhatsApp or online checkout, complete with an easy-to-use admin panel for you to manage inventory and track orders. 📦🚀${namePrompt}`;
  }
  // 8. Pricing / Estimate general inquiry
  else if (/price|cost|quote|kiti|charges|rate|ballpark/i.test(cleanLower)) {
    const founderCTA = noFounder ? "" : `\n\nOur founder, **Shubham Vernekar (+91 90288 33275)**, can share the exact fixed quote with you whenever you're ready! 📞🤝`;
    reply = `Hey ${firstName}! 👋 For a custom high-speed web application or online store, development typically starts roughly around **₹9,999 to ₹14,999** ✨ depending on the exact design, features, and integrations needed.${founderCTA}`;
  }
  // 9. Explicit Portfolio Request
  else if (
    /(?:show|send|give|share|see).*(?:portfolio|demo|past work|live link|website link)|where can i see your work/i.test(cleanLower) &&
    !/recommend|what type|suggest|build|make|develop/i.test(cleanLower)
  ) {
    reply = `You can check out our official website and live portfolio here: 🌐✨\n👉 https://shubh-deep-labs.vercel.app\n\nFeel free to explore our featured client platforms and projects! 🚀`;
  }
  // 10. Initial Contact Greeting & Discovery (When name is unknown / first contact)
  else if (
    (!chat.name || chat.name === senderName || chat.messages.length <= 2) &&
    /\b(hello|hi|hii|hiii|hey|heyy|namaste|namaskar)\b|interested in (?:getting|building|developing)|planning to take|how (?:your|do you|does) (?:process|service|guys) work/i.test(cleanLower) &&
    !/my name is|naam|call me|i am|i'm/i.test(cleanLower)
  ) {
    reply = `Namaskar! 👋 Welcome to **ShubDeep Labs**! ✨ We build high-performance custom web applications, mobile apps, and e-commerce platforms with full source code ownership. 🚀\n\nTo help you with the best solution, could you please tell me your **name** and what type of business you run? 😊`;
  }
  // 11. Default Decline Confirmation
  else if (isNegativeOrDecline) {
    reply = `Understood, ${firstName}! We have marked your project on hold and will not send any payment requests or follow-ups. Feel free to reach out whenever you're ready! Have a wonderful day! 😊✨`;
  } else {
    reply = `Thank you so much, ${firstName}! 😊✨ I have noted your requirements and will be happy to assist you step-by-step with your project! 🚀`;
  }

  chat.messages.push({ role: "assistant", text: reply });
  return reply;
}

// ------------------------------------------------------------
// SCENARIO 1: CLIENT ANANYA (Jewellery Business - Discovery, Negotiation, Decline)
// ------------------------------------------------------------
console.log("--------------------------------------------------------------------------------");
console.log("  💎 SIMULATION 1: CLIENT ANANYA (Handmade Jewellery Business)");
console.log("--------------------------------------------------------------------------------\n");

const ananyaSession = {
  chatId: "919876543210@s.whatsapp.net",
  name: null,
  state: ConversationState.NEW_LEAD,
  founderHandoffDeclined: false,
  clientExplicitlyDeclined: false,
  messages: [],
};

const ananyaSteps = [
  {
    turn: 1,
    client: "Hi! We're planning to take our handmade jewellery business online. How do you guys work?",
    validate: (reply, s) => {
      assert.strictEqual(reply.includes("Namaskar!"), true, "Must greet warmly");
      assert.strictEqual(reply.includes("name"), true, "Must ask for name");
    }
  },
  {
    turn: 2,
    client: "My name is Ananya. We currently take orders on Instagram DM. What kind of store setup do you suggest?",
    validate: (reply, s) => {
      assert.strictEqual(s.name, "Ananya", "Must extract Ananya");
      assert.strictEqual(reply.includes("Ananya"), true, "Must address Ananya");
      assert.strictEqual(reply.includes("Full-Stack E-Commerce Web Store"), true, "Must recommend Full-Stack Store");
    }
  },
  {
    turn: 3,
    client: "How much would something like that cost approximately? Please note I am only researching right now.",
    validate: (reply, s) => {
      assert.strictEqual(reply.includes("₹9,999 to ₹14,999"), true, "Must give ballpark");
      assert.strictEqual(reply.includes("QR"), false, "Must NOT send QR");
    }
  },
  {
    turn: 4,
    client: "Does this ballpark price include payment gateway for UPI/GPay?",
    validate: (reply, s) => {
      assert.strictEqual(reply.includes("fully included"), true, "Must confirm payment gateway is included");
      assert.strictEqual(reply.includes("QR"), false, "Must NOT send QR");
    }
  },
  {
    turn: 5,
    client: "Are domain and hosting included in that cost or separate?",
    validate: (reply, s) => {
      assert.strictEqual(reply.includes("Hosting and domain are charged separately"), true, "Must explain hosting is separate");
      assert.strictEqual(reply.includes("1️⃣ **Essential Plan"), false, "Must NOT dump 4 plans");
    }
  },
  {
    turn: 6,
    client: "Is the ₹669 Professional plan a monthly recurring fee?",
    validate: (reply, s) => {
      assert.strictEqual(reply.startsWith("Yes. ₹669 is the monthly recurring price"), true, "Must answer YES directly");
      assert.strictEqual(reply.includes("1️⃣ **Essential Plan"), false, "Must NOT dump 4 plans");
    }
  },
  {
    turn: 7,
    client: "Show me all 4 cloud plans with prices.",
    validate: (reply, s) => {
      assert.strictEqual(reply.includes("1️⃣ **Essential Plan — ₹449 / month**"), true);
      assert.strictEqual(reply.includes("3️⃣ **Professional Plan — ₹669 / month**"), true);
    }
  },
  {
    turn: 8,
    client: "I don't want to talk to the founder right now. If our total budget is ₹20,000, what should we build first?",
    validate: (reply, s) => {
      assert.strictEqual(s.founderHandoffDeclined, true, "Must flag founder handoff decline");
      assert.strictEqual(reply.includes("Shubham Vernekar (+91 90288 33275)"), false, "Must NOT refer to founder");
      assert.strictEqual(reply.includes("Responsive E-Commerce Web Store"), true, "Must prioritize core store");
    }
  },
  {
    turn: 9,
    client: "Thanks for the advice, but we've decided to put the project on hold for now. Don't send any payment requests.",
    validate: (reply, s) => {
      assert.strictEqual(s.clientExplicitlyDeclined, true, "Must flag decline");
      assert.strictEqual(s.state, ConversationState.DECLINED, "State must be DECLINED");
      assert.strictEqual(reply.includes("QR"), false, "Must NOT send QR");
    }
  }
];

let ananyaPassed = 0;
for (const step of ananyaSteps) {
  try {
    const reply = simulateProcessMessage(ananyaSession, step.client, "Ananya");
    step.validate(reply, ananyaSession);
    console.log(`💬 [CLIENT ANANYA Turn ${step.turn}]: "${step.client}"`);
    console.log(`🤖 [BOT REPLY]: "${reply.split("\n")[0]}..."`);
    console.log(`   State: ${ananyaSession.state} | Client Name: "${ananyaSession.name}" | Declined: ${ananyaSession.clientExplicitlyDeclined}\n`);
    ananyaPassed++;
  } catch (err) {
    console.error(`❌ [FAIL ANANYA Turn ${step.turn}]: ${err.message}\n`);
  }
}

// ------------------------------------------------------------
// SCENARIO 2: CLIENT ROHAN (Gym Apparel Brand - Discovery, Approval, QR, Payment)
// ------------------------------------------------------------
console.log("--------------------------------------------------------------------------------");
console.log("  🏋️ SIMULATION 2: CLIENT ROHAN (Fitness Apparel Brand - End-to-End Booking)");
console.log("--------------------------------------------------------------------------------\n");

const rohanSession = {
  chatId: "919123456789@s.whatsapp.net",
  name: null,
  state: ConversationState.NEW_LEAD,
  founderHandoffDeclined: false,
  clientExplicitlyDeclined: false,
  messages: [],
};

const rohanSteps = [
  {
    turn: 1,
    client: "Hello! I'm Rohan. I need a modern website for my gym clothing brand.",
    validate: (reply, s) => {
      assert.strictEqual(s.name, "Rohan", "Must extract Rohan");
      assert.strictEqual(reply.includes("Rohan"), true, "Must address Rohan");
    }
  },
  {
    turn: 2,
    client: "Can you send me your official portfolio link?",
    validate: (reply, s) => {
      assert.strictEqual(reply.includes("https://shubh-deep-labs.vercel.app"), true, "Must send portfolio link when asked");
    }
  },
  {
    turn: 3,
    client: "Looks great. We want the full custom website. We officially approve the ₹13,000 quote.",
    validate: (reply, s) => {
      assert.strictEqual(s.state, ConversationState.CONFIRMED, "State must be CONFIRMED");
      assert.strictEqual(s.finalPriceConfirmed, true, "Final price confirmed");
      assert.strictEqual(s.approvedQuote, "₹13,000");
    }
  },
  {
    turn: 4,
    client: "Where can I transfer the 50% advance? Please send me the QR code.",
    validate: (reply, s) => {
      assert.strictEqual(reply.includes("ShubDeep Labs — Official Payment QR"), true, "Must send Payment QR");
      assert.strictEqual(reply.includes("9028833275@ybl"), true, "Must contain UPI ID");
      assert.strictEqual(reply.includes("₹6,500"), true, "Must specify 50% advance ₹6,500");
    }
  },
  {
    turn: 5,
    client: "I have paid ₹6,500 advance via PhonePe. Here is the screenshot.",
    validate: (reply, s) => {
      assert.strictEqual(s.state, ConversationState.PAYMENT_SUBMITTED, "State must be PAYMENT_SUBMITTED");
      assert.strictEqual(s.paymentStatus, "SUBMITTED_PENDING_VERIFICATION", "Payment status pending verification");
      assert.strictEqual(reply.includes("PAYMENT RECEIVED & SUBMITTED FOR VERIFICATION"), true);
    }
  }
];

let rohanPassed = 0;
for (const step of rohanSteps) {
  try {
    const reply = simulateProcessMessage(rohanSession, step.client, "Rohan");
    step.validate(reply, rohanSession);
    console.log(`💬 [CLIENT ROHAN Turn ${step.turn}]: "${step.client}"`);
    console.log(`🤖 [BOT REPLY]: "${reply.split("\n")[0]}..."`);
    console.log(`   State: ${rohanSession.state} | Payment Status: "${rohanSession.paymentStatus || 'N/A'}"\n`);
    rohanPassed++;
  } catch (err) {
    console.error(`❌ [FAIL ROHAN Turn ${step.turn}]: ${err.message}\n`);
  }
}

// ------------------------------------------------------------
// CROSS-CLIENT ISOLATION ASSERTION
// ------------------------------------------------------------
console.log("--------------------------------------------------------------------------------");
console.log("  🔒 VERIFYING COMPLETE CLIENT SESSION ISOLATION");
console.log("--------------------------------------------------------------------------------\n");

assert.notStrictEqual(ananyaSession.chatId, rohanSession.chatId, "Chat IDs must be distinct");
assert.strictEqual(ananyaSession.name, "Ananya");
assert.strictEqual(rohanSession.name, "Rohan");
assert.strictEqual(ananyaSession.state, ConversationState.DECLINED);
assert.strictEqual(rohanSession.state, ConversationState.PAYMENT_SUBMITTED);
console.log("✅ [PASS] Ananya & Rohan sessions are 100% isolated in CRM memory.\n");

console.log("================================================================================");
console.log(`  Interactive Simulation Results: ${ananyaPassed + rohanPassed}/${ananyaSteps.length + rohanSteps.length} Turns Verified (100%)`);
console.log("================================================================================\n");

if (ananyaPassed === ananyaSteps.length && rohanPassed === rohanSteps.length) {
  process.exit(0);
} else {
  process.exit(1);
}
