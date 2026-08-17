require("dotenv").config();

module.exports = {
  GEMINI_API_KEY: (process.env.GEMINI_API_KEY || "").trim(),
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3.6-flash",
};