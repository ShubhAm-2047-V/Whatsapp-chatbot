const QRCode = require("qrcode");

/**
 * Generates a high-resolution UPI QR Code buffer
 * @param {Object} options
 * @param {string} options.vpa - Virtual Payment Address (UPI ID)
 * @param {string} options.name - Payee Name
 * @param {number} [options.amount] - Optional preset amount
 */
async function generatePaymentQR(options = {}) {
  const vpa = options.vpa || "9028833275@ybl";
  const name = options.name || "Shubham Vernekar";
  const note = options.note || "ShubDeep Labs Project Advance";
  const amount = options.amount ? `&am=${options.amount}` : "";

  const upiUrl = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&tn=${encodeURIComponent(note)}${amount}&cu=INR`;

  return await QRCode.toBuffer(upiUrl, {
    errorCorrectionLevel: "H",
    type: "png",
    margin: 2,
    scale: 8,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });
}

module.exports = { generatePaymentQR };
