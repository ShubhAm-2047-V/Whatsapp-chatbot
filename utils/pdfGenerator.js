const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

/**
 * Sanitizes strings for PDF rendering
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
 * Generates the official, executive ShubDeep Labs Project Agreement & Payment Receipt PDF
 * exactly preserving the master visual graphic design.
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
        // Embed the exact official master template graphic
        doc.image(templateBasePath, 0, 0, { width: doc.page.width, height: doc.page.height });

        // If customized for a different client name, dynamically overlay the new name
        if (!isDefaultClient) {
          doc.save();
          // Top Prepared For Card
          doc.rect(78, 100, 185, 16).fill("#faf5ff");
          doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold")
            .text(clientName, 78, 102, { width: 185 });

          // Bottom Client Signatory Card
          doc.rect(348, 622, 185, 16).fill("#ffffff");
          doc.fillColor("#0f172a").fontSize(8.5).font("Helvetica-Bold")
            .text(clientName, 348, 624, { width: 185 });
          doc.restore();
        }

        doc.end();
        return;
      }

      // Fallback
      doc.fontSize(16).text("ShubDeep Labs Project Agreement & Payment Receipt", 50, 50);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateQuotationPDF };
