const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

/**
 * Sanitizes strings for standard PDFKit fonts (removes emojis, cleans ASCII)
 */
function sanitizePdfText(str) {
  if (!str) return "";
  return String(str)
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}]/gu, "")
    .replace(/₹/g, "Rs. ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E\n\r\t]/g, "")
    .trim();
}

/**
 * Vector Icon Helpers (Pure vector graphics, 100% crisp without emoji glitches)
 */
function drawUserAvatar(doc, cx, cy) {
  doc.save();
  doc.fillColor("#ffffff");
  doc.circle(cx, cy - 4, 5).fill();
  doc.path(`M ${cx - 8} ${cy + 10} C ${cx - 8} ${cy + 5}, ${cx + 8} ${cy + 5}, ${cx + 8} ${cy + 10} Z`).fill();
  doc.restore();
}

function drawCheckBadge(doc, cx, cy) {
  doc.save();
  doc.circle(cx, cy, 5.5).fill("#fbbf24");
  doc.lineWidth(1.2).strokeColor("#ffffff");
  doc.moveTo(cx - 2.5, cy).lineTo(cx - 0.5, cy + 2).lineTo(cx + 2.5, cy - 2).stroke();
  doc.restore();
}

function drawCalendarIcon(doc, x, y) {
  doc.save();
  doc.lineWidth(0.8).strokeColor("#d97706").fillColor("#fef3c7");
  doc.roundedRect(x, y, 10, 10, 1.5).fillAndStroke();
  doc.rect(x, y, 10, 3).fill("#d97706");
  doc.strokeColor("#d97706").lineWidth(0.6);
  doc.moveTo(x + 2.5, y - 1).lineTo(x + 2.5, y + 1.2).stroke();
  doc.moveTo(x + 7.5, y - 1).lineTo(x + 7.5, y + 1.2).stroke();
  doc.restore();
}

function drawDocIcon(doc, x, y) {
  doc.save();
  doc.lineWidth(0.8).strokeColor("#d97706").fillColor("#fef3c7");
  doc.roundedRect(x, y, 9, 11, 1.5).fillAndStroke();
  doc.strokeColor("#d97706").lineWidth(0.6);
  doc.moveTo(x + 2, y + 3.5).lineTo(x + 7, y + 3.5).stroke();
  doc.moveTo(x + 2, y + 6).lineTo(x + 7, y + 6).stroke();
  doc.moveTo(x + 2, y + 8.5).lineTo(x + 5, y + 8.5).stroke();
  doc.restore();
}

function drawFolderIcon(doc, x, y) {
  doc.save();
  doc.lineWidth(0.8).strokeColor("#d97706").fillColor("#fef3c7");
  doc.roundedRect(x, y + 2, 11, 8.5, 1.5).fillAndStroke();
  doc.rect(x + 1, y, 4.5, 2.5).fill("#d97706");
  doc.restore();
}

function drawPhoneIcon(doc, x, y) {
  doc.save();
  doc.lineWidth(0.8).strokeColor("#4c1d95").fillColor("#faf5ff");
  doc.roundedRect(x, y, 7, 10, 1.5).fillAndStroke();
  doc.fillColor("#4c1d95").circle(x + 3.5, y + 8, 0.7).fill();
  doc.restore();
}

function drawMailIcon(doc, x, y) {
  doc.save();
  doc.lineWidth(0.8).strokeColor("#4c1d95").fillColor("#faf5ff");
  doc.roundedRect(x, y, 10, 7.5, 1).fillAndStroke();
  doc.strokeColor("#4c1d95").lineWidth(0.6);
  doc.moveTo(x, y).lineTo(x + 5, y + 4).lineTo(x + 10, y).stroke();
  doc.restore();
}

function drawShieldIcon(doc, cx, cy) {
  doc.save();
  doc.lineWidth(1).strokeColor("#d97706").fillColor("#fef3c7");
  doc.path(`M ${cx - 5} ${cy - 5} L ${cx + 5} ${cy - 5} L ${cx + 5} ${cy} C ${cx + 5} ${cy + 5}, ${cx} ${cy + 7}, ${cx} ${cy + 7} C ${cx} ${cy + 7}, ${cx - 5} ${cy + 5}, ${cx - 5} ${cy} Z`).fillAndStroke();
  doc.restore();
}

function drawGoldSealBadge(doc, cx, cy, radius = 22) {
  doc.save();
  // Outer gold rim
  doc.circle(cx, cy, radius).lineWidth(1.5).strokeColor("#d97706").fillColor("#fefce8").fillAndStroke();
  doc.circle(cx, cy, radius - 2.5).lineWidth(0.6).strokeColor("#fbbf24").stroke();
  // Inner document icon
  drawDocIcon(doc, cx - 4.5, cy - 6);
  doc.restore();
}

function drawFiligreeLine(doc, startX, endX, y) {
  doc.save();
  doc.lineWidth(0.8).strokeColor("#d97706");
  doc.moveTo(startX, y).lineTo(endX, y).stroke();
  const midX = (startX + endX) / 2;
  doc.fillColor("#d97706").fontSize(5).text("*", midX - 2, y - 2.5);
  doc.restore();
}

/**
 * Generates an executive, luxury branded single-page PDF combining:
 * 1. Project Agreement & Scope Confirmation
 * 2. Official Payment Receipt & Financial Settlement Details
 */
function generateQuotationPDF(data = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        autoFirstPage: true,
        bufferPages: true,
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const logoPath = path.join(__dirname, "..", "assets", "logo.jpg");
      const signCardPath = path.join(__dirname, "..", "assets", "signature_card.png");

      // Brand Color Palette
      const purpleDark = "#1e1b4b";   // Deep Royal Navy/Purple
      const purpleBrand = "#4c1d95";  // Royal Violet
      const goldAccent = "#d97706";   // Amber Gold
      const goldOchre = "#b45309";    // Deep Gold
      const emeraldGreen = "#059669"; // Confirmed Emerald
      const cyanBadge = "#0284c7";    // Sky Blue
      const cardBg = "#faf5ff";       // Subtle Luxury Lavender tint
      const cardBorder = "#e9d5ff";   // Soft Purple border
      const textPrimary = "#0f172a";  // Dark Slate
      const textSecondary = "#475569";// Muted Slate

      // Data extraction with realistic defaults
      const clientName = sanitizePdfText(data.clientName || "Deepa Dinesh Vernekar");
      const projectType = sanitizePdfText(data.projectType || "Gold & Jewellery E-Commerce Platform & Real-Time Rates Engine");
      const timeline = sanitizePdfText(data.timeline || "2-3 Weeks");
      const currentDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      const currentYear = new Date().getFullYear();

      // Financial & Receipt Details
      const isPaid = data.isPaymentCompleted !== false && !/pending/i.test(data.priceRange || "");
      const totalProjectVal = "Rs. 13,000";
      const advanceRequired = "Rs. 6,500 (50%)";
      const amountReceived = isPaid ? "Rs. 6,500" : "Rs. ________";
      const balanceDue = isPaid ? "Rs. 6,500" : "Rs. 13,000";
      const paymentStatus = isPaid ? "ADVANCE RECEIVED" : "PAYMENT PENDING";
      const paymentMethod = isPaid ? "UPI (9028833275@ybl) / Bank" : "Pending Kickoff";
      const transactionId = isPaid ? "UPI456789012345" : "Pending";
      const receiptNo = data.receiptNo || `SDL-RCP-${currentYear}-001`;
      const projectRef = data.projectRef || `SDL-PRO-7-${currentYear}`;

      // =============================================================
      // 0. LUXURY PAGE BORDER & CORNER ACCENTS
      // =============================================================
      doc.save();
      // Outer subtle page border
      doc.roundedRect(12, 12, doc.page.width - 24, doc.page.height - 24, 8)
        .lineWidth(0.8).strokeColor("#e2e8f0");

      // Top-Right Luxury Gold & Purple Ribbon Arcs
      doc.lineWidth(3.5).strokeColor(goldAccent);
      doc.path("M 450 0 C 525 0, 595 40, 595 105").stroke();
      doc.lineWidth(6).strokeColor(purpleDark);
      doc.path("M 475 0 C 540 0, 595 30, 595 90").stroke();

      // Bottom-Left Luxury Ribbon
      doc.lineWidth(3.5).strokeColor(goldAccent);
      doc.path("M 0 740 C 0 802, 65 842, 140 842").stroke();
      doc.lineWidth(6).strokeColor(purpleDark);
      doc.path("M 0 755 C 0 814, 50 842, 120 842").stroke();

      // Bottom-Right Luxury Ribbon
      doc.lineWidth(3.5).strokeColor(goldAccent);
      doc.path("M 450 842 C 525 842, 595 802, 595 740").stroke();
      doc.lineWidth(6).strokeColor(purpleDark);
      doc.path("M 475 842 C 540 842, 595 814, 595 755").stroke();
      doc.restore();

      // =============================================================
      // 1. SUBTLE BACKGROUND WATERMARK (Center of Page)
      // =============================================================
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.opacity(0.04);
        const wmSize = 330;
        const wmX = (doc.page.width - wmSize) / 2;
        const wmY = 255;
        doc.image(logoPath, wmX, wmY, { width: wmSize, height: wmSize });
        doc.restore();
      }

      // =============================================================
      // 2. HEADER BRANDING & DUAL DOCUMENT IDENTITY
      // =============================================================
      const logoSize = 62;
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.image(logoPath, 24, 16, { width: logoSize, height: logoSize });
        doc.restore();
      }

      const brandStartX = fs.existsSync(logoPath) ? 94 : 24;
      // SHUBDEEP (Navy) + LABS (Ochre Gold)
      doc.fillColor(purpleDark).fontSize(22).font("Helvetica-Bold")
        .text("SHUBDEEP", brandStartX, 18, { continued: true })
        .fillColor(goldOchre).text(" LABS");

      doc.fillColor(textPrimary).fontSize(8).font("Helvetica-Bold")
        .text("Global Software Engineering & Custom AI Solutions Studio", brandStartX, 43);

      doc.fillColor(goldOchre).fontSize(7.5).font("Helvetica-Oblique")
        .text("Empowering Businesses with Next-Gen Digital Architecture", brandStartX, 54);

      // Right Document Metadata Box: PROJECT AGREEMENT & PAYMENT RECEIPT
      const metaX = 336;
      doc.fillColor(purpleDark).fontSize(8.6).font("Helvetica-Bold")
        .text("PROJECT AGREEMENT & PAYMENT RECEIPT", metaX, 17, { width: 230, align: "left" });

      // Receipt No
      drawDocIcon(doc, metaX, 31);
      doc.fillColor(textPrimary).fontSize(7.5).font("Helvetica-Bold")
        .text("Receipt No.   :  ", metaX + 15, 32, { continued: true })
        .fillColor(purpleBrand).text(receiptNo);

      // Project Ref
      drawFolderIcon(doc, metaX, 44);
      doc.fillColor(textPrimary).fontSize(7.5).font("Helvetica-Bold")
        .text("Project Ref.   :  ", metaX + 15, 46, { continued: true })
        .text(projectRef);

      // Date
      drawCalendarIcon(doc, metaX, 58);
      doc.fillColor(textPrimary).fontSize(7.5).font("Helvetica-Bold")
        .text("Date              :  ", metaX + 15, 59, { continued: true })
        .fillColor(textSecondary).font("Helvetica").text(currentDate);

      // =============================================================
      // 3. TOP CLIENT & AUTHORIZED REPRESENTATIVE CARDS (Height: 56)
      // =============================================================
      let curY = 78;
      const halfWidth = 268;
      const topCardH = 56;

      // --- Left Card: PREPARED FOR (CLIENT PARTNER) ---
      doc.roundedRect(24, curY, halfWidth, topCardH, 5).fillAndStroke(cardBg, cardBorder);

      doc.circle(42, curY + 28, 13).fill(purpleDark);
      drawUserAvatar(doc, 42, curY + 28);

      doc.fillColor(purpleBrand).fontSize(7.2).font("Helvetica-Bold")
        .text("PREPARED FOR (CLIENT PARTNER)", 62, curY + 8);
      doc.fillColor(textPrimary).fontSize(10).font("Helvetica-Bold")
        .text(clientName, 62, curY + 19);
      doc.fillColor(textSecondary).fontSize(7.2).font("Helvetica")
        .text("Project Partner / Authorized Signatory", 62, curY + 31);
      doc.fillColor(emeraldGreen).fontSize(7.2).font("Helvetica-Bold")
        .text("Status: Verified & Active Engagement", 62, curY + 42);

      // --- Right Card: AUTHORIZED REPRESENTATIVE ---
      const rightCardX = 302;
      doc.roundedRect(rightCardX, curY, halfWidth, topCardH, 5).fillAndStroke(cardBg, cardBorder);

      doc.circle(rightCardX + 18, curY + 28, 13).fill(purpleDark);
      drawUserAvatar(doc, rightCardX + 18, curY + 28);

      doc.fillColor(purpleBrand).fontSize(7.2).font("Helvetica-Bold")
        .text("AUTHORIZED REPRESENTATIVE", rightCardX + 38, curY + 8);
      doc.fillColor(textPrimary).fontSize(10).font("Helvetica-Bold")
        .text("Shubham Vernekar", rightCardX + 38, curY + 19);
      doc.fillColor(textSecondary).fontSize(7.2).font("Helvetica")
        .text("Founder & Principal Architect, ShubDeep Labs", rightCardX + 38, curY + 31);

      // Phone & Email
      drawPhoneIcon(doc, rightCardX + 38, curY + 42);
      doc.fillColor(purpleDark).fontSize(7).font("Helvetica-Bold")
        .text("+91 90288 33275", rightCardX + 48, curY + 43);

      drawMailIcon(doc, rightCardX + 128, curY + 43);
      doc.fillColor(purpleDark).fontSize(7).font("Helvetica-Bold")
        .text("shubdeeplabs@gmail.com", rightCardX + 141, curY + 43);

      // =============================================================
      // 4. SECTION 01: PROJECT OVERVIEW & TECHNICAL SCOPE OF WORK
      // =============================================================
      curY += topCardH + 12;

      // Section Number Badge "01"
      doc.roundedRect(24, curY, 24, 16, 3).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold")
        .text("01", 24, curY + 3.5, { width: 24, align: "center" });

      doc.fillColor(purpleDark).fontSize(9.5).font("Helvetica-Bold")
        .text("PROJECT OVERVIEW & TECHNICAL SCOPE OF WORK", 54, curY + 3.5);

      drawFiligreeLine(doc, 320, 420, curY + 9);

      curY += 19;
      doc.fillColor(purpleBrand).fontSize(8).font("Helvetica-Bold")
        .text("Project Category: ", 24, curY, { continued: true })
        .fillColor(textPrimary).text(projectType);

      curY += 13;

      // --- Left Deliverables Column (4 items) ---
      const col1X = 24;
      const col2X = 196;
      let dY1 = curY;
      const col1Items = [
        "Modern, User-Responsive UI/UX Layout\n(Mobile, Tablet & Desktop Optimized)",
        "Secure High-Speed Backend Architecture & Cloud Database Integration",
        "Full E-Commerce Catalog, Shopping Cart & Live Daily Market Rate Engine",
        "Online Payment Gateway Integration\n(Instant UPI QR, Razorpay & Cards)",
      ];

      col1Items.forEach((text) => {
        drawCheckBadge(doc, col1X + 6, dY1 + 6);
        doc.fillColor(textPrimary).fontSize(7).font("Helvetica-Bold")
          .text(text, col1X + 16, dY1 + 1.5, { width: 154, lineGap: 1.5 });
        dY1 += 26;
      });

      // --- Middle Deliverables Column (3 items) ---
      let dY2 = curY;
      const col2Items = [
        "Admin Management Portal for Products, Inventory & Live Tracking",
        "100% Full Unencumbered Source Code Ownership (Zero Lock-in)",
        "Production Deployment & 30-Day SLA Engineering Support",
      ];

      col2Items.forEach((text) => {
        drawCheckBadge(doc, col2X + 6, dY2 + 6);
        doc.fillColor(textPrimary).fontSize(7).font("Helvetica-Bold")
          .text(text, col2X + 16, dY2 + 1.5, { width: 158, lineGap: 1.5 });
        dY2 += 26;
      });

      // --- Right Box: PAYMENT RECEIPT SIDE-CARD (Matching Mockup) ---
      const receiptCardSideX = 384;
      const receiptCardSideY = curY - 7;
      const receiptCardSideW = 186;
      const receiptCardSideH = 114;

      doc.roundedRect(receiptCardSideX, receiptCardSideY, receiptCardSideW, receiptCardSideH, 8)
        .fillAndStroke("#ffffff", cardBorder);

      // Gold Embossed Round Seal Icon at Top Center
      drawGoldSealBadge(doc, receiptCardSideX + (receiptCardSideW / 2), receiptCardSideY + 28, 20);

      // Title
      doc.fillColor(purpleDark).fontSize(9).font("Helvetica-Bold")
        .text("PAYMENT RECEIPT", receiptCardSideX, receiptCardSideY + 56, { width: receiptCardSideW, align: "center" });

      // Body Disclaimer
      doc.fillColor(textSecondary).fontSize(7.2).font("Helvetica")
        .text("This document is a payment receipt\nand project acknowledgment.", receiptCardSideX + 10, receiptCardSideY + 70, { width: receiptCardSideW - 20, align: "center", lineGap: 1 })
        .text("It is not a tax invoice.", receiptCardSideX + 10, receiptCardSideY + 92, { width: receiptCardSideW - 20, align: "center" });

      drawFiligreeLine(doc, receiptCardSideX + 30, receiptCardSideX + receiptCardSideW - 30, receiptCardSideY + 105);

      // =============================================================
      // 5. SECTION 02: COMMERCIAL INVESTMENT & PAYMENT RECEIPT
      // =============================================================
      curY = 276;

      // Section Number Badge "02"
      doc.roundedRect(24, curY, 24, 16, 3).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold")
        .text("02", 24, curY + 3.5, { width: 24, align: "center" });

      doc.fillColor(purpleDark).fontSize(9.5).font("Helvetica-Bold")
        .text("COMMERCIAL INVESTMENT & PAYMENT RECEIPT", 54, curY + 3.5);

      drawFiligreeLine(doc, 310, 420, curY + 9);

      curY += 19;

      // --- Left Box: COMMERCIAL INVESTMENT BREAKDOWN (Width: 268, Height: 156) ---
      const commW = 268;
      const cardHeight = 156;

      doc.roundedRect(24, curY, commW, cardHeight, 6).fillAndStroke("#ffffff", cardBorder);

      // Header Bar
      doc.roundedRect(24, curY, commW, 20, 4).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold")
        .text("COMMERCIAL INVESTMENT BREAKDOWN", 36, curY + 5.5);

      let cY = curY + 28;
      // Row 1: Total Agreed Project Value
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Total Agreed Project Value", 36, cY);
      doc.fillColor(purpleDark).fontSize(9).font("Helvetica-Bold")
        .text(totalProjectVal, 175, cY, { width: 105, align: "right" });

      cY += 19;
      // Row 2: Booking Advance Required (50%)
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Booking Advance Required (50%)", 36, cY);
      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text(advanceRequired, 175, cY, { width: 105, align: "right" });

      cY += 19;
      // Row 3: Estimated Timeline
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Project Delivery Timeline", 36, cY);
      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text(timeline, 175, cY, { width: 105, align: "right" });

      cY += 19;
      // Row 4: Final Milestone on Handover (50%)
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Final Milestone on Handover (50%)", 36, cY);
      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text("Rs. 6,500", 175, cY, { width: 105, align: "right" });

      cY += 23;
      // Summary Highlight Box with Gold Shield
      doc.roundedRect(32, cY, commW - 16, 28, 4).fill(cardBg);
      doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica-Bold")
        .text("Deliverable Handover:", 42, cY + 5);
      doc.fillColor(textSecondary).font("Helvetica").fontSize(7)
        .text("Full Source Code & Cloud Staging Handover", 42, cY + 16);

      // Gold shield icon on right of handover box
      drawShieldIcon(doc, 32 + commW - 32, cY + 14);

      // --- Right Box: PAYMENT ACKNOWLEDGEMENT RECEIPT (Width: 268, Height: 156) ---
      const receiptCardX = 302;
      doc.roundedRect(receiptCardX, curY, commW, cardHeight, 6).fillAndStroke("#ffffff", cardBorder);

      // Header Bar
      doc.roundedRect(receiptCardX, curY, commW, 20, 4).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold")
        .text("PAYMENT ACKNOWLEDGEMENT RECEIPT", receiptCardX + 12, curY + 5.5);

      let rY = curY + 26;
      // Receipt Details Rows
      doc.fillColor(textSecondary).fontSize(7.2).font("Helvetica")
        .text("Receipt Number", receiptCardX + 12, rY);
      doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica-Bold")
        .text(receiptNo, receiptCardX + 140, rY, { width: 116, align: "right" });

      rY += 12;
      doc.fillColor(textSecondary).fontSize(7.2).font("Helvetica")
        .text("Project Reference", receiptCardX + 12, rY);
      doc.fillColor(textPrimary).fontSize(7.5).font("Helvetica-Bold")
        .text(projectRef, receiptCardX + 140, rY, { width: 116, align: "right" });

      rY += 12;
      doc.fillColor(textSecondary).fontSize(7.2).font("Helvetica")
        .text("Payment Date", receiptCardX + 12, rY);
      doc.fillColor(textPrimary).fontSize(7.5).font("Helvetica-Bold")
        .text(currentDate, receiptCardX + 140, rY, { width: 116, align: "right" });

      rY += 13;
      doc.fillColor(textSecondary).fontSize(7.2).font("Helvetica")
        .text("Amount Received (Advance)", receiptCardX + 12, rY);
      doc.fillColor(emeraldGreen).fontSize(9.5).font("Helvetica-Bold")
        .text(amountReceived, receiptCardX + 140, rY - 1, { width: 116, align: "right" });

      rY += 13;
      doc.fillColor(textSecondary).fontSize(7.2).font("Helvetica")
        .text("Payment Method", receiptCardX + 12, rY);
      doc.fillColor(textPrimary).fontSize(7.2).font("Helvetica-Bold")
        .text(paymentMethod, receiptCardX + 110, rY, { width: 146, align: "right" });

      rY += 12;
      doc.fillColor(textSecondary).fontSize(7.2).font("Helvetica")
        .text("Transaction / Reference ID", receiptCardX + 12, rY);
      doc.fillColor(textPrimary).fontSize(7.2).font("Helvetica-Bold")
        .text(transactionId, receiptCardX + 120, rY, { width: 136, align: "right" });

      rY += 12;
      doc.fillColor(textSecondary).fontSize(7.2).font("Helvetica")
        .text("Total Project Value", receiptCardX + 12, rY);
      doc.fillColor(textPrimary).fontSize(7.5).font("Helvetica-Bold")
        .text(totalProjectVal, receiptCardX + 140, rY, { width: 116, align: "right" });

      rY += 12;
      doc.fillColor(textSecondary).fontSize(7.2).font("Helvetica")
        .text("Total Amount Paid", receiptCardX + 12, rY);
      doc.fillColor(textPrimary).fontSize(7.5).font("Helvetica-Bold")
        .text(amountReceived, receiptCardX + 140, rY, { width: 116, align: "right" });

      rY += 12;
      doc.fillColor(textSecondary).fontSize(7.2).font("Helvetica")
        .text("Balance Due", receiptCardX + 12, rY);
      doc.fillColor(textPrimary).fontSize(7.5).font("Helvetica-Bold")
        .text(balanceDue, receiptCardX + 140, rY, { width: 116, align: "right" });

      rY += 14;
      // Prominent Payment Status Badge Card
      doc.roundedRect(receiptCardX + 8, rY, commW - 16, 20, 4)
        .fillAndStroke(isPaid ? "#ecfdf5" : "#fffbeb", isPaid ? "#a7f3d0" : "#fde68a");

      doc.fillColor(textPrimary).fontSize(7.5).font("Helvetica-Bold")
        .text("STATUS: ", receiptCardX + 14, rY + 5.5, { continued: true })
        .fillColor(isPaid ? emeraldGreen : goldAccent).text(paymentStatus);

      if (isPaid) {
        doc.fillColor(cyanBadge).fontSize(7).font("Helvetica-Bold")
          .text("[KICKOFF CONFIRMED]", receiptCardX + 150, rY + 5.5, { width: 95, align: "right" });
      }

      rY += 23;
      // Official Non-Tax Invoice Disclaimer
      doc.fillColor(textSecondary).fontSize(5.8).font("Helvetica")
        .text("This document is a payment receipt and project acknowledgment. It is not a tax invoice.", receiptCardX + 8, rY, { width: commW - 16, align: "center" });

      // =============================================================
      // 6. SECTION 03: PROJECT TERMS & ONBOARDING GUIDELINES
      // =============================================================
      curY += cardHeight + 10;
      const termsH = 80;
      const tableW = 546;
      doc.roundedRect(24, curY, tableW, termsH, 5).fillAndStroke(cardBg, cardBorder);

      // Section Number Badge "03"
      doc.roundedRect(32, curY + 6, 20, 14, 3).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(7.5).font("Helvetica-Bold")
        .text("03", 32, curY + 8.5, { width: 20, align: "center" });

      doc.fillColor(purpleDark).fontSize(8).font("Helvetica-Bold")
        .text("PROJECT TERMS & ONBOARDING GUIDELINES", 56, curY + 8.5);

      drawFiligreeLine(doc, 290, 380, curY + 13);

      // 2-Column Guidelines with Clean Spacing
      const tCol1X = 36;
      const tCol2X = 302;
      let tY = curY + 24;

      // Col 1 (3 items)
      const t1 = [
        "Advance Booking: 50% booking advance payment (Rs. 6,500) locks your dedicated development slot.",
        "Live Staging & Review: A private live staging link will be provided for review prior to final release.",
        "100% Code Ownership: Full unencumbered source code & database ownership transfer upon final milestone.",
      ];
      t1.forEach((item) => {
        doc.fillColor(goldOchre).fontSize(7.5).font("Helvetica-Bold").text(">", tCol1X, tY);
        doc.fillColor(textPrimary).fontSize(6.8).font("Helvetica").text(item, tCol1X + 10, tY, { width: 245, lineGap: 1 });
        tY += 17;
      });

      // Col 2 (2 items)
      doc.fillColor(goldOchre).fontSize(7.5).font("Helvetica-Bold").text(">", tCol2X, curY + 24);
      doc.fillColor(textPrimary).fontSize(6.8).font("Helvetica")
        .text("Post-Launch Warranty: 30 days of complimentary bug fixes, training, and SLA support post-launch.", tCol2X + 10, curY + 24, { width: 245, lineGap: 1 });

      doc.fillColor(goldOchre).fontSize(7.5).font("Helvetica-Bold").text(">", tCol2X, curY + 48);
      doc.fillColor(textPrimary).fontSize(6.8).font("Helvetica")
        .text("Final Settlement: Balance 50% payable upon complete project staging verification & handover.", tCol2X + 10, curY + 48, { width: 245, lineGap: 1 });

      // =============================================================
      // 7. SECTION 04: SIGNATORY & COMPANY AUTHORIZATION
      // =============================================================
      curY += termsH + 10;
      const signH = 82;

      // --- Left Box: FOR SHUBDEEP LABS (Official 3D Gold Seal & Signature Card) ---
      if (fs.existsSync(signCardPath)) {
        doc.save();
        doc.image(signCardPath, 24, curY, { width: halfWidth, height: signH });
        doc.restore();
      } else {
        doc.roundedRect(24, curY, halfWidth, signH, 5).fillAndStroke("#ffffff", cardBorder);

        if (fs.existsSync(logoPath)) {
          doc.save();
          doc.circle(46, curY + 41, 18).stroke(goldAccent);
          doc.image(logoPath, 34, curY + 28, { width: 26, height: 26 });
          doc.restore();
        }

        doc.fillColor(purpleDark).fontSize(7.5).font("Helvetica-Bold")
          .text("FOR SHUBDEEP LABS", 68, curY + 8);
        doc.fillColor(emeraldGreen).fontSize(7.2).font("Helvetica-Bold")
          .text("[OFFICIALLY VERIFIED & APPROVED]", 68, curY + 19);
        doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
          .text("Shubham Vernekar", 68, curY + 30);
        doc.fillColor(textSecondary).fontSize(7).font("Helvetica")
          .text("Founder & Principal Architect", 68, curY + 41);

        // Cursive handwritten script signature
        doc.font("Times-Italic").fontSize(13).fillColor("#1e1b4b")
          .text("Shubham Vernekar", 68, curY + 54);

        doc.font("Helvetica");
      }

      // --- Right Box: CLIENT ACCEPTANCE & ACKNOWLEDGEMENT ---
      doc.roundedRect(rightCardX, curY, halfWidth, signH, 5).fillAndStroke("#ffffff", cardBorder);

      // Navy circle with Client Signature monogram
      doc.circle(rightCardX + 22, curY + 41, 16).fill(purpleDark);
      doc.fillColor("#ffffff").font("Times-Italic").fontSize(9.5).text("Jas", rightCardX + 15, curY + 37);

      doc.font("Helvetica");
      doc.fillColor(purpleDark).fontSize(7.5).font("Helvetica-Bold")
        .text("CLIENT ACCEPTANCE & ACKNOWLEDGEMENT", rightCardX + 44, curY + 8);
      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text(clientName, rightCardX + 44, curY + 21);
      doc.fillColor(textSecondary).fontSize(7).font("Helvetica")
        .text("Project Partner / Authorized Signatory", rightCardX + 44, curY + 34);

      // Signature line & Date
      doc.save();
      doc.lineWidth(0.6).strokeColor("#cbd5e1");
      doc.moveTo(rightCardX + 44, curY + 52).lineTo(rightCardX + halfWidth - 14, curY + 52).stroke();
      doc.restore();

      doc.fillColor(textPrimary).fontSize(7.2).font("Helvetica-Bold")
        .text(`Date: _____ / _____ / ${currentYear}`, rightCardX + 44, curY + 60);

      // =============================================================
      // 8. LUXURY BOTTOM FOOTER
      // =============================================================
      const footerY = 818;
      doc.save();
      doc.fillColor(purpleDark).fontSize(7.5).font("Helvetica-Bold")
        .text("ShubDeep Labs | Software Development & AI Solutions", 0, footerY - 11, { align: "center", width: doc.page.width })
        .fillColor(goldOchre).text(".   BUILDING INTELLIGENT SOLUTIONS   .", 0, footerY + 1, { align: "center", width: doc.page.width });
      doc.restore();

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateQuotationPDF };
