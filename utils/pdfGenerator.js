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
  doc.lineWidth(1.2).strokeColor("#ffffff");
  doc.moveTo(cx - 5, cy - 1).lineTo(cx - 1.5, cy + 2.5).lineTo(cx + 2, cy - 1).lineTo(cx + 5.5, cy + 2.5).stroke();
  doc.moveTo(cx - 1.5, cy + 2.5).lineTo(cx + 2, cy + 2.5).stroke();
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
        doc.opacity(0.04);
        const wmSize = 300;
        const wmX = (doc.page.width - wmSize) / 2;
        const wmY = 245;
        doc.image(logoPath, wmX, wmY, { width: wmSize, height: wmSize });
        doc.restore();
      }

      // =============================================================
      // 2. HEADER BRANDING & METADATA
      // =============================================================
      const logoSize = 60;
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.image(logoPath, 24, 16, { width: logoSize, height: logoSize });
        doc.restore();
      }

      const brandStartX = fs.existsSync(logoPath) ? 92 : 24;
      doc.fillColor(purpleDark).fontSize(22).font("Helvetica-Bold")
        .text("SHUBDEEP LABS", brandStartX, 20);

      doc.fillColor(textPrimary).fontSize(8).font("Helvetica-Bold")
        .text("Global Software Engineering & Custom AI Solutions Studio", brandStartX, 44);

      doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica")
        .text("Empowering Businesses with Next-Gen Digital Architecture", brandStartX, 55);

      // Gold decorative divider under brand
      doc.save();
      doc.lineWidth(0.8).strokeColor(goldAccent);
      doc.moveTo(brandStartX, 67).lineTo(brandStartX + 220, 67).stroke();
      doc.fillColor(goldAccent).fontSize(5).text("*", brandStartX + 107, 65);
      doc.restore();

      // Right Metadata Box (Clean Left-Aligned inside Box)
      const metaX = 385;
      doc.fillColor(purpleDark).fontSize(9).font("Helvetica-Bold")
        .text("PROJECT ESTIMATE & AGREEMENT", metaX, 20, { width: 180, align: "left" });

      // Date row
      drawCalendarIcon(doc, metaX, 39);
      doc.fillColor(textPrimary).fontSize(8).font("Helvetica-Bold")
        .text(`Date: ${currentDate}`, metaX + 16, 40, { width: 165 });

      // Doc Ref row
      drawDocIcon(doc, metaX, 52);
      doc.fillColor(textPrimary).fontSize(8).font("Helvetica-Bold")
        .text(`Doc Ref: SDL-PRO-7-${currentYear}`, metaX + 16, 53, { width: 165 });

      // =============================================================
      // 3. TOP CLIENT & AUTHORIZED REPRESENTATIVE CARDS
      // =============================================================
      let curY = 82;
      const halfWidth = 268;

      // --- Left Card: PREPARED FOR ---
      doc.roundedRect(24, curY, halfWidth, 54, 5).fillAndStroke(cardBg, cardBorder);

      // Avatar circle
      doc.circle(42, curY + 27, 13).fill(purpleDark);
      drawUserAvatar(doc, 42, curY + 27);

      doc.fillColor(purpleBrand).fontSize(7).font("Helvetica-Bold")
        .text("PREPARED FOR:", 60, curY + 7);
      doc.fillColor(textPrimary).fontSize(9.5).font("Helvetica-Bold")
        .text(clientName, 60, curY + 17);
      doc.fillColor(textSecondary).fontSize(7).font("Helvetica")
        .text("Verified Project Client Partner", 60, curY + 29);
      doc.fillColor(emeraldGreen).fontSize(7).font("Helvetica-Bold")
        .text("Status: Active Engagement", 60, curY + 40);

      // --- Right Card: AUTHORIZED REPRESENTATIVE ---
      const rightCardX = 302;
      doc.roundedRect(rightCardX, curY, halfWidth, 54, 5).fillAndStroke(cardBg, cardBorder);

      // Avatar circle
      doc.circle(rightCardX + 18, curY + 27, 13).fill(purpleDark);
      drawUserAvatar(doc, rightCardX + 18, curY + 27);

      doc.fillColor(purpleBrand).fontSize(7).font("Helvetica-Bold")
        .text("AUTHORIZED REPRESENTATIVE:", rightCardX + 36, curY + 7);
      doc.fillColor(textPrimary).fontSize(9.5).font("Helvetica-Bold")
        .text("Shubham Vernekar", rightCardX + 36, curY + 17);
      doc.fillColor(textSecondary).fontSize(7).font("Helvetica")
        .text("Founder & Principal Architect, ShubDeep Labs", rightCardX + 36, curY + 29);

      // Phone & Email with vector icons
      drawPhoneIcon(doc, rightCardX + 36, curY + 40);
      doc.fillColor(purpleDark).fontSize(7).font("Helvetica-Bold")
        .text("+91 90288 33275", rightCardX + 46, curY + 41);

      drawMailIcon(doc, rightCardX + 126, curY + 41);
      doc.fillColor(purpleDark).fontSize(7).font("Helvetica-Bold")
        .text("shubdeeplabs@gmail.com", rightCardX + 139, curY + 41);

      // =============================================================
      // 4. SECTION 01: PROJECT OVERVIEW & SCOPE OF WORK
      // =============================================================
      curY += 62;

      // Section Number Badge "01"
      doc.roundedRect(24, curY, 24, 16, 3).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold")
        .text("01", 24, curY + 3.5, { width: 24, align: "center" });

      doc.fillColor(purpleDark).fontSize(9.5).font("Helvetica-Bold")
        .text("PROJECT OVERVIEW & SCOPE OF WORK", 54, curY + 3.5);

      // Gold filigree line
      doc.save();
      doc.lineWidth(0.8).strokeColor(goldAccent);
      doc.moveTo(260, curY + 9).lineTo(360, curY + 9).stroke();
      doc.fillColor(goldAccent).fontSize(5).text("*", 308, curY + 6.5);
      doc.restore();

      curY += 19;
      doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica-Bold")
        .text("Project Category: ", 24, curY, { continued: true })
        .fillColor(textPrimary).text(projectType);

      curY += 13;

      // --- Left Deliverables Column (4 items) ---
      const col1X = 24;
      const col2X = 200;
      let dY1 = curY;
      const col1Items = [
        "Modern, User-Responsive UI/UX Layout\n(Mobile, Tablet & Desktop optimized)",
        "Secure High-Speed Backend Architecture &\nCloud Database Integration",
        "Full E-Commerce Catalog, Shopping Cart &\nLive Daily Market Rate Engine",
        "Online Payment Gateway Integration\n(Instant UPI QR, Razorpay & Cards)",
      ];

      col1Items.forEach((text) => {
        drawCheckBadge(doc, col1X + 6, dY1 + 8);
        doc.fillColor(textPrimary).fontSize(7).font("Helvetica-Bold")
          .text(text, col1X + 16, dY1 + 1.5, { width: 168, lineGap: 1 });
        dY1 += 29;
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
        doc.fillColor(textPrimary).fontSize(7).font("Helvetica-Bold")
          .text(text, col2X + 16, dY2 + 1.5, { width: 168, lineGap: 1 });
        dY2 += 29;
      });

      // --- Right Box: PAYMENT RECEIPT SIDE-CARD ---
      const receiptX = 394;
      const receiptY = curY - 8;
      const receiptW = 176;
      const receiptH = 118;
      doc.roundedRect(receiptX, receiptY, receiptW, receiptH, 6).fillAndStroke("#ffffff", cardBorder);

      // Receipt icon box
      doc.roundedRect(receiptX + 10, receiptY + 12, 22, 28, 3).stroke(goldAccent);
      drawDocIcon(doc, receiptX + 16, receiptY + 19);

      doc.fillColor(purpleDark).fontSize(8).font("Helvetica-Bold")
        .text("PAYMENT RECEIPT", receiptX + 38, receiptY + 14);

      doc.fillColor(textSecondary).fontSize(6.8).font("Helvetica")
        .text("This is not a tax invoice.", receiptX + 38, receiptY + 27)
        .text("This receipt is issued upon advance booking/payment towards the project.", receiptX + 38, receiptY + 38, { width: 126 });

      // Gold filigree ornament inside receipt
      doc.save();
      doc.lineWidth(0.8).strokeColor(goldAccent);
      doc.moveTo(receiptX + 20, receiptY + 98).lineTo(receiptX + receiptW - 20, receiptY + 98).stroke();
      doc.fillColor(goldAccent).fontSize(5).text("*", receiptX + (receiptW / 2) - 2.5, receiptY + 95.5);
      doc.restore();

      // =============================================================
      // 5. SECTION 02: COMMERCIAL INVESTMENT & MILESTONE SCHEDULE
      // =============================================================
      curY = 328;

      // Section Number Badge "02"
      doc.roundedRect(24, curY, 24, 16, 3).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold")
        .text("02", 24, curY + 3.5, { width: 24, align: "center" });

      doc.fillColor(purpleDark).fontSize(9.5).font("Helvetica-Bold")
        .text("COMMERCIAL INVESTMENT & MILESTONE SCHEDULE", 54, curY + 3.5);

      // Gold filigree line
      doc.save();
      doc.lineWidth(0.8).strokeColor(goldAccent);
      doc.moveTo(320, curY + 9).lineTo(430, curY + 9).stroke();
      doc.fillColor(goldAccent).fontSize(5).text("*", 373, curY + 6.5);
      doc.restore();

      curY += 19;

      // --- Commercial Table Header ---
      const tableW = 546;
      doc.roundedRect(24, curY, tableW, 20, 3).fill(purpleDark);

      doc.fillColor("#ffffff").fontSize(7.5).font("Helvetica-Bold")
        .text("SCOPE / DESCRIPTION", 38, curY + 5.5)
        .text("TIMELINE", 280, curY + 5.5)
        .text("APPROVED INVESTMENT", 412, curY + 5.5, { width: 146, align: "right" });

      curY += 20;

      // --- Commercial Table Content Row ---
      const rowH = 48;
      doc.roundedRect(24, curY, tableW, rowH, 0).fillAndStroke("#ffffff", cardBorder);

      // Left: Gold Diamond Icon + Scope Title & Subtitle
      doc.polygon([38, curY + 16], [45, curY + 12], [52, curY + 16], [52, curY + 25], [45, curY + 29], [38, curY + 25])
        .fillAndStroke(cardBg, goldAccent);
      doc.fillColor(goldAccent).fontSize(6.5).font("Helvetica-Bold").text("<>", 40.5, curY + 17.5);

      doc.fillColor(textPrimary).fontSize(8).font("Helvetica-Bold")
        .text("Gold & Jewellery E-Commerce Platform\n& Real-Time Rates Engine", 60, curY + 9, { width: 200 });
      doc.fillColor(textSecondary).fontSize(6.8).font("Helvetica")
        .text("Complete Source Code & Live Cloud Deployment", 60, curY + 31);

      // Middle: Timeline
      doc.fillColor(purpleDark).fontSize(9).font("Helvetica-Bold")
        .text(timeline, 280, curY + 13);
      doc.fillColor(textSecondary).fontSize(6.8).font("Helvetica")
        .text("Live Staging Demo", 280, curY + 26);

      // Right: Investment & Status Badge
      doc.fillColor(emeraldGreen).fontSize(10.5).font("Helvetica-Bold")
        .text("Rs. 13,000", 412, curY + 7, { width: 146, align: "right" });
      doc.fillColor(textPrimary).fontSize(7).font("Helvetica")
        .text("Advance: Rs. 6,500 (50%)", 412, curY + 20, { width: 146, align: "right" });
      doc.fillColor(cyanBadge).fontSize(7).font("Helvetica-Bold")
        .text("[KICKOFF CONFIRMED]", 412, curY + 32, { width: 146, align: "right" });

      // =============================================================
      // 6. PROJECT TERMS & ONBOARDING GUIDELINES CARD
      // =============================================================
      curY += rowH + 8;
      const termsH = 74;
      doc.roundedRect(24, curY, tableW, termsH, 5).fillAndStroke(cardBg, cardBorder);

      // Shield icon + Title
      doc.circle(36, curY + 12, 5.5).fill(purpleDark);
      doc.fillColor("#ffffff").fontSize(6).font("Helvetica-Bold").text("v", 34.2, curY + 8.5);

      doc.fillColor(purpleDark).fontSize(7.5).font("Helvetica-Bold")
        .text("PROJECT TERMS & ONBOARDING GUIDELINES:", 48, curY + 8);

      // 2-Column Guidelines with Strict Absolute Positioning (NO continued: true overlap)
      const tCol1X = 36;
      const tCol2X = 302;
      let tY = curY + 22;

      // Col 1 (3 items)
      const t1 = [
        "Advance Booking: 50% booking advance payment (Rs. 6,500) locks your dedicated development slot.",
        "Live Staging & Review: A private live staging link will be provided for milestone review prior to final release.",
        "100% Code Ownership: Full unencumbered source code & database ownership transfer upon final milestone.",
      ];
      t1.forEach((item) => {
        doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica-Bold").text(">", tCol1X, tY);
        doc.fillColor(textPrimary).fontSize(6.8).font("Helvetica").text(item, tCol1X + 10, tY, { width: 245 });
        tY += 15.5;
      });

      // Col 2 (1 item)
      doc.fillColor(purpleBrand).fontSize(7.5).font("Helvetica-Bold").text(">", tCol2X, curY + 22);
      doc.fillColor(textPrimary).fontSize(6.8).font("Helvetica")
        .text("Post-Launch Warranty: 30 days of complimentary bug fixes, training, and technical support post-deployment.", tCol2X + 10, curY + 22, { width: 245 });

      // =============================================================
      // 7. SIGNATORY & VERIFICATION BLOCK
      // =============================================================
      curY += termsH + 10;
      const signH = 68;

      // --- Left Box: FOR SHUBDEEP LABS ---
      doc.roundedRect(24, curY, halfWidth, signH, 5).fillAndStroke("#ffffff", cardBorder);

      // Seal circle with SL logo
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.circle(46, curY + 34, 16).stroke(goldAccent);
        doc.image(logoPath, 34, curY + 22, { width: 24, height: 24 });
        doc.restore();
      }

      doc.fillColor(purpleDark).fontSize(7.2).font("Helvetica-Bold")
        .text("FOR SHUBDEEP LABS:", 68, curY + 8);
      doc.fillColor(emeraldGreen).fontSize(7.2).font("Helvetica-Bold")
        .text("[OFFICIALLY VERIFIED & APPROVED]", 68, curY + 18);
      doc.fillColor(textSecondary).fontSize(6.8).font("Helvetica")
        .text("Shubham Vernekar (Founder & Principal Architect)", 68, curY + 29);

      // Signature: Cursive handwritten styling with authentic pen flourish stroke
      doc.font("Times-Italic").fontSize(14).fillColor("#1e1b4b")
        .text("Shubham Vernekar", 68, curY + 41);

      // Signature ink flourish stroke
      doc.save();
      doc.lineWidth(1.1).strokeColor("#1e1b4b");
      doc.moveTo(68, curY + 54)
        .bezierCurveTo(88, curY + 56, 120, curY + 53, 150, curY + 55)
        .bezierCurveTo(165, curY + 56, 180, curY + 52, 188, curY + 54)
        .stroke();
      doc.lineWidth(0.8).strokeColor("#4c1d95");
      doc.moveTo(72, curY + 56)
        .bezierCurveTo(105, curY + 58, 145, curY + 57, 182, curY + 55)
        .bezierCurveTo(192, curY + 54, 198, curY + 52, 190, curY + 57)
        .bezierCurveTo(160, curY + 60, 110, curY + 59, 80, curY + 58)
        .stroke();
      doc.restore();

      // Reset back to standard font
      doc.font("Helvetica");

      // --- Right Box: ACCEPTED & CONFIRMED BY CLIENT ---
      doc.roundedRect(rightCardX, curY, halfWidth, signH, 5).fillAndStroke("#ffffff", cardBorder);

      // Handshake purple circle
      doc.circle(rightCardX + 22, curY + 34, 15).fill(purpleDark);
      drawHandshakeIcon(doc, rightCardX + 22, curY + 34);

      doc.fillColor(purpleDark).fontSize(7.2).font("Helvetica-Bold")
        .text("ACCEPTED & CONFIRMED BY CLIENT:", rightCardX + 44, curY + 8);
      doc.fillColor(textPrimary).fontSize(7.8).font("Helvetica-Bold")
        .text(clientName, rightCardX + 44, curY + 18);
      doc.fillColor(textSecondary).fontSize(6.8).font("Helvetica")
        .text("Project Partner / Authorized Signatory", rightCardX + 44, curY + 29);

      // Client Signature Line & Date
      doc.save();
      doc.lineWidth(0.6).strokeColor("#94a3b8");
      doc.moveTo(rightCardX + 44, curY + 45).lineTo(rightCardX + halfWidth - 14, curY + 45).stroke();
      doc.restore();

      doc.fillColor(textPrimary).fontSize(7).font("Helvetica-Bold")
        .text(`Date: _____ / _____ / ${currentYear}`, rightCardX + 44, curY + 51);

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
