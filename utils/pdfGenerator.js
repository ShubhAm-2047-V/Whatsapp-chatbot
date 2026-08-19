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

function drawHandshakeIcon(doc, cx, cy) {
  doc.save();
  doc.lineWidth(1.3).strokeColor("#ffffff");
  doc.moveTo(cx - 5, cy - 1).lineTo(cx - 1.5, cy + 2.5).lineTo(cx + 2, cy - 1).lineTo(cx + 5.5, cy + 2.5).stroke();
  doc.moveTo(cx - 1.5, cy + 2.5).lineTo(cx + 2, cy + 2.5).stroke();
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
      const purpleDark = "#2e1065";   // Deep Royal Purple
      const purpleBrand = "#4c1d95";  // Royal Violet
      const purpleLight = "#7c3aed";  // Electric Violet
      const goldAccent = "#d97706";   // Amber Gold
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
      const transactionId = isPaid ? "UPI/SDL/" + Date.now().toString().slice(-8) : "Pending";
      const receiptNo = data.receiptNo || `SDL-RCP-${currentYear}-001`;
      const projectRef = data.projectRef || `SDL-PRO-7-${currentYear}`;

      // =============================================================
      // 0. LUXURY CORNER ACCENTS (Top-Right & Bottom Edges)
      // =============================================================
      doc.save();
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
      const logoSize = 60;
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.image(logoPath, 24, 16, { width: logoSize, height: logoSize });
        doc.restore();
      }

      const brandStartX = fs.existsSync(logoPath) ? 92 : 24;
      doc.fillColor(purpleDark).fontSize(22).font("Helvetica-Bold")
        .text("SHUBDEEP LABS", brandStartX, 18);

      doc.fillColor(textPrimary).fontSize(8).font("Helvetica-Bold")
        .text("Global Software Engineering & Custom AI Solutions Studio", brandStartX, 42);

      doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica")
        .text("Empowering Businesses with Next-Gen Digital Architecture", brandStartX, 53);

      // Gold decorative divider under brand
      doc.save();
      doc.lineWidth(0.8).strokeColor(goldAccent);
      doc.moveTo(brandStartX, 65).lineTo(brandStartX + 225, 65).stroke();
      doc.fillColor(goldAccent).fontSize(5).text("*", brandStartX + 110, 62.5);
      doc.restore();

      // Right Document Metadata Box: PROJECT AGREEMENT & PAYMENT RECEIPT
      const metaX = 330;
      doc.fillColor(purpleDark).fontSize(8.6).font("Helvetica-Bold")
        .text("PROJECT AGREEMENT & PAYMENT RECEIPT", metaX, 17, { width: 230, align: "left" });

      // Receipt No & Project Ref (Separated clearly)
      drawDocIcon(doc, metaX, 32);
      doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica-Bold")
        .text(`Receipt No: ${receiptNo}`, metaX + 15, 33, { width: 200 });

      drawCalendarIcon(doc, metaX, 46);
      doc.fillColor(textPrimary).fontSize(7.5).font("Helvetica-Bold")
        .text(`Project Ref: ${projectRef}`, metaX + 15, 47, { width: 200 });

      doc.fillColor(textSecondary).fontSize(7.2).font("Helvetica")
        .text(`Date: ${currentDate}`, metaX + 15, 60, { width: 200 });

      // =============================================================
      // 3. TOP CLIENT & AUTHORIZED REPRESENTATIVE CARDS (Height: 56)
      // =============================================================
      let curY = 78;
      const halfWidth = 268;
      const topCardH = 56;

      // --- Left Card: PREPARED FOR ---
      doc.roundedRect(24, curY, halfWidth, topCardH, 5).fillAndStroke(cardBg, cardBorder);

      doc.circle(42, curY + 28, 13).fill(purpleDark);
      drawUserAvatar(doc, 42, curY + 28);

      doc.fillColor(purpleBrand).fontSize(7.2).font("Helvetica-Bold")
        .text("PREPARED FOR (CLIENT PARTNER):", 62, curY + 8);
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
        .text("AUTHORIZED REPRESENTATIVE:", rightCardX + 38, curY + 8);
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
      // 4. SECTION 01: PROJECT OVERVIEW & SCOPE OF WORK (Height: 146)
      // =============================================================
      curY += topCardH + 12;

      // Section Number Badge "01"
      doc.roundedRect(24, curY, 24, 16, 3).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold")
        .text("01", 24, curY + 3.5, { width: 24, align: "center" });

      doc.fillColor(purpleDark).fontSize(9.5).font("Helvetica-Bold")
        .text("PROJECT OVERVIEW & TECHNICAL SCOPE OF WORK", 54, curY + 3.5);

      // Gold filigree line
      doc.save();
      doc.lineWidth(0.8).strokeColor(goldAccent);
      doc.moveTo(330, curY + 9).lineTo(440, curY + 9).stroke();
      doc.fillColor(goldAccent).fontSize(5).text("*", 383, curY + 6.5);
      doc.restore();

      curY += 20;
      doc.fillColor(purpleBrand).fontSize(8).font("Helvetica-Bold")
        .text("Project Category: ", 24, curY, { continued: true })
        .fillColor(textPrimary).text(projectType);

      curY += 14;

      // --- 2-Column Full Scope Deliverables ---
      const col1X = 24;
      const col2X = 302;
      let dY1 = curY;
      const col1Items = [
        "Modern, Ultra-Responsive UI/UX Layout (Mobile, Tablet & Desktop)",
        "Secure High-Speed Backend Architecture & Cloud Database Integration",
        "Full E-Commerce Catalog, Shopping Cart & Live Market Rate Engine",
        "Online Payment Gateway Integration (Instant UPI QR, Razorpay & Cards)",
      ];

      col1Items.forEach((text) => {
        drawCheckBadge(doc, col1X + 6, dY1 + 6);
        doc.fillColor(textPrimary).fontSize(7.3).font("Helvetica-Bold")
          .text(text, col1X + 16, dY1 + 1.5, { width: 260, lineGap: 1 });
        dY1 += 23;
      });

      let dY2 = curY;
      const col2Items = [
        "Admin Management Portal for Products, Inventory & Live Inquiries",
        "100% Full Unencumbered Source Code Ownership (Zero Lock-in)",
        "Production Deployment & 30-Day SLA Engineering Support",
      ];

      col2Items.forEach((text) => {
        drawCheckBadge(doc, col2X + 6, dY2 + 6);
        doc.fillColor(textPrimary).fontSize(7.3).font("Helvetica-Bold")
          .text(text, col2X + 16, dY2 + 1.5, { width: 250, lineGap: 1 });
        dY2 += 23;
      });

      // =============================================================
      // 5. SECTION 02: COMMERCIAL INVESTMENT & OFFICIAL PAYMENT RECEIPT
      // =============================================================
      curY = 278;

      // Section Number Badge "02"
      doc.roundedRect(24, curY, 24, 16, 3).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold")
        .text("02", 24, curY + 3.5, { width: 24, align: "center" });

      doc.fillColor(purpleDark).fontSize(9.5).font("Helvetica-Bold")
        .text("COMMERCIAL INVESTMENT & PAYMENT RECEIPT", 54, curY + 3.5);

      // Gold filigree line
      doc.save();
      doc.lineWidth(0.8).strokeColor(goldAccent);
      doc.moveTo(310, curY + 9).lineTo(430, curY + 9).stroke();
      doc.fillColor(goldAccent).fontSize(5).text("*", 368, curY + 6.5);
      doc.restore();

      curY += 20;

      // --- Left Box: COMMERCIAL INVESTMENT & MILESTONES (Width: 268, Height: 154) ---
      const commW = 268;
      const cardHeight = 154;

      doc.roundedRect(24, curY, commW, cardHeight, 6).fillAndStroke("#ffffff", cardBorder);

      // Header Bar
      doc.roundedRect(24, curY, commW, 22, 4).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold")
        .text("COMMERCIAL INVESTMENT BREAKDOWN", 36, curY + 6);

      let cY = curY + 30;
      // Row 1: Total Project Value
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Total Agreed Project Value:", 36, cY);
      doc.fillColor(purpleDark).fontSize(9.5).font("Helvetica-Bold")
        .text(totalProjectVal, 175, cY - 1, { width: 105, align: "right" });

      cY += 20;
      // Row 2: Advance Required (50%)
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Booking Advance Required (50%):", 36, cY);
      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text(advanceRequired, 175, cY, { width: 105, align: "right" });

      cY += 20;
      // Row 3: Estimated Timeline
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Project Delivery Timeline:", 36, cY);
      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text(timeline, 175, cY, { width: 105, align: "right" });

      cY += 20;
      // Row 4: Final Handover Milestone
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Final Milestone on Handover (50%):", 36, cY);
      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text("Rs. 6,500", 175, cY, { width: 105, align: "right" });

      cY += 22;
      // Summary Highlight Bar inside Commercial Box
      doc.roundedRect(32, cY, commW - 16, 26, 4).fill(cardBg);
      doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica-Bold")
        .text("Deliverable Handover:", 40, cY + 4)
        .fillColor(textSecondary).font("Helvetica").text("Full Source Code & Cloud Staging Handover", 40, cY + 14);

      // --- Right Box: OFFICIAL PAYMENT RECEIPT (Width: 268, Height: 154) ---
      const receiptCardX = 302;
      doc.roundedRect(receiptCardX, curY, commW, cardHeight, 6).fillAndStroke("#ffffff", cardBorder);

      // Header Bar with Status Badge
      doc.roundedRect(receiptCardX, curY, commW, 22, 4).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold")
        .text("PAYMENT ACKNOWLEDGMENT RECEIPT", receiptCardX + 12, curY + 6);

      let rY = curY + 30;
      // Receipt Details Rows
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Receipt Number:", receiptCardX + 12, rY);
      doc.fillColor(purpleBrand).fontSize(8).font("Helvetica-Bold")
        .text(receiptNo, receiptCardX + 140, rY, { width: 116, align: "right" });

      rY += 16;
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Amount Received (Advance):", receiptCardX + 12, rY);
      doc.fillColor(emeraldGreen).fontSize(10).font("Helvetica-Bold")
        .text(amountReceived, receiptCardX + 140, rY - 1, { width: 116, align: "right" });

      rY += 17;
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Payment Method:", receiptCardX + 12, rY);
      doc.fillColor(textPrimary).fontSize(7.5).font("Helvetica-Bold")
        .text(paymentMethod, receiptCardX + 110, rY, { width: 146, align: "right" });

      rY += 16;
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Balance Due on Launch:", receiptCardX + 12, rY);
      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text(balanceDue, receiptCardX + 140, rY, { width: 116, align: "right" });

      rY += 18;
      // Prominent Payment Status Badge Card
      doc.roundedRect(receiptCardX + 10, rY, commW - 20, 24, 4)
        .fillAndStroke(isPaid ? "#ecfdf5" : "#fffbeb", isPaid ? "#a7f3d0" : "#fde68a");

      doc.fillColor(isPaid ? emeraldGreen : goldAccent).fontSize(8).font("Helvetica-Bold")
        .text(`STATUS:  ${paymentStatus}`, receiptCardX + 18, rY + 7);

      if (isPaid) {
        doc.fillColor(cyanBadge).fontSize(7.5).font("Helvetica-Bold")
          .text("[KICKOFF CONFIRMED]", receiptCardX + 150, rY + 7, { width: 100, align: "right" });
      }

      rY += 28;
      // Official Non-Tax Invoice Disclaimer
      doc.fillColor(textSecondary).fontSize(6.2).font("Helvetica")
        .text("This document is a payment receipt and project acknowledgment. It is not a tax invoice.", receiptCardX + 10, rY, { width: commW - 20, align: "center" });

      // =============================================================
      // 6. SECTION 03: PROJECT TERMS & ONBOARDING GUIDELINES (Height: 90)
      // =============================================================
      curY += cardHeight + 12;
      const termsH = 88;
      const tableW = 546;
      doc.roundedRect(24, curY, tableW, termsH, 5).fillAndStroke(cardBg, cardBorder);

      // Shield icon + Title
      doc.circle(36, curY + 12, 5.5).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(6).font("Helvetica-Bold").text("v", 34.2, curY + 8.5);

      doc.fillColor(purpleDark).fontSize(8).font("Helvetica-Bold")
        .text("PROJECT TERMS & ONBOARDING GUIDELINES:", 48, curY + 8);

      // 2-Column Guidelines with Clean Spacing
      const tCol1X = 36;
      const tCol2X = 302;
      let tY = curY + 22;

      // Col 1 (3 items)
      const t1 = [
        "Advance Milestone: 50% booking advance (Rs. 6,500) locks dedicated development & UI kickoff.",
        "Live Staging & Review: Private demo staging preview will be provided for review prior to deployment.",
        "100% Code Ownership: Full unencumbered source code & database transfer upon final settlement.",
      ];
      t1.forEach((item) => {
        doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica-Bold").text(">", tCol1X, tY);
        doc.fillColor(textPrimary).fontSize(6.8).font("Helvetica").text(item, tCol1X + 10, tY, { width: 245, lineGap: 1 });
        tY += 18;
      });

      // Col 2 (2 items)
      doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica-Bold").text(">", tCol2X, curY + 22);
      doc.fillColor(textPrimary).fontSize(6.8).font("Helvetica")
        .text("Post-Launch Warranty: 30 days of complimentary bug fixes, training, and SLA support post-launch.", tCol2X + 10, curY + 22, { width: 245, lineGap: 1 });

      doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica-Bold").text(">", tCol2X, curY + 48);
      doc.fillColor(textPrimary).fontSize(6.8).font("Helvetica")
        .text("Final Settlement: Balance 50% payable upon complete project staging verification & handover.", tCol2X + 10, curY + 48, { width: 245, lineGap: 1 });

      // =============================================================
      // 7. SECTION 04: SIGNATORY & COMPANY AUTHORIZATION (Height: 88)
      // =============================================================
      curY += termsH + 12;
      const signH = 88;

      // --- Left Box: FOR SHUBDEEP LABS (Official 3D Gold Seal & Signature Card) ---
      if (fs.existsSync(signCardPath)) {
        doc.save();
        doc.image(signCardPath, 24, curY, { width: halfWidth, height: signH });
        doc.restore();
      } else {
        doc.roundedRect(24, curY, halfWidth, signH, 5).fillAndStroke("#ffffff", cardBorder);

        if (fs.existsSync(logoPath)) {
          doc.save();
          doc.circle(46, curY + 44, 18).stroke(goldAccent);
          doc.image(logoPath, 34, curY + 30, { width: 26, height: 26 });
          doc.restore();
        }

        doc.fillColor(purpleDark).fontSize(7.5).font("Helvetica-Bold")
          .text("FOR SHUBDEEP LABS (AUTHORIZED SIGNATORY):", 68, curY + 10);
        doc.fillColor(emeraldGreen).fontSize(7.2).font("Helvetica-Bold")
          .text("[OFFICIALLY VERIFIED & APPROVED]", 68, curY + 22);
        doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
          .text("Shubham Vernekar", 68, curY + 34);
        doc.fillColor(textSecondary).fontSize(7).font("Helvetica")
          .text("Founder & Principal Architect", 68, curY + 46);

        // Cursive handwritten script signature
        doc.font("Times-Italic").fontSize(13).fillColor("#1e1b4b")
          .text("Shubham Vernekar", 68, curY + 60);

        doc.font("Helvetica");
      }

      // --- Right Box: ACCEPTED & CONFIRMED BY CLIENT (Height: 88) ---
      doc.roundedRect(rightCardX, curY, halfWidth, signH, 5).fillAndStroke("#ffffff", cardBorder);

      // Handshake purple circle
      doc.circle(rightCardX + 22, curY + 44, 16).fill(purpleDark);
      drawHandshakeIcon(doc, rightCardX + 22, curY + 44);

      doc.fillColor(purpleDark).fontSize(7.5).font("Helvetica-Bold")
        .text("CLIENT ACCEPTANCE & ACKNOWLEDGMENT:", rightCardX + 44, curY + 10);
      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text(clientName, rightCardX + 44, curY + 23);
      doc.fillColor(textSecondary).fontSize(7).font("Helvetica")
        .text("Project Partner / Authorized Signatory", rightCardX + 44, curY + 36);

      // Signature line & Date
      doc.save();
      doc.lineWidth(0.6).strokeColor("#cbd5e1");
      doc.moveTo(rightCardX + 44, curY + 54).lineTo(rightCardX + halfWidth - 14, curY + 54).stroke();
      doc.restore();

      doc.fillColor(textPrimary).fontSize(7.2).font("Helvetica-Bold")
        .text(`Date: _____ / _____ / ${currentYear}`, rightCardX + 44, curY + 64);

      // =============================================================
      // 8. LUXURY BOTTOM FOOTER
      // =============================================================
      const footerY = 818;
      doc.save();
      doc.fillColor(purpleDark).fontSize(7.5).font("Helvetica-Bold")
        .text("ShubDeep Labs | Software Development & AI Solutions  .  BUILDING INTELLIGENT SOLUTIONS", 0, footerY, { align: "center", width: doc.page.width });
      doc.restore();

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateQuotationPDF };
