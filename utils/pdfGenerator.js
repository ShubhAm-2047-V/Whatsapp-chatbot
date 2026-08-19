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
    .replace(/[^\x20-\x7E\n\r\t]/g, "") // Keep only clean printable ASCII
    .trim();
}

/**
 * Generates an executive, branded PDF proposal & agreement for ShubDeep Labs
 */
function generateQuotationPDF(data = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 36,
        size: "A4",
        autoFirstPage: true,
        bufferPages: true,
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const logoPath = path.join(__dirname, "..", "assets", "logo.jpg");
      const primaryColor = "#0f172a"; // Deep Slate
      const secondaryColor = "#1e1b4b"; // Indigo
      const accentEmerald = "#059669"; // Emerald Green
      const textDark = "#1e293b";
      const textMuted = "#64748b";
      const lightBg = "#f8fafc";
      const borderColor = "#e2e8f0";

      const clientName = sanitizePdfText(data.clientName || "Valued Client");
      const projectType = sanitizePdfText(data.projectType || "Custom Gold E-Commerce & Web Platform");
      const rawPrice = sanitizePdfText(data.priceRange || "Rs. 13,000");
      const timeline = sanitizePdfText(data.timeline || "2-3 Weeks");

      // -------------------------------------------------------------
      // 1. SUBTLE BACKGROUND WATERMARK (Center of Page)
      // -------------------------------------------------------------
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.opacity(0.06); // Ultra subtle, premium look
        const wmSize = 340;
        const wmX = (doc.page.width - wmSize) / 2;
        const wmY = (doc.page.height - wmSize) / 2 + 30;
        doc.image(logoPath, wmX, wmY, { width: wmSize, height: wmSize });
        doc.restore();
      }

      // -------------------------------------------------------------
      // 2. HEADER BANNER WITH LOGO & BRANDING
      // -------------------------------------------------------------
      doc.rect(0, 0, doc.page.width, 95).fill(primaryColor);

      // Render Logo in Top Header
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.image(logoPath, 36, 18, { width: 60, height: 60 });
        doc.restore();
      }

      const brandStartX = fs.existsSync(logoPath) ? 106 : 36;
      doc.fillColor("#ffffff").fontSize(20).font("Helvetica-Bold")
        .text("SHUBDEEP LABS", brandStartX, 25);

      doc.fillColor("#94a3b8").fontSize(9).font("Helvetica")
        .text("Global Software Engineering & Custom AI Solutions Studio", brandStartX, 48)
        .text("Empowering Businesses with Next-Gen Digital Architecture", brandStartX, 60);

      const headerRightX = doc.page.width - 220;
      doc.fillColor("#38bdf8").fontSize(11).font("Helvetica-Bold")
        .text("PROJECT ESTIMATE & AGREEMENT", headerRightX, 28, { align: "right", width: 184 });

      doc.fillColor("#94a3b8").fontSize(8.5).font("Helvetica")
        .text(`Date: ${new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })}`, headerRightX, 48, { align: "right", width: 184 })
        .text("Doc Ref: SDL-PRP-" + Date.now().toString().slice(-6), headerRightX, 60, { align: "right", width: 184 });

      // -------------------------------------------------------------
      // 3. PREPARED FOR & AUTHORIZED CONTACT CARD
      // -------------------------------------------------------------
      let currentY = 110;
      doc.rect(36, currentY, doc.page.width - 72, 62).fill(lightBg).stroke(borderColor);

      // Left Column: Client Details
      doc.fillColor(primaryColor).fontSize(9.5).font("Helvetica-Bold")
        .text("PREPARED FOR:", 48, currentY + 10);
      doc.fillColor(textDark).fontSize(11).font("Helvetica-Bold")
        .text(clientName, 48, currentY + 24);
      doc.fillColor(textMuted).fontSize(8.5).font("Helvetica")
        .text("Verified Project Client Partner", 48, currentY + 40);

      // Right Column: Shubham Vernekar (Founder)
      const repX = doc.page.width - 250;
      doc.fillColor(primaryColor).fontSize(9.5).font("Helvetica-Bold")
        .text("AUTHORIZED REPRESENTATIVE:", repX, currentY + 10);
      doc.fillColor(textDark).fontSize(10).font("Helvetica-Bold")
        .text("Shubham Vernekar (Founder & Lead Architect)", repX, currentY + 24);
      doc.fillColor(textMuted).fontSize(8.5).font("Helvetica")
        .text("+91 90288 33275 | shubdeeplabs@gmail.com", repX, currentY + 40);

      // -------------------------------------------------------------
      // 4. PROJECT SCOPE & KEY DELIVERABLES
      // -------------------------------------------------------------
      currentY += 76;
      doc.fillColor(primaryColor).fontSize(12).font("Helvetica-Bold")
        .text("1. Project Overview & Scope of Work", 36, currentY);

      currentY += 18;
      doc.fillColor(textDark).fontSize(9.5).font("Helvetica")
        .text(`Project Category: `, 36, currentY, { continued: true })
        .font("Helvetica-Bold").text(projectType);

      currentY += 16;
      const deliverables = [
        "Modern, Ultra-Responsive UI/UX Layout (Mobile, Tablet & Desktop optimized)",
        "Secure High-Speed Backend Architecture & Cloud Database Integration",
        "Full E-Commerce Catalog, Shopping Cart & Live Market Rate Sync",
        "Online Payment Gateway Integration (Instant UPI QR, Cards & Netbanking)",
        "Admin Management Portal for Products, Inquiries & Lead Tracking",
        "100% Full Source Code Ownership with Zero Vendor Lock-in",
        "Production Deployment & 30-Day Complimentary Post-Launch SLA Support",
      ];

      doc.fillColor(textDark).fontSize(8.5).font("Helvetica");
      deliverables.forEach((item) => {
        doc.fillColor(accentEmerald).text("•", 44, currentY, { continued: true });
        doc.fillColor(textDark).text(`  ${item}`, 54, currentY);
        currentY += 14;
      });

      // -------------------------------------------------------------
      // 5. COMMERCIAL INVESTMENT & TIMELINE TABLE
      // -------------------------------------------------------------
      currentY += 8;
      doc.fillColor(primaryColor).fontSize(12).font("Helvetica-Bold")
        .text("2. Commercial Estimate & Milestone Schedule", 36, currentY);

      currentY += 18;
      // Table Header
      const tableWidth = doc.page.width - 72;
      doc.rect(36, currentY, tableWidth, 24).fill(primaryColor);
      doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold")
        .text("SCOPE / DESCRIPTION", 48, currentY + 7)
        .text("ESTIMATED TIMELINE", 295, currentY + 7)
        .text("APPROVED INVESTMENT", 420, currentY + 7, { align: "right", width: 96 });

      currentY += 24;
      // Table Row
      const rowHeight = 44;
      doc.rect(36, currentY, tableWidth, rowHeight).fill("#ffffff").stroke(borderColor);
      doc.fillColor(textDark).fontSize(9).font("Helvetica-Bold")
        .text(projectType, 48, currentY + 9, { width: 235 });
      doc.fillColor(textMuted).fontSize(8).font("Helvetica")
        .text("Complete Source Code & Live Cloud Handover", 48, currentY + 23);

      doc.fillColor(textDark).fontSize(9).font("Helvetica-Bold")
        .text(timeline, 295, currentY + 16);

      doc.fillColor(accentEmerald).fontSize(9.5).font("Helvetica-Bold")
        .text(rawPrice, 400, currentY + 11, { align: "right", width: 116 });
      doc.fillColor(textMuted).fontSize(7.5).font("Helvetica")
        .text("50% Advance / 50% Final", 400, currentY + 25, { align: "right", width: 116 });

      // -------------------------------------------------------------
      // 6. TERMS, ONBOARDING & ACCEPTANCE CLAUSES
      // -------------------------------------------------------------
      currentY += rowHeight + 12;
      doc.rect(36, currentY, tableWidth, 68).fill(lightBg).stroke(borderColor);

      doc.fillColor(primaryColor).fontSize(8.5).font("Helvetica-Bold")
        .text("PROJECT TERMS & ONBOARDING GUIDELINES:", 46, currentY + 8);

      const terms = [
        "Advance Milestone: 50% booking advance payment locks your dedicated development slot.",
        "Staging & Review: A live preview link will be provided for milestone approval prior to deployment.",
        "Code Ownership: 100% full unencumbered source code rights transfer to the client upon final settlement.",
        "Warranty Support: 30 days of free bug-fix warranty and technical maintenance starting from live launch.",
      ];

      let termY = currentY + 20;
      terms.forEach((term) => {
        doc.fillColor(textMuted).fontSize(7.5).font("Helvetica")
          .text(`• ${term}`, 46, termY);
        termY += 10.5;
      });

      // -------------------------------------------------------------
      // 7. SIGNATORY / APPROVAL BLOCK
      // -------------------------------------------------------------
      currentY += 80;
      doc.rect(36, currentY, tableWidth, 54).stroke(borderColor);

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
      const footerY = doc.page.height - 38;
      doc.rect(0, footerY, doc.page.width, 38).fill(primaryColor);
      doc.fillColor("#94a3b8").fontSize(7.8).font("Helvetica")
        .text("ShubDeep Labs • Solapur, Maharashtra, India • https://shubh-deep-labs.vercel.app • +91 90288 33275", 36, footerY + 12, { align: "center", width: doc.page.width - 72 });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateQuotationPDF };
