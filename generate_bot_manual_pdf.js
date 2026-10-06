const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

function createBotManualPDF(outputPath) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Palette
  const primaryColor = "#0F172A"; // Slate 900
  const secondaryColor = "#1E293B"; // Slate 800
  const accentIndigo = "#4F46E5"; // Indigo 600
  const accentCyan = "#0284C7"; // Sky 600
  const accentGold = "#D97706"; // Amber 600
  const accentEmerald = "#059669"; // Emerald 600
  const textColor = "#334155"; // Slate 700
  const lightBg = "#F8FAFC"; // Slate 50
  const borderColor = "#E2E8F0"; // Slate 200

  // -------------------------------------------------------------
  // HEADER / HERO BANNER
  // -------------------------------------------------------------
  doc.rect(40, 40, 515, 95).fillAndStroke(primaryColor, primaryColor);

  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("SHUBDEEP LABS — ENTERPRISE AI BOT", 55, 55, { characterSpacing: 1 });

  doc
    .fillColor("#38BDF8")
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("Complete Deep Architecture, Features & Capability Manual", 55, 78);

  doc
    .fillColor("#94A3B8")
    .font("Helvetica")
    .fontSize(8.5)
    .text("Founder: Shubham Vernekar (+91 90288 33275)  |  Engine: Baileys + Google Gemini Multi-Key Rotation", 55, 98);

  doc.moveDown(4.5);

  // Helper Functions
  function drawSectionHeader(title, badge = "") {
    const y = doc.y;
    doc.rect(40, y, 515, 24).fill(lightBg);
    doc.rect(40, y, 4, 24).fill(accentIndigo);

    doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(11).text(title, 52, y + 6);
    if (badge) {
      doc.fillColor(accentIndigo).font("Helvetica-Bold").fontSize(8.5).text(badge, 400, y + 7, { align: "right", width: 145 });
    }
    doc.y = y + 32;
  }

  function drawSubheading(title) {
    doc.fillColor(secondaryColor).font("Helvetica-Bold").fontSize(10).text(title);
    doc.moveDown(0.3);
  }

  function drawBullet(title, desc, bulletColor = accentCyan) {
    const y = doc.y;
    doc.circle(48, y + 4.5, 2.5).fill(bulletColor);
    doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(9).text(title + ": ", 58, y, { continued: true });
    doc.fillColor(textColor).font("Helvetica").fontSize(8.5).text(desc);
    doc.moveDown(0.35);
  }

  function drawCallout(text, bgColor = "#EFF6FF", strokeColor = "#BFDBFE", txtColor = "#1E40AF") {
    const y = doc.y;
    doc.rect(40, y, 515, 28).fillAndStroke(bgColor, strokeColor);
    doc.fillColor(txtColor).font("Helvetica-Bold").fontSize(8.5).text(text, 50, y + 8, { width: 495 });
    doc.y = y + 36;
  }

  // -------------------------------------------------------------
  // 1. DUAL-BRAIN ARCHITECTURE
  // -------------------------------------------------------------
  drawSectionHeader("1. DUAL-BRAIN SYSTEM ARCHITECTURE", "Real-Time Context Switching");
  drawBullet("Client Coordinator Brain", "Warm, energetic, persuasive, high-EQ sales agent. Dynamically matches customer language (English, Marathi, Hindi, Hinglish) with natural emojis.", accentIndigo);
  drawBullet("Executive Chief of Staff Brain", "Analytical, obedient, founder co-pilot in Self-Chat. Queries CRM, overrides pricing, creates agreements, and dispatches messages to clients.", accentEmerald);
  doc.moveDown(0.5);

  // -------------------------------------------------------------
  // 2. 6-STAGE SALES & CONSULTATION FUNNEL
  // -------------------------------------------------------------
  drawSectionHeader("2. 6-STAGE CUSTOMER SALES & CLOSING FUNNEL", "End-to-End Automation");
  drawBullet("Stage 1: Warm Greeting & Discovery", "Welcomes first-time leads or returning customers warmly, acknowledges intent, and politely captures client's Name.");
  drawBullet("Stage 2: Project Scope Assessment", "Consults on E-Commerce stores, Gold live rate platforms, School ERPs, Portfolios, or Custom Web/Mobile apps.");
  drawBullet("Stage 3: Natural Ballpark Pricing", "Provides realistic estimates (e.g. ₹9,999 - ₹14,999) without robotic legal disclaimers and introduces Founder for roadmap confirmation.");
  drawBullet("Stage 4: UPI QR & Proposal PDF Dispatch", "Instantly sends official 50% Advance UPI QR code (9028833275@ybl) and generates official branded Proposal PDF with delivery timelines & full source code ownership.");
  drawBullet("Stage 5: Hosting & Maintenance Onboarding", "Proactively guides clients through the 4 official hosting tiers once development is confirmed.");
  drawBullet("Stage 6: Negotiation & Timeline Management", "Politely explains fixed hosting policies and routes express timeline requests (e.g., 'delivery by Saturday') directly to the founder.", accentGold);
  doc.moveDown(0.5);

  // -------------------------------------------------------------
  // 3. HOSTING & MAINTENANCE PLANS TABLE
  // -------------------------------------------------------------
  drawSectionHeader("3. OFFICIAL MONTHLY HOSTING & MAINTENANCE PLANS", "Standardized Specifications");
  
  const tableY = doc.y;
  const colWidths = [105, 75, 235, 100];
  const headers = ["Plan Name", "Price", "Included Features & Maintenance", "Recommended For"];

  // Header Row
  doc.rect(40, tableY, 515, 18).fill(secondaryColor);
  let curX = 40;
  headers.forEach((h, i) => {
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8).text(h, curX + 5, tableY + 5, { width: colWidths[i] - 10 });
    curX += colWidths[i];
  });

  const plans = [
    ["1. Essential Plan", "₹449 / month", "Domain, Hosting, Monthly Maintenance, Website Security (SSL + Firewall).", "Basic Web Pages"],
    ["2. Advanced Plan", "₹559 / month", "Custom Domain, Hosting, Monthly Maintenance, More Security, + 1 Small Custom Change/mo.", "Business Portals"],
    ["3. Professional Plan", "₹669 / month", "Custom Domain, Hosting, Special Maintenance, Special Security, + 2 Medium Changes/mo.", "E-Commerce & Stores ⭐"],
    ["4. Ultimate Plan", "₹779 / month", "Custom Domain with Email, Hosting, Ultimate Monthly Maintenance, Ultimate Security, + 2 Ultimate Changes/mo.", "Enterprise Web Apps"],
  ];

  let rowY = tableY + 18;
  plans.forEach((row, idx) => {
    const isEven = idx % 2 === 0;
    doc.rect(40, rowY, 515, 24).fillAndStroke(isEven ? "#FFFFFF" : lightBg, borderColor);
    let cellX = 40;
    row.forEach((cell, ci) => {
      doc.fillColor(ci === 0 ? primaryColor : (ci === 1 ? accentEmerald : textColor))
         .font(ci < 2 || ci === 3 ? "Helvetica-Bold" : "Helvetica")
         .fontSize(7.5)
         .text(cell, cellX + 5, rowY + 6, { width: colWidths[ci] - 10 });
      cellX += colWidths[ci];
    });
    rowY += 24;
  });

  doc.y = rowY + 12;

  // -------------------------------------------------------------
  // 4. FOUNDER REMOTE CONTROL & SELF-CHAT
  // -------------------------------------------------------------
  drawSectionHeader("4. FOUNDER EXECUTIVE REMOTE CONTROL (SELF-CHAT)", "WhatsApp Co-Pilot");
  drawBullet("Direct Client Relay", "Type 'Send her that price is fixed and cannot be changed' -> AI formats a polite message and sends it directly to the active client's WhatsApp.", accentIndigo);
  drawBullet("Live CRM Intelligence", "Ask 'What is the status of Deepa?' or 'Who wants a gold website?' -> AI pulls full scope, quotation status, payments, and deadlines.", accentEmerald);
  drawBullet("Quote & Agreement Override", "Type 'Quote Deepa 13000' or 'I got payment send agreement' -> Auto-compiles PDF and delivers directly.", accentCyan);
  drawBullet("Admin Fast Commands", "#stats (View lead counts), #pause (Pause bot in chat), #resume (Turn bot back on), #help (Directory).", accentGold);
  doc.moveDown(0.5);

  // -------------------------------------------------------------
  // NEW PAGE: MEMORY, ALERTS & DEFENSE
  // -------------------------------------------------------------
  doc.addPage();

  // Mini Header on Page 2
  doc.rect(40, 40, 515, 30).fill(primaryColor);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(12).text("SHUBDEEP LABS — ENTERPRISE AI BOT MANUAL (PAGE 2)", 55, 50);
  doc.fillColor("#38BDF8").font("Helvetica").fontSize(8.5).text("Memory Architecture, Real-Time Alerts & Enterprise Defense", 340, 51);
  doc.y = 85;

  // -------------------------------------------------------------
  // 5. SUPERCHARGED 50-TURN MEMORY SYSTEM
  // -------------------------------------------------------------
  drawSectionHeader("5. SUPERCHARGED LONG-TERM MEMORY ENGINE", "50-Turn Deep Context");
  drawBullet("50-Turn Persistent Context", "Maintains conversational memory over 50 back-and-forth turns, stored persistently on disk in chat_history.json.", accentIndigo);
  drawBullet("Structured CRM Memory Card", "Extracts and updates Client Name, Project Scope, Deal Status (INQUIRY / WON), Approved Budget, Hosting Plan, and Express Deadlines.", accentEmerald);
  drawBullet("Dynamic Context Injection", "Injects the full Structured Memory Profile into Gemini on every turn so the AI never contradicts itself or re-asks questions.", accentCyan);
  drawBullet("Time-Gap Awareness", "Detects when a customer returns after days/weeks and warmly welcomes them back like an old friend.", accentGold);
  doc.moveDown(0.5);

  // -------------------------------------------------------------
  // 6. REAL-TIME WHATSAPP ALERTS
  // -------------------------------------------------------------
  drawSectionHeader("6. REAL-TIME ALERTS & SMART DISPATCH ENGINE", "Instant Notifications to Founder Phone");
  drawBullet("🚨 [HOT LEAD NOTIFICATION]", "Triggered when high-intent clients ask for price quotes, callbacks, urgent meetings, or proposals.", accentGold);
  drawBullet("🎯 [HOSTING DISCOUNT REQUEST]", "Sent when a client requests discount or custom consideration on monthly hosting plans with full context.", accentCyan);
  drawBullet("💰 [DEAL CLOSED & PAYMENT CONFIRMED]", "Sent when advance payment is received, detailing client email, project scope, and kickoff status.", accentEmerald);
  drawBullet("⏰ 3-Minute Anti-Spam Cooldown", "Prevents alert flooding during rapid typing, with automatic bypass if the client says 'Send him again' or 'Remind Shubham'.", accentIndigo);
  doc.moveDown(0.5);

  // -------------------------------------------------------------
  // 7. MULTIMODAL INTELLIGENCE
  // -------------------------------------------------------------
  drawSectionHeader("7. MULTIMODAL INTELLIGENCE (VISION & VOICE AI)", "Audio & Visual Processing");
  drawBullet("🎙️ Voice Notes Transcription", "Transcribes and analyzes incoming audio voice notes in Marathi, Hindi, and English, replying naturally in the same language.", accentIndigo);
  drawBullet("🖼️ Vision UI & Wireframe Analysis", "Analyzes screenshots of competitor sites or handwritten UI sketches sent by clients to extract scope and feature lists.", accentCyan);
  doc.moveDown(0.5);

  // -------------------------------------------------------------
  // 8. ENTERPRISE DEFENSE & FAIL-SAFE RULES
  // -------------------------------------------------------------
  drawSectionHeader("8. ENTERPRISE DEFENSE & RELIABILITY ARCHITECTURE", "High Availability & Security");
  drawBullet("Zero Echo Loops", "Tracks message key IDs (botSentMsgIds) and template signatures so the bot never processes its own outgoing alerts or replies.", accentEmerald);
  drawBullet("Startup Backlog Discard", "Discards older historical messages received during initial connection sync so it never replies to old chats.", accentIndigo);
  drawBullet("Status & Broadcast Filter", "Completely ignores WhatsApp Stories (status@broadcast), Channel Broadcasts (@newsletter), and Groups (@g.us).", accentGold);
  drawBullet("Founder Typing Privacy", "When you manually chat with a client from your phone, the bot stays silent unless you use an explicit command.", accentCyan);
  drawBullet("Multi-Key API Rotation", "Rotates across 4+ Gemini API keys with multi-model fallback (gemini-2.5-flash-lite -> gemini-2.5-flash).", accentEmerald);
  drawBullet("Deterministic Local Knowledge", "Answers pricing, hosting plans, portfolio links, and contact info locally even during complete API outages.", accentIndigo);
  doc.moveDown(0.5);

  // -------------------------------------------------------------
  // FOOTER BANNER
  // -------------------------------------------------------------
  const footerY = doc.y + 10;
  doc.rect(40, footerY, 515, 42).fillAndStroke("#F1F5F9", borderColor);
  doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(9).text("SHUBDEEP LABS — AUTOMATED REVENUE & CLIENT ENGAGEMENT ENGINE", 55, footerY + 9);
  doc.fillColor(textColor).font("Helvetica").fontSize(8).text("Built with Baileys WhatsApp Multi-Device + Google Gemini Multimodal AI. All rights reserved © 2026.", 55, footerY + 23);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve(outputPath));
    stream.on("error", reject);
  });
}

const targetPath = path.join(__dirname, "ShubDeep_Labs_AI_Agent_Deep_Architecture_Guide.pdf");
createBotManualPDF(targetPath).then(() => {
  console.log("PDF Created Successfully at:", targetPath);
});
