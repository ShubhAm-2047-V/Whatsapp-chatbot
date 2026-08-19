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
  doc.circle(cx, cy - 3, 4.5).fill();
  doc.path(`M ${cx - 7} ${cy + 9} C ${cx - 7} ${cy + 4}, ${cx + 7} ${cy + 4}, ${cx + 7} ${cy + 9} Z`).fill();
  doc.restore();
}

function drawCheckBadge(doc, cx, cy) {
  doc.save();
  doc.circle(cx, cy, 6).fill("#fbbf24");
  doc.lineWidth(1.3).strokeColor("#ffffff");
  doc.moveTo(cx - 2.5, cy).lineTo(cx - 0.5, cy + 2).lineTo(cx + 2.5, cy - 2).stroke();
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
  doc.moveTo(x + 2.5, y + 4).lineTo(x + 7.5, y + 4).stroke();
  doc.moveTo(x + 2.5, y + 6.5).lineTo(x + 7.5, y + 6.5).stroke();
  doc.moveTo(x + 2.5, y + 9).lineTo(x + 5.5, y + 9).stroke();
  doc.restore();
}

function drawPhoneIcon(doc, x, y) {
  doc.save();
  doc.lineWidth(0.8).strokeColor("#4c1d95").fillColor("#faf5ff");
  doc.roundedRect(x, y, 7, 11, 1.5).fillAndStroke();
  doc.fillColor("#4c1d95").circle(x + 3.5, y + 9, 0.8).fill();
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
  doc.lineWidth(1.2).strokeColor("#ffffff");
  doc.moveTo(cx - 6, cy - 1).lineTo(cx - 2, cy + 3).lineTo(cx + 2, cy - 1).lineTo(cx + 6, cy + 3).stroke();
  doc.moveTo(cx - 2, cy + 3).lineTo(cx + 2, cy + 3).stroke();
  doc.restore();
}

/**
 * Generates an executive, luxury branded single-page PDF proposal & agreement
 * matching the exact visual structure of ShubDeep Labs official design.
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
      doc.lineWidth(3).strokeColor(goldAccent);
      doc.path("M 460 0 C 530 0, 595 40, 595 100").stroke();
      doc.lineWidth(5).strokeColor(purpleDark);
      doc.path("M 480 0 C 545 0, 595 30, 595 85").stroke();

      // Bottom-Left Luxury Ribbon
      doc.lineWidth(3).strokeColor(goldAccent);
      doc.path("M 0 745 C 0 805, 65 842, 135 842").stroke();
      doc.lineWidth(5).strokeColor(purpleDark);
      doc.path("M 0 760 C 0 818, 50 842, 115 842").stroke();

      // Bottom-Right Luxury Ribbon
      doc.lineWidth(3).strokeColor(goldAccent);
      doc.path("M 460 842 C 530 842, 595 805, 595 745").stroke();
      doc.lineWidth(5).strokeColor(purpleDark);
      doc.path("M 480 842 C 545 842, 595 818, 595 760").stroke();
      doc.restore();

      // =============================================================
      // 1. SUBTLE BACKGROUND WATERMARK (Center of Page)
      // =============================================================
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.opacity(0.045);
        const wmSize = 320;
        const wmX = (doc.page.width - wmSize) / 2;
        const wmY = 240;
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
        .text("SHUBDEEP LABS", brandStartX, 22);

      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text("Global Software Engineering & Custom AI Solutions Studio", brandStartX, 48);

      doc.fillColor(purpleBrand).fontSize(8).font("Helvetica")
        .text("Empowering Businesses with Next-Gen Digital Architecture", brandStartX, 60);

      // Gold decorative divider under brand
      doc.save();
      doc.lineWidth(0.8).strokeColor(goldAccent);
      doc.moveTo(brandStartX, 73).lineTo(brandStartX + 230, 73).stroke();
      doc.fillColor(goldAccent).fontSize(6).text("*", brandStartX + 112, 70);
      doc.restore();

      // Right Metadata Box (Date & Doc Ref)
      const metaX = doc.page.width - 200;
      doc.fillColor(purpleDark).fontSize(9.5).font("Helvetica-Bold")
        .text("PROJECT ESTIMATE & AGREEMENT", metaX, 22, { align: "right", width: 176 });

      // Date row with vector calendar
      drawCalendarIcon(doc, metaX + 42, 43);
      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text(`Date: ${currentDate}`, metaX + 58, 44, { align: "right", width: 118 });

      // Doc Ref row with vector doc icon
      drawDocIcon(doc, metaX + 42, 57);
      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text(`Doc Ref: SDL-PRO-7-${currentYear}`, metaX + 58, 58, { align: "right", width: 118 });

      // =============================================================
      // 3. TOP CLIENT & AUTHORIZED REPRESENTATIVE CARDS
      // =============================================================
      let curY = 88;
      const halfWidth = 268;

      // --- Left Card: PREPARED FOR ---
      doc.roundedRect(24, curY, halfWidth, 58, 6).fillAndStroke(cardBg, cardBorder);

      // Avatar circle
      doc.circle(44, curY + 29, 14).fill(purpleDark);
      drawUserAvatar(doc, 44, curY + 29);

      doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica-Bold")
        .text("PREPARED FOR:", 64, curY + 8);
      doc.fillColor(textPrimary).fontSize(10).font("Helvetica-Bold")
        .text(clientName, 64, curY + 19);
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Verified Project Client Partner", 64, curY + 32);
      doc.fillColor(emeraldGreen).fontSize(7.5).font("Helvetica-Bold")
        .text("Status: Active Engagement", 64, curY + 44);

      // --- Right Card: AUTHORIZED REPRESENTATIVE ---
      const rightCardX = 302;
      doc.roundedRect(rightCardX, curY, halfWidth, 58, 6).fillAndStroke(cardBg, cardBorder);

      // Avatar circle
      doc.circle(rightCardX + 20, curY + 29, 14).fill(purpleDark);
      drawUserAvatar(doc, rightCardX + 20, curY + 29);

      doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica-Bold")
        .text("AUTHORIZED REPRESENTATIVE:", rightCardX + 40, curY + 8);
      doc.fillColor(textPrimary).fontSize(10).font("Helvetica-Bold")
        .text("Shubham Vernekar", rightCardX + 40, curY + 19);
      doc.fillColor(textSecondary).fontSize(7.5).font("Helvetica")
        .text("Founder & Principal Architect, ShubDeep Labs", rightCardX + 40, curY + 32);

      // Phone & Email with vector icons
      drawPhoneIcon(doc, rightCardX + 40, curY + 44);
      doc.fillColor(purpleDark).fontSize(7.2).font("Helvetica-Bold")
        .text("+91 90288 33275", rightCardX + 50, curY + 45);

      drawMailIcon(doc, rightCardX + 130, curY + 45);
      doc.fillColor(purpleDark).fontSize(7.2).font("Helvetica-Bold")
        .text("shubdeeplabs@gmail.com", rightCardX + 144, curY + 45);

      // =============================================================
      // 4. SECTION 01: PROJECT OVERVIEW & SCOPE OF WORK
      // =============================================================
      curY += 68;

      // Section Number Badge "01"
      doc.roundedRect(24, curY, 26, 18, 4).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold")
        .text("01", 24, curY + 4, { width: 26, align: "center" });

      doc.fillColor(purpleDark).fontSize(10).font("Helvetica-Bold")
        .text("PROJECT OVERVIEW & SCOPE OF WORK", 56, curY + 4);

      // Gold filigree line
      doc.save();
      doc.lineWidth(0.8).strokeColor(goldAccent);
      doc.moveTo(270, curY + 10).lineTo(370, curY + 10).stroke();
      doc.fillColor(goldAccent).fontSize(6).text("*", 318, curY + 7);
      doc.restore();

      curY += 22;
      doc.fillColor(purpleBrand).fontSize(8).font("Helvetica-Bold")
        .text("Project Category: ", 24, curY, { continued: true })
        .fillColor(textPrimary).text(projectType);

      curY += 14;

      // --- Left Deliverables Column (4 items) ---
      const col1X = 24;
      const col2X = 196;
      let dY1 = curY;
      const col1Items = [
        "Modern, User-Responsive UI/UX Layout\n(Mobile, Tablet & Desktop optimized)",
        "Secure High-Speed Backend Architecture &\nCloud Database Integration",
        "Full E-Commerce Catalog, Shopping Cart &\nLive Daily Market Rate Engine",
        "Online Payment Gateway Integration\n(Instant UPI QR, Razorpay & Cards)",
      ];

      col1Items.forEach((text) => {
        drawCheckBadge(doc, col1X + 6, dY1 + 8);
        doc.fillColor(textPrimary).fontSize(7.3).font("Helvetica-Bold")
          .text(text, col1X + 16, dY1 + 2, { width: 154, lineGap: 1 });
        dY1 += 27;
      });

      // --- Middle Deliverables Column (3 items) ---
      let dY2 = curY;
      const col2Items = [
        "Admin Management Portal for Products,\nInventory & Live Tracking",
        "100% Full Source Code Ownership with\nZero Vendor Lock-in",
        "Production Deployment & 30-Day\nComplimentary Post-Launch SLA Support",
      ];

      col2Items.forEach((text) => {
        drawCheckBadge(doc, col2X + 6, dY2 + 8);
        doc.fillColor(textPrimary).fontSize(7.3).font("Helvetica-Bold")
          .text(text, col2X + 16, dY2 + 2, { width: 154, lineGap: 1 });
        dY2 += 27;
      });

      // --- Right Box: PAYMENT RECEIPT SIDE-CARD ---
      const receiptX = 392;
      const receiptY = curY - 10;
      const receiptW = 178;
      const receiptH = 118;
      doc.roundedRect(receiptX, receiptY, receiptW, receiptH, 8).fillAndStroke("#ffffff", cardBorder);

      // Receipt icon box
      doc.roundedRect(receiptX + 12, receiptY + 14, 24, 30, 3).stroke(goldAccent);
      drawDocIcon(doc, receiptX + 18, receiptY + 22);

      doc.fillColor(purpleDark).fontSize(8.5).font("Helvetica-Bold")
        .text("PAYMENT RECEIPT", receiptX + 44, receiptY + 16);

      doc.fillColor(textSecondary).fontSize(7).font("Helvetica")
        .text("This is not a tax invoice.", receiptX + 44, receiptY + 30)
        .text("This receipt is issued upon advance booking/payment towards the project.", receiptX + 44, receiptY + 42, { width: 124 });

      // Gold filigree ornament inside receipt
      doc.save();
      doc.lineWidth(0.8).strokeColor(goldAccent);
      doc.moveTo(receiptX + 24, receiptY + 98).lineTo(receiptX + receiptW - 24, receiptY + 98).stroke();
      doc.fillColor(goldAccent).fontSize(6).text("*", receiptX + (receiptW / 2) - 3, receiptY + 95);
      doc.restore();

      // =============================================================
      // 5. SECTION 02: COMMERCIAL INVESTMENT & MILESTONE SCHEDULE
      // =============================================================
      curY = 330;

      // Section Number Badge "02"
      doc.roundedRect(24, curY, 26, 18, 4).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold")
        .text("02", 24, curY + 4, { width: 26, align: "center" });

      doc.fillColor(purpleDark).fontSize(10).font("Helvetica-Bold")
        .text("COMMERCIAL INVESTMENT & MILESTONE SCHEDULE", 56, curY + 4);

      // Gold filigree line
      doc.save();
      doc.lineWidth(0.8).strokeColor(goldAccent);
      doc.moveTo(330, curY + 10).lineTo(440, curY + 10).stroke();
      doc.fillColor(goldAccent).fontSize(6).text("*", 383, curY + 7);
      doc.restore();

      curY += 20;

      // --- Commercial Table Header ---
      const tableW = 546;
      doc.roundedRect(24, curY, tableW, 22, 4).fill(purpleDark);

      doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold")
        .text("SCOPE / DESCRIPTION", 38, curY + 6)
        .text("TIMELINE", 280, curY + 6)
        .text("APPROVED INVESTMENT", 412, curY + 6, { width: 146, align: "right" });

      curY += 22;

      // --- Commercial Table Content Row ---
      const rowH = 50;
      doc.roundedRect(24, curY, tableW, rowH, 0).fillAndStroke("#ffffff", cardBorder);

      // Left: Gold Hexagon Badge + Scope Title & Subtitle
      doc.polygon([40, curY + 16], [48, curY + 12], [56, curY + 16], [56, curY + 26], [48, curY + 30], [40, curY + 26])
        .fillAndStroke(cardBg, goldAccent);
      doc.fillColor(goldAccent).fontSize(7).font("Helvetica-Bold").text("<>", 43, curY + 18);

      doc.fillColor(textPrimary).fontSize(8.5).font("Helvetica-Bold")
        .text("Gold & Jewellery E-Commerce Platform\n& Real-Time Rates Engine", 64, curY + 10, { width: 200 });
      doc.fillColor(textSecondary).fontSize(7).font("Helvetica")
        .text("Complete Source Code & Live Cloud Deployment", 64, curY + 34);

      // Middle: Timeline
      doc.fillColor(purpleDark).fontSize(9.5).font("Helvetica-Bold")
        .text(timeline, 280, curY + 14);
      doc.fillColor(textSecondary).fontSize(7).font("Helvetica")
        .text("Live Staging Demo", 280, curY + 28);

      // Right: Investment & Status Badge
      doc.fillColor(emeraldGreen).fontSize(11).font("Helvetica-Bold")
        .text("Rs. 13,000", 412, curY + 8, { width: 146, align: "right" });
      doc.fillColor(textPrimary).fontSize(7.5).font("Helvetica")
        .text("Advance: Rs. 6,500 (50%)", 412, curY + 22, { width: 146, align: "right" });
      doc.fillColor(cyanBadge).fontSize(7.5).font("Helvetica-Bold")
        .text("[KICKOFF CONFIRMED]", 412, curY + 34, { width: 146, align: "right" });

      // =============================================================
      // 6. PROJECT TERMS & ONBOARDING GUIDELINES CARD
      // =============================================================
      curY += rowH + 8;
      const termsH = 68;
      doc.roundedRect(24, curY, tableW, termsH, 6).fillAndStroke(cardBg, cardBorder);

      // Shield icon + Title
      doc.circle(38, curY + 13, 6).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(6.5).font("Helvetica-Bold").text("v", 36, curY + 9);

      doc.fillColor(purpleDark).fontSize(8).font("Helvetica-Bold")
        .text("PROJECT TERMS & ONBOARDING GUIDELINES:", 50, curY + 9);

      // 2-Column Guidelines
      const tCol1X = 36;
      const tCol2X = 295;
      let tY = curY + 22;

      // Col 1 (3 items)
      const t1 = [
        "Advance Booking: 50% booking advance payment (Rs. 6,500) locks your dedicated development slot.",
        "Live Staging & Review: A private live staging link will be provided for milestone review prior to final release.",
        "100% Code Ownership: Full unencumbered source code & database ownership transfer upon final milestone.",
      ];
      t1.forEach((item) => {
        doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica-Bold").text(">", tCol1X, tY, { continued: true });
        doc.fillColor(textPrimary).fontSize(6.8).font("Helvetica").text(`  ${item}`, { width: 235 });
        tY += 13.5;
      });

      // Col 2 (1 item)
      doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica-Bold").text(">", tCol2X, curY + 22, { continued: true });
      doc.fillColor(textPrimary).fontSize(6.8).font("Helvetica")
        .text("  Post-Launch Warranty: 30 days of complimentary bug fixes, training, and technical support post-deployment.", { width: 240 });

      // =============================================================
      // 7. SIGNATORY & VERIFICATION BLOCK
      // =============================================================
      curY += termsH + 10;
      const signH = 68;

      // --- Left Box: FOR SHUBDEEP LABS ---
      doc.roundedRect(24, curY, halfWidth, signH, 6).fillAndStroke("#ffffff", cardBorder);

      // Seal circle with SL logo
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.circle(48, curY + 34, 18).stroke(goldAccent);
        doc.image(logoPath, 34, curY + 20, { width: 28, height: 28 });
        doc.restore();
      }

      doc.fillColor(purpleDark).fontSize(7.5).font("Helvetica-Bold")
        .text("FOR SHUBDEEP LABS:", 72, curY + 8);
      doc.fillColor(emeraldGreen).fontSize(7.5).font("Helvetica-Bold")
        .text("[OFFICIALLY VERIFIED & APPROVED]", 72, curY + 19);
      doc.fillColor(textSecondary).fontSize(7).font("Helvetica")
        .text("Shubham Vernekar (Founder & Principal Architect)", 72, curY + 30);

      // Cursive Signature
      doc.fillColor(purpleDark).fontSize(12).font("Helvetica-Bold")
        .text("Shubham Vernekar", 72, curY + 44);

      // --- Right Box: ACCEPTED & CONFIRMED BY CLIENT ---
      doc.roundedRect(rightCardX, curY, halfWidth, signH, 6).fillAndStroke("#ffffff", cardBorder);

      // Handshake purple circle
      doc.circle(rightCardX + 24, curY + 34, 16).fill(purpleDark);
      drawHandshakeIcon(doc, rightCardX + 24, curY + 34);

      doc.fillColor(purpleDark).fontSize(7.5).font("Helvetica-Bold")
        .text("ACCEPTED & CONFIRMED BY CLIENT:", rightCardX + 46, curY + 8);
      doc.fillColor(textPrimary).fontSize(8).font("Helvetica-Bold")
        .text(clientName, rightCardX + 46, curY + 19);
      doc.fillColor(textSecondary).fontSize(7).font("Helvetica")
        .text("Project Partner / Authorized Signatory", rightCardX + 46, curY + 30);

      // Signature & Date line
      doc.save();
      doc.lineWidth(0.5).strokeColor("#cbd5e1");
      doc.moveTo(rightCardX + 46, curY + 46).lineTo(rightCardX + halfWidth - 14, curY + 46).stroke();
      doc.restore();

      doc.fillColor(textPrimary).fontSize(7.2).font("Helvetica-Bold")
        .text(`Date: _____ / _____ / ${currentYear}`, rightCardX + 46, curY + 52);

      // =============================================================
      // 8. LUXURY BOTTOM FOOTER
      // =============================================================
      const footerY = 818;
      doc.save();
      doc.fillColor(purpleDark).fontSize(7.5).font("Helvetica-Bold")
        .text(".   BUILDING INTELLIGENT SOLUTIONS   .", 0, footerY, { align: "center", width: doc.page.width });
      doc.restore();

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateQuotationPDF };
