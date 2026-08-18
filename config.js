require("dotenv").config();

const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
const parsedKeys = rawKeys
  .split(",")
  .map((k) => k.trim())
  .filter((k) => k && !k.startsWith("PASTE_"));

module.exports = {
  GEMINI_API_KEY: parsedKeys[0] || "",
  GEMINI_API_KEYS: parsedKeys,
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3.5-flash",
};