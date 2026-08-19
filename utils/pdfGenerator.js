const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

/**
 * Sanitizes strings for standard PDFKit fonts (removes all non-ASCII & emoji chars)
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
  doc.circle(cx, cy - 4, 5.5).fill();
  doc.path(`M ${cx - 9} ${cy + 11} C ${cx - 9} ${cy + 5}, ${cx + 9} ${cy + 5}, ${cx + 9} ${cy + 11} Z`).fill();
  doc.restore();
}

function drawCheckBadge(doc, cx, cy) {
  doc.save();
  doc.circle(cx, cy, 6.5).fill("#fbbf24");
  doc.lineWidth(1.4).strokeColor("#ffffff");
  doc.moveTo(cx - 2.8, cy).lineTo(cx - 0.5, cy + 2.3).lineTo(cx + 2.8, cy - 2.3).stroke();
  doc.restore();
}

function drawCalendarIcon(doc, x, y) {
  doc.save();
  doc.lineWidth(0.8).strokeColor("#d97706").fillColor("#fef3c7");
  doc.roundedRect(x, y, 11, 11, 1.5).fillAndStroke();
  doc.rect(x, y, 11, 3.5).fill("#d97706");
  doc.strokeColor("#d97706").lineWidth(0.6);
  doc.moveTo(x + 2.5, y - 1).lineTo(x + 2.5, y + 1.5).stroke();
  doc.moveTo(x + 8.5, y - 1).lineTo(x + 8.5, y + 1.5).stroke();
  doc.restore();
}

function drawDocIcon(doc, x, y) {
  doc.save();
  doc.lineWidth(0.8).strokeColor("#d97706").fillColor("#fef3c7");
  doc.roundedRect(x, y, 10, 12, 1.5).fillAndStroke();
  doc.strokeColor("#d97706").lineWidth(0.6);
  doc.moveTo(x + 2, y + 3.8).lineTo(x + 8, y + 3.8).stroke();
  doc.moveTo(x + 2, y + 6.5).lineTo(x + 8, y + 6.5).stroke();
  doc.moveTo(x + 2, y + 9.2).lineTo(x + 6, y + 9.2).stroke();
  doc.restore();
}

function drawPhoneIcon(doc, x, y) {
  doc.save();
  doc.lineWidth(0.8).strokeColor("#4c1d95").fillColor("#faf5ff");
  doc.roundedRect(x, y, 8, 11, 1.5).fillAndStroke();
  doc.fillColor("#4c1d95").circle(x + 4, y + 9, 0.8).fill();
  doc.restore();
}

function drawMailIcon(doc, x, y) {
  doc.save();
  doc.lineWidth(0.8).strokeColor("#4c1d95").fillColor("#faf5ff");
  doc.roundedRect(x, y, 11, 8, 1).fillAndStroke();
  doc.strokeColor("#4c1d95").lineWidth(0.6);
  doc.moveTo(x, y).lineTo(x + 5.5, y + 4.5).lineTo(x + 11, y).stroke();
  doc.restore();
}

function drawHandshakeIcon(doc, cx, cy) {
  doc.save();
  doc.lineWidth(1.4).strokeColor("#ffffff");
  doc.moveTo(cx - 6, cy - 1).lineTo(cx - 2, cy + 3).lineTo(cx + 2, cy - 1).lineTo(cx + 6, cy + 3).stroke();
  doc.moveTo(cx - 2, cy + 3).lineTo(cx + 2, cy + 3).stroke();
  doc.restore();
}

/**
 * Generates an executive, luxury branded single-page PDF proposal & agreement
 * covering the full A4 canvas with balanced, spacious layout.
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
      const goldAccent = "#d97706";   // Amber Gold
      const emeraldGreen = "#059669"; // Confirmed Emerald
      const cyanBadge = "#0284c7";    // Sky Blue
      const cardBg = "#faf5ff";       // Subtle Luxury Lavender tint
      const cardBorder = "#e9d5ff";   // Soft Purple border
      const textPrimary = "#0f172a";  // Dark Slate
      const textSecondary = "#475569";// Muted Slate

      const clientName = sanitizePdfText(data.clientName || "Deepa Dinesh Vernekar");
      const projectType = sanitizePdfText(data.projectType || "Gold & Jewellery E-Commerce Platform & Real-Time Rates Engine");
      const timeline = sanitizePdfText(data.timeline || "2-3 Weeks");
      const currentDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      const currentYear = new Date().getFullYear();

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
      doc.path("M 0 735 C 0 800, 65 842, 140 842").stroke();
      doc.lineWidth(6).strokeColor(purpleDark);
      doc.path("M 0 750 C 0 812, 50 842, 120 842").stroke();

      // Bottom-Right Luxury Ribbon
      doc.lineWidth(3.5).strokeColor(goldAccent);
      doc.path("M 450 842 C 525 842, 595 800, 595 735").stroke();
      doc.lineWidth(6).strokeColor(purpleDark);
      doc.path("M 475 842 C 540 842, 595 812, 595 750").stroke();
      doc.restore();

      // =============================================================
      // 1. SUBTLE BACKGROUND WATERMARK (Center of Page)
      // =============================================================
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.opacity(0.04);
        const wmSize = 340;
        const wmX = (doc.page.width - wmSize) / 2;
        const wmY = 270;
        doc.image(logoPath, wmX, wmY, { width: wmSize, height: wmSize });
        doc.restore();
      }

      // =============================================================
      // 2. HEADER BRANDING & METADATA
      // =============================================================
      const logoSize = 64;
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.image(logoPath, 24, 18, { width: logoSize, height: logoSize });
        doc.restore();
      }

      const brandStartX = fs.existsSync(logoPath) ? 96 : 24;
      doc.fillColor(purpleDark).fontSize(23).font("Helvetica-Bold")
        .text("SHUBDEEP LABS", brandStartX, 20);

      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text("Global Software Engineering & Custom AI Solutions Studio", brandStartX, 46);

      doc.fillColor(purpleBrand).fontSize(8).font("Helvetica")
        .text("Empowering Businesses with Next-Gen Digital Architecture", brandStartX, 58);

      // Gold decorative divider under brand
      doc.save();
      doc.lineWidth(0.8).strokeColor(goldAccent);
      doc.moveTo(brandStartX, 72).lineTo(brandStartX + 230, 72).stroke();
      doc.fillColor(goldAccent).fontSize(6).text("*", brandStartX + 112, 69.5);
      doc.restore();

      // Right Metadata Box (Clean Left-Aligned inside Box)
      const metaX = 380;
      doc.fillColor(purpleDark).fontSize(9.5).font("Helvetica-Bold")
        .text("PROJECT ESTIMATE & AGREEMENT", metaX, 20, { width: 190, align: "left" });

      // Date row
      drawCalendarIcon(doc, metaX, 41);
      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text(`Date: ${currentDate}`, metaX + 16, 42, { width: 170 });

      // Doc Ref row
      drawDocIcon(doc, metaX, 56);
      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text(`Doc Ref: SDL-PRO-7-${currentYear}`, metaX + 16, 57, { width: 170 });

      // =============================================================
      // 3. TOP CLIENT & AUTHORIZED REPRESENTATIVE CARDS (Height: 68)
      // =============================================================
      let curY = 88;
      const halfWidth = 268;
      const topCardH = 68;

      // --- Left Card: PREPARED FOR ---
      doc.roundedRect(24, curY, halfWidth, topCardH, 6).fillAndStroke(cardBg, cardBorder);

      // Avatar circle
      doc.circle(44, curY + 34, 15).fill(purpleDark);
      drawUserAvatar(doc, 44, curY + 34);

      doc.fillColor(purpleBrand).fontSize(7.8).font("Helvetica-Bold")
        .text("PREPARED FOR:", 66, curY + 10);
      doc.fillColor(textPrimary).fontSize(10.5).font("Helvetica-Bold")
        .text(clientName, 66, curY + 22);
      doc.fillColor(textSecondary).fontSize(7.8).font("Helvetica")
        .text("Verified Project Client Partner", 66, curY + 36);
      doc.fillColor(emeraldGreen).fontSize(7.8).font("Helvetica-Bold")
        .text("Status: Active Engagement", 66, curY + 50);

      // --- Right Card: AUTHORIZED REPRESENTATIVE ---
      const rightCardX = 302;
      doc.roundedRect(rightCardX, curY, halfWidth, topCardH, 6).fillAndStroke(cardBg, cardBorder);

      // Avatar circle
      doc.circle(rightCardX + 20, curY + 34, 15).fill(purpleDark);
      drawUserAvatar(doc, rightCardX + 20, curY + 34);

      doc.fillColor(purpleBrand).fontSize(7.8).font("Helvetica-Bold")
        .text("AUTHORIZED REPRESENTATIVE:", rightCardX + 42, curY + 10);
      doc.fillColor(textPrimary).fontSize(10.5).font("Helvetica-Bold")
        .text("Shubham Vernekar", rightCardX + 42, curY + 22);
      doc.fillColor(textSecondary).fontSize(7.8).font("Helvetica")
        .text("Founder & Principal Architect, ShubDeep Labs", rightCardX + 42, curY + 36);

      // Phone & Email with vector icons
      drawPhoneIcon(doc, rightCardX + 42, curY + 50);
      doc.fillColor(purpleDark).fontSize(7.5).font("Helvetica-Bold")
        .text("+91 90288 33275", rightCardX + 54, curY + 51);

      drawMailIcon(doc, rightCardX + 136, curY + 51);
      doc.fillColor(purpleDark).fontSize(7.5).font("Helvetica-Bold")
        .text("shubdeeplabs@gmail.com", rightCardX + 151, curY + 51);

      // =============================================================
      // 4. SECTION 01: PROJECT OVERVIEW & SCOPE OF WORK (Height: 180)
      // =============================================================
      curY += topCardH + 16;

      // Section Number Badge "01"
      doc.roundedRect(24, curY, 26, 18, 4).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold")
        .text("01", 24, curY + 4, { width: 26, align: "center" });

      doc.fillColor(purpleDark).fontSize(10).font("Helvetica-Bold")
        .text("PROJECT OVERVIEW & SCOPE OF WORK", 58, curY + 4);

      // Gold filigree line
      doc.save();
      doc.lineWidth(0.8).strokeColor(goldAccent);
      doc.moveTo(275, curY + 10).lineTo(375, curY + 10).stroke();
      doc.fillColor(goldAccent).fontSize(6).text("*", 323, curY + 7.5);
      doc.restore();

      curY += 24;
      doc.fillColor(purpleBrand).fontSize(8.5).font("Helvetica-Bold")
        .text("Project Category: ", 24, curY, { continued: true })
        .fillColor(textPrimary).text(projectType);

      curY += 16;

      // --- Left Deliverables Column (4 items with 34pt spacing) ---
      const col1X = 24;
      const col2X = 202;
      let dY1 = curY;
      const col1Items = [
        "Modern, User-Responsive UI/UX Layout\n(Mobile, Tablet & Desktop optimized)",
        "Secure High-Speed Backend Architecture &\nCloud Database Integration",
        "Full E-Commerce Catalog, Shopping Cart &\nLive Daily Market Rate Engine",
        "Online Payment Gateway Integration\n(Instant UPI QR, Razorpay & Cards)",
      ];

      col1Items.forEach((text) => {
        drawCheckBadge(doc, col1X + 6, dY1 + 8);
        doc.fillColor(textPrimary).fontSize(7.6).font("Helvetica-Bold")
          .text(text, col1X + 18, dY1 + 1.5, { width: 168, lineGap: 2 });
        dY1 += 34;
      });

      // --- Middle Deliverables Column (3 items with 34pt spacing) ---
      let dY2 = curY;
      const col2Items = [
        "Admin Management Portal for Products,\nInventory & Live Tracking",
        "100% Full Source Code Ownership with\nZero Vendor Lock-in",
        "Production Deployment & 30-Day\nComplimentary Post-Launch SLA Support",
      ];

      col2Items.forEach((text) => {
        drawCheckBadge(doc, col2X + 6, dY2 + 8);
        doc.fillColor(textPrimary).fontSize(7.6).font("Helvetica-Bold")
          .text(text, col2X + 18, dY2 + 1.5, { width: 168, lineGap: 2 });
        dY2 += 34;
      });

      // --- Right Box: PAYMENT RECEIPT SIDE-CARD (Height: 136) ---
      const receiptX = 394;
      const receiptY = curY - 8;
      const receiptW = 176;
      const receiptH = 136;
      doc.roundedRect(receiptX, receiptY, receiptW, receiptH, 8).fillAndStroke("#ffffff", cardBorder);

      // Receipt icon box
      doc.roundedRect(receiptX + 12, receiptY + 16, 26, 32, 4).stroke(goldAccent);
      drawDocIcon(doc, receiptX + 19, receiptY + 25);

      doc.fillColor(purpleDark).fontSize(9).font("Helvetica-Bold")
        .text("PAYMENT RECEIPT", receiptX + 44, receiptY + 18);

      doc.fillColor(textSecondary).fontSize(7.3).font("Helvetica")
        .text("This is not a tax invoice.", receiptX + 44, receiptY + 34)
        .text("This receipt is issued upon advance booking/payment towards the project.", receiptX + 44, receiptY + 48, { width: 124, lineGap: 2 });

      // Gold filigree ornament inside receipt
      doc.save();
      doc.lineWidth(0.8).strokeColor(goldAccent);
      doc.moveTo(receiptX + 24, receiptY + 115).lineTo(receiptX + receiptW - 24, receiptY + 115).stroke();
      doc.fillColor(goldAccent).fontSize(6).text("*", receiptX + (receiptW / 2) - 3, receiptY + 112.5);
      doc.restore();

      // =============================================================
      // 5. SECTION 02: COMMERCIAL INVESTMENT & MILESTONE SCHEDULE
      // =============================================================
      curY = 382;

      // Section Number Badge "02"
      doc.roundedRect(24, curY, 26, 18, 4).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold")
        .text("02", 24, curY + 4, { width: 26, align: "center" });

      doc.fillColor(purpleDark).fontSize(10).font("Helvetica-Bold")
        .text("COMMERCIAL INVESTMENT & MILESTONE SCHEDULE", 58, curY + 4);

      // Gold filigree line
      doc.save();
      doc.lineWidth(0.8).strokeColor(goldAccent);
      doc.moveTo(335, curY + 10).lineTo(445, curY + 10).stroke();
      doc.fillColor(goldAccent).fontSize(6).text("*", 388, curY + 7.5);
      doc.restore();

      curY += 24;

      // --- Commercial Table Header (Height: 24) ---
      const tableW = 546;
      doc.roundedRect(24, curY, tableW, 24, 4).fill(purpleDark);

      doc.fillColor("#ffffff").fontSize(8.5).font("Helvetica-Bold")
        .text("SCOPE / DESCRIPTION", 40, curY + 7)
        .text("TIMELINE", 280, curY + 7)
        .text("APPROVED INVESTMENT", 412, curY + 7, { width: 146, align: "right" });

      curY += 24;

      // --- Commercial Table Content Row (Height: 56) ---
      const rowH = 56;
      doc.roundedRect(24, curY, tableW, rowH, 0).fillAndStroke("#ffffff", cardBorder);

      // Left: Gold Diamond Icon + Scope Title & Subtitle
      doc.polygon([40, curY + 18], [48, curY + 13], [56, curY + 18], [56, curY + 28], [48, curY + 33], [40, curY + 28])
        .fillAndStroke(cardBg, goldAccent);
      doc.fillColor(goldAccent).fontSize(7.5).font("Helvetica-Bold").text("<>", 43, curY + 20);

      doc.fillColor(textPrimary).fontSize(8.8).font("Helvetica-Bold")
        .text("Gold & Jewellery E-Commerce Platform\n& Real-Time Rates Engine", 64, curY + 11, { width: 200, lineGap: 2 });
      doc.fillColor(textSecondary).fontSize(7.3).font("Helvetica")
        .text("Complete Source Code & Live Cloud Deployment", 64, curY + 37);

      // Middle: Timeline
      doc.fillColor(purpleDark).fontSize(10).font("Helvetica-Bold")
        .text(timeline, 280, curY + 16);
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Live Staging Demo", 280, curY + 32);

      // Right: Investment & Status Badge
      doc.fillColor(emeraldGreen).fontSize(12).font("Helvetica-Bold")
        .text("Rs. 13,000", 412, curY + 9, { width: 146, align: "right" });
      doc.fillColor(textPrimary).fontSize(7.8).font("Helvetica")
        .text("Advance: Rs. 6,500 (50%)", 412, curY + 24, { width: 146, align: "right" });
      doc.fillColor(cyanBadge).fontSize(7.8).font("Helvetica-Bold")
        .text("[KICKOFF CONFIRMED]", 412, curY + 38, { width: 146, align: "right" });

      // =============================================================
      // 6. PROJECT TERMS & ONBOARDING GUIDELINES CARD (Height: 96)
      // =============================================================
      curY += rowH + 12;
      const termsH = 96;
      doc.roundedRect(24, curY, tableW, termsH, 6).fillAndStroke(cardBg, cardBorder);

      // Shield icon + Title
      doc.circle(38, curY + 14, 6.5).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(7).font("Helvetica-Bold").text("v", 36, curY + 10);

      doc.fillColor(purpleDark).fontSize(8.5).font("Helvetica-Bold")
        .text("PROJECT TERMS & ONBOARDING GUIDELINES:", 52, curY + 10);

      // 2-Column Guidelines with Strict Absolute Positioning & Generous Spacing
      const tCol1X = 36;
      const tCol2X = 305;
      let tY = curY + 28;

      // Col 1 (3 items with 20pt spacing)
      const t1 = [
        "Advance Booking: 50% booking advance payment (Rs. 6,500) locks your dedicated development slot.",
        "Live Staging & Review: A private live staging link will be provided for milestone review prior to final release.",
        "100% Code Ownership: Full unencumbered source code & database ownership transfer upon final milestone.",
      ];
      t1.forEach((item) => {
        doc.fillColor(purpleBrand).fontSize(8).font("Helvetica-Bold").text(">", tCol1X, tY);
        doc.fillColor(textPrimary).fontSize(7.2).font("Helvetica").text(item, tCol1X + 12, tY, { width: 245, lineGap: 1.5 });
        tY += 20;
      });

      // Col 2 (1 item)
      doc.fillColor(purpleBrand).fontSize(8).font("Helvetica-Bold").text(">", tCol2X, curY + 28);
      doc.fillColor(textPrimary).fontSize(7.2).font("Helvetica")
        .text("Post-Launch Warranty: 30 days of complimentary bug fixes, training, and technical support post-deployment.", tCol2X + 12, curY + 28, { width: 245, lineGap: 1.5 });

      // =============================================================
      // 7. SIGNATORY & VERIFICATION BLOCK (Height: 88)
      // =============================================================
      curY += termsH + 14;
      const signH = 88;

      // --- Left Box: FOR SHUBDEEP LABS (Official 3D Gold Seal & Signature Card) ---
      if (fs.existsSync(signCardPath)) {
        doc.save();
        doc.image(signCardPath, 24, curY, { width: halfWidth, height: signH });
        doc.restore();
      } else {
        doc.roundedRect(24, curY, halfWidth, signH, 6).fillAndStroke("#ffffff", cardBorder);

        if (fs.existsSync(logoPath)) {
          doc.save();
          doc.circle(48, curY + 44, 20).stroke(goldAccent);
          doc.image(logoPath, 34, curY + 30, { width: 28, height: 28 });
          doc.restore();
        }

        doc.fillColor(purpleDark).fontSize(8).font("Helvetica-Bold")
          .text("FOR SHUBDEEP LABS:", 74, curY + 12);
        doc.fillColor(emeraldGreen).fontSize(8).font("Helvetica-Bold")
          .text("[OFFICIALLY VERIFIED & APPROVED]", 74, curY + 24);
        doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
          .text("Shubham Vernekar", 74, curY + 37);
        doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
          .text("(Founder & Principal Architect)", 74, curY + 49);

        // Cursive handwritten script signature
        doc.font("Times-Italic").fontSize(14).fillColor("#1e1b4b")
          .text("Shubham Vernekar", 74, curY + 63);

        doc.font("Helvetica");
      }

      // --- Right Box: ACCEPTED & CONFIRMED BY CLIENT (Height: 88) ---
      doc.roundedRect(rightCardX, curY, halfWidth, signH, 6).fillAndStroke("#ffffff", cardBorder);

      // Handshake purple circle
      doc.circle(rightCardX + 26, curY + 44, 18).fill(purpleDark);
      drawHandshakeIcon(doc, rightCardX + 26, curY + 44);

      doc.fillColor(purpleDark).fontSize(8).font("Helvetica-Bold")
        .text("ACCEPTED & CONFIRMED BY CLIENT:", rightCardX + 52, curY + 12);
      doc.fillColor(textPrimary).fontSize(9).font("Helvetica-Bold")
        .text(clientName, rightCardX + 52, curY + 25);
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Project Partner / Authorized Signatory", rightCardX + 52, curY + 38);

      // Signature & Date line
      doc.save();
      doc.lineWidth(0.6).strokeColor("#cbd5e1");
      doc.moveTo(rightCardX + 52, curY + 58).lineTo(rightCardX + halfWidth - 16, curY + 58).stroke();
      doc.restore();

      doc.fillColor(textPrimary).fontSize(7.5).font("Helvetica-Bold")
        .text(`Date: _____ / _____ / ${currentYear}`, rightCardX + 52, curY + 66);

      // =============================================================
      // 8. LUXURY BOTTOM FOOTER
      // =============================================================
      const footerY = 818;
      doc.save();
      doc.fillColor(purpleDark).fontSize(8).font("Helvetica-Bold")
        .text(".   BUILDING INTELLIGENT SOLUTIONS   .", 0, footerY, { align: "center", width: doc.page.width });
      doc.restore();

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateQuotationPDF };
