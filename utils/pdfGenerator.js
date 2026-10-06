const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

const templateBasePath = path.join(__dirname, "..", "assets", "template_base.jpg");
let templateBaseBuffer = null;

// Pre-load base template graphic into memory for zero disk I/O on PDF generation
function loadTemplateBuffer() {
  try {
    if (fs.existsSync(templateBasePath)) {
      templateBaseBuffer = fs.readFileSync(templateBasePath);
      return templateBaseBuffer;
    }
  } catch (e) {
    console.warn("Could not pre-load PDF template graphic:", e.message);
  }
  return null;
}

loadTemplateBuffer();

// In-memory PDF buffer cache
const pdfBufferCache = new Map();
const MAX_PDF_CACHE_SIZE = 30;

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
 * Draws Section 01 / 02 divider lines with gold diamond ornament
 */
function drawOrnamentalSectionHeader(doc, title, sectionNumber = "01", y = 175) {
  const width = doc.page.width;
  
  // Section number pill badge
  doc.roundedRect(40, y, 26, 18, 4).fill("#0f172a");
  doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold")
    .text(sectionNumber, 40, y + 4, { width: 26, align: "center" });

  // Section title
  doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold")
    .text(title.toUpperCase(), 74, y + 4);

  const textW = doc.widthOfString(title.toUpperCase());
  const lineStart = 80 + textW;
  const lineEnd = width - 40;

  if (lineEnd > lineStart + 40) {
    const midX = (lineStart + lineEnd) / 2;
    doc.lineWidth(0.8).strokeColor("#d97706");
    doc.moveTo(lineStart + 10, y + 9).lineTo(midX - 8, y + 9).stroke();
    doc.moveTo(midX + 8, y + 9).lineTo(lineEnd, y + 9).stroke();
    // Diamond ornament
    doc.polygon([midX, y + 5], [midX + 4, y + 9], [midX, y + 13], [midX - 4, y + 9]).fill("#d97706");
  }
}

/**
 * Generates the official, executive ShubDeep Labs Project Agreement & Proposal PDF
 * using our official master template.
 */
function generateQuotationPDF(data = {}) {
  const clientName = sanitizePdfText(data.clientName || "Deepa Dinesh Vernekar");
  const cacheKey = `quotation_${clientName.toLowerCase()}`;

  if (pdfBufferCache.has(cacheKey)) {
    return Promise.resolve(pdfBufferCache.get(cacheKey));
  }

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
      doc.on("end", () => {
        const fullBuffer = Buffer.concat(buffers);
        if (pdfBufferCache.size >= MAX_PDF_CACHE_SIZE) {
          const oldest = pdfBufferCache.keys().next().value;
          pdfBufferCache.delete(oldest);
        }
        pdfBufferCache.set(cacheKey, fullBuffer);
        resolve(fullBuffer);
      });
      doc.on("error", (err) => reject(err));

      const imgBuffer = templateBaseBuffer || loadTemplateBuffer();

      if (imgBuffer) {
        // 1. Embed official master template graphic
        doc.image(imgBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

        doc.save();

        // 2. Client Profile Card (Top Left)
        doc.fillColor("#0f172a").fontSize(11).font("Helvetica-Bold")
          .text(clientName, 75, 116, { width: 195 });
        doc.fillColor("#64748b").fontSize(7.5).font("Helvetica")
          .text("Project Partner / Authorized Signatory", 75, 130);
        doc.fillColor("#16a34a").fontSize(7.5).font("Helvetica-Bold")
          .text("Status: Verified & Active Engagement", 75, 142);

        // 3. Section 01: Project Overview & Scope
        drawOrnamentalSectionHeader(doc, "Project Overview & Technical Scope", "01", 175);

        const scopeItems = [
          "Modern Responsive Web Application & Conversational AI Chat Engine",
          "Production-Grade Security, High-Speed Performance & Automated Backups",
          "100% Full Unencumbered Source Code Ownership & Database Handover",
          "Continuous SLA Support, Deployment Verification & Onboarding Support",
        ];

        let scopeY = 202;
        for (const item of scopeItems) {
          doc.circle(48, scopeY + 4, 3).fill("#16a34a");
          doc.fillColor("#334155").fontSize(8.5).font("Helvetica")
            .text(item, 58, scopeY, { width: doc.page.width - 100 });
          scopeY += 16;
        }

        // 4. Section 02: Commercial Terms & Delivery
        drawOrnamentalSectionHeader(doc, "Approved Commercial Terms & Schedule", "02", 280);

        const tableX = 40;
        const tableY = 306;
        const tableW = doc.page.width - 80;

        // Table Header
        doc.roundedRect(tableX, tableY, tableW, 20, 4).fill("#0f172a");
        doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold")
          .text("COMMERCIAL DELIVERABLE", tableX + 12, tableY + 6)
          .text("TOTAL INVESTMENT", tableX + 220, tableY + 6)
          .text("BOOKING ADVANCE (50%)", tableX + 340, tableY + 6);

        // Table Row
        doc.roundedRect(tableX, tableY + 22, tableW, 28, 4).fill("#f8fafc");
        doc.lineWidth(1).strokeColor("#e2e8f0").roundedRect(tableX, tableY + 22, tableW, 28, 4).stroke();

        doc.fillColor("#0f172a").fontSize(8.5).font("Helvetica-Bold")
          .text("Full-Stack Enterprise System Suite", tableX + 12, tableY + 31);
        doc.fillColor("#16a34a").fontSize(10).font("Helvetica-Bold")
          .text("Rs. 13,000", tableX + 220, tableY + 30);
        doc.fillColor("#4f46e5").fontSize(10).font("Helvetica-Bold")
          .text("Rs. 6,500", tableX + 340, tableY + 30);

        // 5. Client Acceptance Card (Bottom Right)
        doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold")
          .text(clientName, 350, 642, { width: 185 });

        doc.restore();
        doc.end();
        return;
      }

      // Fallback
      doc.fontSize(16).text("ShubDeep Labs Project Agreement", 50, 50);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Generates an official, beautifully branded ShubDeep Labs Custom Document / Letter / Acknowledgement
 * using our EXACT master company template graphic without any awkward boxes!
 */
function generateCustomDocumentPDF(options = {}) {
  const clientName = sanitizePdfText(options.clientName || "Deepa Dinesh Vernekar");
  const messageText = sanitizePdfText(options.messageText || "Thank you");
  const isBigWords = options.isBigWords !== false;

  const cacheKey = `custom_${clientName.toLowerCase()}_${messageText.toLowerCase()}_${isBigWords}`;
  if (pdfBufferCache.has(cacheKey)) {
    return Promise.resolve(pdfBufferCache.get(cacheKey));
  }

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
      doc.on("end", () => {
        const fullBuffer = Buffer.concat(buffers);
        if (pdfBufferCache.size >= MAX_PDF_CACHE_SIZE) {
          const oldest = pdfBufferCache.keys().next().value;
          pdfBufferCache.delete(oldest);
        }
        pdfBufferCache.set(cacheKey, fullBuffer);
        resolve(fullBuffer);
      });
      doc.on("error", (err) => reject(err));

      const imgBuffer = templateBaseBuffer || loadTemplateBuffer();

      if (imgBuffer) {
        // 1. Embed official master template graphic
        doc.image(imgBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

        doc.save();

        // 2. Client Profile Card (Top Left)
        doc.fillColor("#0f172a").fontSize(11).font("Helvetica-Bold")
          .text(clientName, 75, 116, { width: 195 });
        doc.fillColor("#64748b").fontSize(7.5).font("Helvetica")
          .text("Project Partner / Authorized Signatory", 75, 130);
        doc.fillColor("#16a34a").fontSize(7.5).font("Helvetica-Bold")
          .text("Status: Verified & Active Engagement", 75, 142);

        // 3. Section 01: Official Statement Header
        drawOrnamentalSectionHeader(doc, "Official Statement & Recognition", "01", 175);

        // 4. Middle Content Area (Clean typography directly on template white background)
        const width = doc.page.width;
        const middleY = 210;

        if (isBigWords) {
          // Prominent Hero Typography (Big Words in Official Brand Deep Indigo)
          doc.fillColor("#1e1b4b").fontSize(42).font("Helvetica-Bold")
            .text(messageText.toUpperCase(), 50, middleY + 25, {
              width: width - 100,
              align: "center",
              lineGap: 8,
            });

          // Gold decorative accent line
          const lineW = 140;
          const lineX = (width - lineW) / 2;
          doc.lineWidth(2).strokeColor("#c28b24").moveTo(lineX, middleY + 85).lineTo(lineX + lineW, middleY + 85).stroke();

          // Formal Warm Acknowledgement
          doc.fillColor("#334155").fontSize(11.5).font("Helvetica")
            .text(
              `This official letter is presented to ${clientName} in sincere recognition and appreciation from the entire executive team at ShubDeep Labs.`,
              60,
              middleY + 110,
              { width: width - 120, align: "center", lineGap: 6 }
            );

          doc.fillColor("#64748b").fontSize(9.5).font("Helvetica-Oblique")
            .text(
              "We deeply value your trust and collaboration as we build next-generation intelligent digital solutions together.",
              60,
              middleY + 155,
              { width: width - 120, align: "center", lineGap: 4 }
            );

          doc.fillColor("#94a3b8").fontSize(8.5).font("Helvetica")
            .text("From the Desk of Shubham Vernekar — Founder & Lead Architect", 60, middleY + 200, { width: width - 120, align: "center" });

        } else {
          doc.fillColor("#1e1b4b").fontSize(26).font("Helvetica-Bold")
            .text(messageText, 50, middleY + 30, {
              width: width - 100,
              align: "center",
              lineGap: 6,
            });

          doc.fillColor("#334155").fontSize(11.5).font("Helvetica")
            .text(
              `This official communication is issued to ${clientName} with the compliments of ShubDeep Labs.`,
              60,
              middleY + 100,
              { width: width - 120, align: "center", lineGap: 6 }
            );

          doc.fillColor("#64748b").fontSize(9.5).font("Helvetica-Oblique")
            .text(
              "For any inquiries or technical consultations, our leadership team is at your complete disposal.",
              60,
              middleY + 145,
              { width: width - 120, align: "center", lineGap: 4 }
            );
        }

        // 5. Client Acceptance Card (Bottom Right)
        doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold")
          .text(clientName, 350, 642, { width: 185 });

        doc.restore();
        doc.end();
        return;
      }

      // Fallback
      doc.fontSize(16).text("ShubDeep Labs Official Document", 50, 50);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateQuotationPDF, generateCustomDocumentPDF };
