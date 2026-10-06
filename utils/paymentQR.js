const QRCode = require("qrcode");

// In-memory LRU / Map cache for generated payment QR code buffers
const qrBufferCache = new Map();
const MAX_QR_CACHE_SIZE = 50;

/**
 * Generates a high-resolution UPI QR Code buffer with high-performance in-memory caching
 * @param {Object} options
 * @param {string} options.vpa - Virtual Payment Address (UPI ID)
 * @param {string} options.name - Payee Name
 * @param {number} [options.amount] - Optional preset amount
 * @param {string} [options.note] - Optional transaction note
 */
async function generatePaymentQR(options = {}) {
  const vpa = options.vpa || "9028833275@ybl";
  const name = options.name || "Shubham Vernekar";
  const note = options.note || "ShubDeep Labs Project Advance";
  const amount = options.amount ? `&am=${options.amount}` : "";

  const cacheKey = `${vpa}|${name}|${note}|${options.amount || "none"}`;
  if (qrBufferCache.has(cacheKey)) {
    return qrBufferCache.get(cacheKey);
  }

  const upiUrl = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&tn=${encodeURIComponent(note)}${amount}&cu=INR`;

  const buffer = await QRCode.toBuffer(upiUrl, {
    errorCorrectionLevel: "H",
    type: "png",
    margin: 2,
    scale: 8,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  if (qrBufferCache.size >= MAX_QR_CACHE_SIZE) {
    const oldestKey = qrBufferCache.keys().next().value;
    qrBufferCache.delete(oldestKey);
  }
  qrBufferCache.set(cacheKey, buffer);

  return buffer;
}

module.exports = { generatePaymentQR };
