const PDFDocument = require("pdfkit");

/**
 * Generates a clean, branded PDF proposal buffer for ShubDeep Labs
 */
function generateQuotationPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const primaryColor = "#0f172a";
      const accentColor = "#10b981";
      const textColor = "#334155";
      const lightBg = "#f8fafc";

      // --- HEADER ---
      doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);

      doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold")
        .text("SHUBDEEP LABS", 40, 30);

      doc.fillColor("#94a3b8").fontSize(10).font("Helvetica")
        .text("Global Software Engineering & Custom AI Solutions Studio", 40, 56);

      doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold")
        .text("PROJECT ESTIMATE PROPOSAL", doc.page.width - 240, 35, { align: "right" });

      doc.fillColor("#94a3b8").fontSize(9).font("Helvetica")
        .text(`Date: ${new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })}`, doc.page.width - 240, 52, { align: "right" });

      doc.moveDown(4);

      // --- CLIENT DETAILS & FOUNDER CONTACT ---
      const clientName = data.clientName || "Valued Client";
      const projectType = data.projectType || "Custom Software & Web Application";
      const priceRange = data.priceRange || "₹9,999 – ₹14,999";
      const timeline = data.timeline || "2–3 Weeks";

      doc.rect(40, 120, doc.page.width - 80, 70).fill(lightBg).stroke("#e2e8f0");

      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold")
        .text("PREPARED FOR:", 55, 132);
      doc.fillColor(textColor).fontSize(11).font("Helvetica")
        .text(clientName, 55, 148);

      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold")
        .text("AUTHORIZED REPRESENTATIVE:", doc.page.width - 280, 132);
      doc.fillColor(textColor).fontSize(10).font("Helvetica")
        .text("Shubham Vernekar (Founder)", doc.page.width - 280, 148)
        .text("+91 90288 33275 | shubdeeplabs@gmail.com", doc.page.width - 280, 162);

      // --- PROJECT SPECIFICATION ---
      let yPos = 210;
      doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold")
        .text("1. Project Overview & Scope", 40, yPos);

      yPos += 24;
      doc.fillColor(textColor).fontSize(10).font("Helvetica")
        .text(`Project Type: ${projectType}`, 40, yPos);

      yPos += 18;
      const features = data.features || [
        "Modern, Ultra-Responsive UI/UX Layout (Mobile & Desktop optimized)",
        "Secure Backend & Database Architecture",
        "Payment Gateway Integration (UPI, Razorpay, Cards)",
        "Admin Management Dashboard & Analytics",
        "100% Full Source Code Ownership with Zero Vendor Lock-in",
        "SEO Optimization & Social Sharing Metadata",
        "Production Deployment & 30-Day Post-Launch SLA Engineering Support",
      ];

      yPos += 10;
      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold")
        .text("Key Deliverables:", 40, yPos);

      yPos += 18;
      doc.fillColor(textColor).fontSize(10).font("Helvetica");
      features.forEach((feat) => {
        doc.text(`•  ${feat}`, 50, yPos);
        yPos += 16;
      });

      // --- ESTIMATED INVESTMENT TABLE ---
      yPos += 15;
      doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold")
        .text("2. Commercial Estimate & Timeline", 40, yPos);

      yPos += 22;
      doc.rect(40, yPos, doc.page.width - 80, 30).fill(primaryColor);
      doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold")
        .text("Item / Description", 55, yPos + 10)
        .text("Estimated Delivery", 320, yPos + 10)
        .text("Estimated Investment", 430, yPos + 10, { align: "right" });

      yPos += 30;
      doc.rect(40, yPos, doc.page.width - 80, 45).fill("#ffffff").stroke("#e2e8f0");
      doc.fillColor(textColor).fontSize(10).font("Helvetica")
        .text(projectType, 55, yPos + 12)
        .text("Full Implementation & Source Code", 55, yPos + 26)
        .text(timeline, 320, yPos + 18)
        .font("Helvetica-Bold").fillColor(accentColor)
        .text(priceRange, 430, yPos + 18, { align: "right" });

      // --- TERMS & DISCLAIMER ---
      yPos += 65;
      doc.rect(40, yPos, doc.page.width - 80, 60).fill(lightBg).stroke("#e2e8f0");
      doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold")
        .text("NOTICE & DISCLAIMER:", 55, yPos + 10);
      doc.fillColor("#64748b").fontSize(8.5).font("Helvetica")
        .text("• This document is an initial ballpark estimate. Final fixed pricing is subject to custom design specs and final scope agreement.", 55, yPos + 24)
        .text("• Milestone payment terms: 50% initial advance upon kickoff, 50% upon final delivery & code handover.", 55, yPos + 38);

      // --- FOOTER ---
      doc.rect(0, doc.page.height - 50, doc.page.width, 50).fill(primaryColor);
      doc.fillColor("#94a3b8").fontSize(9).font("Helvetica")
        .text("ShubDeep Labs • Solapur, Maharashtra, India • https://shubh-deep-labs.vercel.app", 40, doc.page.height - 32, { align: "center" });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateQuotationPDF };
