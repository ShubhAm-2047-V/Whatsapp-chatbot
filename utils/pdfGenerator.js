const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

/**
 * Sanitizes strings for PDFKit standard fonts (removes emojis, converts symbols)
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
 * Generates an ultra-premium, single-page executive PDF proposal & agreement
 */
function generateQuotationPDF(data = {}) {
  return new Promise((resolve, reject) => {
    try {
      // Create document with margins disabled for absolute pixel-perfect single page control
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
      const primaryColor = "#0b1329"; // Deep Midnight Navy
      const accentEmerald = "#059669"; // Emerald Green
      const accentCyan = "#0284c7"; // Modern Cyan
      const textDark = "#0f172a";
      const textMuted = "#475569";
      const lightBg = "#f8fafc";
      const borderColor = "#cbd5e1";

      const clientName = sanitizePdfText(data.clientName || "Valued Client");
      const projectType = sanitizePdfText(data.projectType || "Custom Gold E-Commerce & Web Platform");
      const timeline = sanitizePdfText(data.timeline || "2-3 Weeks");

      // -------------------------------------------------------------
      // 1. SUBTLE BACKGROUND WATERMARK (Center of Page)
      // -------------------------------------------------------------
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.opacity(0.05); // Ultra-refined corporate watermark
        const wmSize = 340;
        const wmX = (doc.page.width - wmSize) / 2;
        const wmY = (doc.page.height - wmSize) / 2 + 10;
        doc.image(logoPath, wmX, wmY, { width: wmSize, height: wmSize });
        doc.restore();
      }

      // -------------------------------------------------------------
      // 2. HEADER BANNER WITH LOGO & BRANDING
      // -------------------------------------------------------------
      doc.rect(0, 0, doc.page.width, 88).fill(primaryColor);

      // Render Logo in Top Header
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.image(logoPath, 36, 16, { width: 56, height: 56 });
        doc.restore();
      }

      const brandStartX = fs.existsSync(logoPath) ? 104 : 36;
      doc.fillColor("#ffffff").fontSize(19).font("Helvetica-Bold")
        .text("SHUBDEEP LABS", brandStartX, 22);

      doc.fillColor("#94a3b8").fontSize(8.5).font("Helvetica")
        .text("Global Software Engineering & Custom AI Solutions Studio", brandStartX, 46)
        .text("Empowering Businesses with Next-Gen Digital Architecture", brandStartX, 58);

      const headerRightX = doc.page.width - 240;
      doc.fillColor("#38bdf8").fontSize(10).font("Helvetica-Bold")
        .text("PROJECT ESTIMATE & AGREEMENT", headerRightX, 22, { align: "right", width: 204 });

      doc.fillColor("#94a3b8").fontSize(8).font("Helvetica")
        .text(`Date: ${new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })}`, headerRightX, 42, { align: "right", width: 204 })
        .text("Doc Ref: SDL-PRP-" + Date.now().toString().slice(-6), headerRightX, 55, { align: "right", width: 204 });

      // -------------------------------------------------------------
      // 3. PREPARED FOR & AUTHORIZED CONTACT CARD
      // -------------------------------------------------------------
      let currentY = 100;
      const cardWidth = doc.page.width - 72;
      doc.rect(36, currentY, cardWidth, 68).fill(lightBg).stroke(borderColor);

      // Left Column: Client Details
      doc.fillColor(primaryColor).fontSize(8.5).font("Helvetica-Bold")
        .text("PREPARED FOR:", 50, currentY + 10);
      doc.fillColor(textDark).fontSize(11).font("Helvetica-Bold")
        .text(clientName, 50, currentY + 23);
      doc.fillColor(textMuted).fontSize(8).font("Helvetica")
        .text("Verified Project Client Partner", 50, currentY + 40)
        .text("Status: Active Engagement", 50, currentY + 52);

      // Right Column: Shubham Vernekar (Founder)
      const repX = doc.page.width - 270;
      doc.fillColor(primaryColor).fontSize(8.5).font("Helvetica-Bold")
        .text("AUTHORIZED REPRESENTATIVE:", repX, currentY + 10);
      doc.fillColor(textDark).fontSize(10).font("Helvetica-Bold")
        .text("Shubham Vernekar", repX, currentY + 23);
      doc.fillColor(textMuted).fontSize(8).font("Helvetica")
        .text("Founder & Principal Architect, ShubDeep Labs", repX, currentY + 38)
        .text("+91 90288 33275 | shubdeeplabs@gmail.com", repX, currentY + 50);

      // -------------------------------------------------------------
      // 4. PROJECT SCOPE & KEY DELIVERABLES
      // -------------------------------------------------------------
      currentY += 80;
      doc.fillColor(primaryColor).fontSize(11.5).font("Helvetica-Bold")
        .text("1. Project Overview & Scope of Work", 36, currentY);

      currentY += 17;
      doc.fillColor(textDark).fontSize(9).font("Helvetica")
        .text("Project Category: ", 36, currentY, { continued: true })
        .font("Helvetica-Bold").text(projectType);

      currentY += 15;
      const deliverables = [
        "Modern, Ultra-Responsive UI/UX Layout (Mobile, Tablet & Desktop optimized)",
        "Secure High-Speed Backend Architecture & Cloud Database Integration",
        "Full E-Commerce Catalog, Shopping Cart & Live Daily Market Rate Engine",
        "Online Payment Gateway Integration (Instant UPI QR, Razorpay & Cards)",
        "Admin Management Portal for Products, Inventory & Lead Tracking",
        "100% Full Source Code Ownership with Zero Vendor Lock-in",
        "Production Deployment & 30-Day Complimentary Post-Launch SLA Support",
      ];

      deliverables.forEach((item) => {
        doc.fillColor(accentEmerald).fontSize(8.5).font("Helvetica-Bold")
          .text("•", 44, currentY, { continued: true });
        doc.fillColor(textDark).fontSize(8).font("Helvetica")
          .text(`  ${item}`, 52, currentY);
        currentY += 13.5;
      });

      // -------------------------------------------------------------
      // 5. COMMERCIAL INVESTMENT & TIMELINE TABLE
      // -------------------------------------------------------------
      currentY += 8;
      doc.fillColor(primaryColor).fontSize(11.5).font("Helvetica-Bold")
        .text("2. Commercial Investment & Milestone Schedule", 36, currentY);

      currentY += 17;
      // Table Header
      const tableWidth = doc.page.width - 72;
      doc.rect(36, currentY, tableWidth, 22).fill(primaryColor);
      doc.fillColor("#ffffff").fontSize(8.5).font("Helvetica-Bold")
        .text("SCOPE / DESCRIPTION", 48, currentY + 6)
        .text("TIMELINE", 290, currentY + 6)
        .text("APPROVED INVESTMENT", 400, currentY + 6, { align: "right", width: 116 });

      currentY += 22;
      // Table Row
      const rowHeight = 56;
      doc.rect(36, currentY, tableWidth, rowHeight).fill("#ffffff").stroke(borderColor);

      // Column 1: Scope
      doc.fillColor(textDark).fontSize(8.5).font("Helvetica-Bold")
        .text(projectType, 48, currentY + 10, { width: 230 });
      doc.fillColor(textMuted).fontSize(7.5).font("Helvetica")
        .text("Complete Source Code & Live Cloud Deployment", 48, currentY + 36);

      // Column 2: Timeline
      doc.fillColor(textDark).fontSize(8.5).font("Helvetica-Bold")
        .text(timeline, 290, currentY + 18);
      doc.fillColor(textMuted).fontSize(7.5).font("Helvetica")
        .text("Live Staging Demo", 290, currentY + 32);

      // Column 3: Investment Breakdown
      doc.fillColor(accentEmerald).fontSize(9.5).font("Helvetica-Bold")
        .text("Rs. 13,000", 400, currentY + 10, { align: "right", width: 116 });
      doc.fillColor(textDark).fontSize(7.5).font("Helvetica")
        .text("Advance: Rs. 6,500 (50%)", 400, currentY + 24, { align: "right", width: 116 });
      doc.fillColor(accentCyan).fontSize(7.5).font("Helvetica-Bold")
        .text("[KICKOFF CONFIRMED]", 400, currentY + 38, { align: "right", width: 116 });

      // -------------------------------------------------------------
      // 6. TERMS, ONBOARDING & ACCEPTANCE CLAUSES
      // -------------------------------------------------------------
      currentY += rowHeight + 12;
      doc.rect(36, currentY, tableWidth, 68).fill(lightBg).stroke(borderColor);

      doc.fillColor(primaryColor).fontSize(8.5).font("Helvetica-Bold")
        .text("PROJECT TERMS & ONBOARDING GUIDELINES:", 46, currentY + 8);

      const terms = [
        "Advance Booking: 50% booking advance payment (Rs. 6,500) locks your dedicated development slot.",
        "Live Staging & Review: A private live staging link will be provided for milestone review prior to final release.",
        "100% Code Ownership: Full unencumbered source code & database ownership transfers upon final milestone.",
        "Post-Launch Warranty: 30 days of complimentary bug fixes, training, and technical support post-deployment.",
      ];

      let termY = currentY + 20;
      terms.forEach((term) => {
        doc.fillColor(textMuted).fontSize(7.3).font("Helvetica")
          .text(`• ${term}`, 46, termY);
        termY += 10.5;
      });

      // -------------------------------------------------------------
      // 7. SIGNATORY / APPROVAL BLOCK
      // -------------------------------------------------------------
      currentY += 80;
      doc.rect(36, currentY, tableWidth, 54).fill("#ffffff").stroke(borderColor);

      // Left Signatory: Founder
      doc.fillColor(textDark).fontSize(8).font("Helvetica-Bold")
        .text("FOR SHUBDEEP LABS:", 48, currentY + 8);
      doc.fillColor(accentEmerald).fontSize(8).font("Helvetica-Bold")
        .text("[OFFICIALLY VERIFIED & APPROVED]", 48, currentY + 20);
      doc.fillColor(textMuted).fontSize(7.5).font("Helvetica")
        .text("Shubham Vernekar (Founder & Principal Architect)", 48, currentY + 34);

      // Right Signatory: Client Partner
      const clientSignX = doc.page.width - 240;
      doc.fillColor(textDark).fontSize(8).font("Helvetica-Bold")
        .text("ACCEPTED & CONFIRMED BY CLIENT:", clientSignX, currentY + 8);
      doc.fillColor(textDark).fontSize(8.5).font("Helvetica-Bold")
        .text(clientName, clientSignX, currentY + 20);
      doc.fillColor(textMuted).fontSize(7.5).font("Helvetica")
        .text("Project Partner / Authorized Signatory", clientSignX, currentY + 34);

      // -------------------------------------------------------------
      // 8. FOOTER
      // -------------------------------------------------------------
      const footerY = doc.page.height - 36;
      doc.rect(0, footerY, doc.page.width, 36).fill(primaryColor);
      doc.fillColor("#94a3b8").fontSize(7.5).font("Helvetica")
        .text("ShubDeep Labs • Solapur, Maharashtra, India • https://shubh-deep-labs.vercel.app • +91 90288 33275", 36, footerY + 13, { align: "center", width: doc.page.width - 72 });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateQuotationPDF };
