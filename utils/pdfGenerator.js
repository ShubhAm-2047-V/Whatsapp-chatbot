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
 * Generates an executive, luxury branded single-page PDF combining:
 * 1. Project Agreement & Scope Confirmation
 * 2. Official Payment Receipt & Financial Settlement Details
 * Exactly matching the official ShubDeep Labs graphic template design.
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

      const templateBasePath = path.join(__dirname, "..", "assets", "template_base.jpg");

      const clientName = sanitizePdfText(data.clientName || "Deepa Dinesh Vernekar");
      const isDefaultClient = !data.clientName || /deepa/i.test(data.clientName);

      if (fs.existsSync(templateBasePath)) {
        // Render the exact, high-resolution master template canvas
        doc.image(templateBasePath, 0, 0, { width: doc.page.width, height: doc.page.height });

        // If customized for a different client name, dynamically overlay the new name
        if (!isDefaultClient) {
          // Top Prepared For card
          doc.save();
          doc.rect(80, 102, 185, 14).fill("#faf5ff");
          doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold")
            .text(clientName, 80, 103, { width: 185 });

          // Bottom Client Signatory card
          doc.rect(348, 624, 185, 14).fill("#ffffff");
          doc.fillColor("#0f172a").fontSize(8.5).font("Helvetica-Bold")
            .text(clientName, 348, 625, { width: 185 });
          doc.restore();
        }

        doc.end();
        return;
      }

      // Fallback: If template image is missing, render vector layout
      const logoPath = path.join(__dirname, "..", "assets", "logo.jpg");
      const signCardPath = path.join(__dirname, "..", "assets", "signature_card.png");

      const purpleDark = "#1e1b4b";
      const purpleBrand = "#4c1d95";
      const goldAccent = "#d97706";
      const goldOchre = "#b45309";
      const emeraldGreen = "#059669";
      const textPrimary = "#0f172a";
      const textSecondary = "#475569";
      const cardBg = "#faf5ff";
      const cardBorder = "#e9d5ff";

      const currentDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      const currentYear = new Date().getFullYear();
      const projectType = sanitizePdfText(data.projectType || "Gold & Jewellery E-Commerce Platform & Real-Time Rates Engine");
      const timeline = sanitizePdfText(data.timeline || "2-3 Weeks");
      const receiptNo = data.receiptNo || `SDL-RCP-${currentYear}-001`;
      const projectRef = data.projectRef || `SDL-PRO-7-${currentYear}`;

      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 24, 16, { width: 62, height: 62 });
      }

      doc.fillColor(purpleDark).fontSize(22).font("Helvetica-Bold")
        .text("SHUBDEEP", 94, 18, { continued: true })
        .fillColor(goldOchre).text(" LABS");

      doc.fillColor(textPrimary).fontSize(8).font("Helvetica-Bold")
        .text("Global Software Engineering & Custom AI Solutions Studio", 94, 43);

      doc.fillColor(goldOchre).fontSize(7.5).font("Helvetica-Oblique")
        .text("Empowering Businesses with Next-Gen Digital Architecture", 94, 54);

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateQuotationPDF };
