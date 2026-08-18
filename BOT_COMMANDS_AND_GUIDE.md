# 🤖 ShubDeep Labs — WhatsApp AI Bot Master Command & User Guide

This guide contains all the commands, triggers, and capabilities available in your WhatsApp AI Sales Agent.

---

## 👑 1. Admin Commands (For You / Owner)
You can type these commands directly in WhatsApp:

| Command | Action | Description |
| :--- | :--- | :--- |
| **`#stats`** or **`#leads`** | 📊 View Statistics | Sends an instant count of total active chats, business inquiries, and hot leads. |
| **`#pause`** | ⏸️ Pause AI Bot | Pauses the AI bot for that specific client chat so you can talk directly. |
| **`#resume`** | ▶️ Resume AI Bot | Re-activates the AI bot for that chat. |
| **`#help`** or **`#commands`** | 🛠️ Command Cheat Sheet | Displays this quick menu directly in your WhatsApp. |

---

## 💬 2. Customer Interactive Triggers & Features

Customers can naturally interact using text, voice notes, or photos. Here is what the bot supports:

### 1. 💰 Pricing & Quotations
* **What client says:** *"What is the cost?", "How much for a gold ecommerce shop?", "Tell me the quotation"*
* **Bot Behavior:** Gives a natural ballpark estimate (e.g. `₹9,999 – ₹14,999`), explains that custom features vary the price, and introduces Founder Shubham Vernekar (`+91 90288 33275`) for the final fixed quotation.

### 2. 📄 Instant PDF Proposal Generator
* **What client says:** *"Send me the proposal PDF", "Official quotation PDF", "Send document"*
* **Bot Behavior:** Generates a branded **ShubDeep Labs Project Proposal PDF** and sends the `.pdf` file in chat within 3 seconds.

### 3. 💳 UPI Payment QR Scanner
* **What client says:** *"How can I pay?", "Send UPI", "Send QR scanner", "Pay advance", "Google Pay / PhonePe"*
* **Bot Behavior:** Generates a dynamic **UPI QR Code** image with payee details (`Shubham Vernekar`, `+91 90288 33275`, `9028833275@ybl`) and sends it directly in the chat.

### 4. 🎙️ Voice Notes & Audio Messages
* **What client sends:** WhatsApp Audio / Voice Recording (in Marathi, Hindi, Hinglish, or English).
* **Bot Behavior:** Automatically downloads audio, transcribes it with Gemini Multimodal Audio, and replies with text/voice answers.

### 5. 🖼️ Screenshots & Wireframe Images
* **What client sends:** UI sketches, competitor website screenshots, or reference photos.
* **Bot Behavior:** Analyzes layout using Gemini Vision and explains how ShubDeep Labs can engineer and build that exact feature set.

### 6. 🚨 Urgent Callback & Hot Lead Alerts
* **What client says:** *"Call me quickly", "Tell Shubham to message me", "Need urgent discussion"*
* **Bot Behavior:** Instantly captures lead and sends a formatted alert to your WhatsApp (`+91 90288 33275`):
  * 👤 Client Name & Number
  * 💡 Project Requirement (e.g. Gold E-Commerce Website with Live Rates)
  * 📋 Full Chat Summary (3 bullet points)
  * 💬 Latest Message

### 7. 🌙 Night & After-Hours Flow (Outside 9 AM – 8 PM)
* **What client sends:** Messages at night.
* **Bot Behavior:** *"Our standard office hours are 9 AM – 8 PM, but I can connect you with Shubham right away if it's urgent! Would you prefer him to call you right now or tomorrow morning at 10 AM? 😊"*

### 8. 📰 8:00 PM Daily Executive Summary
* **Trigger:** Automatically at 8:00 PM IST every evening.
* **Bot Behavior:** Sends a daily digest of all active inquiries and hot leads directly to your WhatsApp.

### 9. 🧠 Custom Knowledge Addition
* **Location:** `data/knowledge/`
* **How to use:** Drop any `.txt` or `.md` file into `data/knowledge/`. The bot automatically re-trains on startup without touching code!

---

## 🚀 Quick Troubleshooting

* **How to start the bot:** Double-click `run.bat`
* **Session location:** `auth_session/`
* **Lead storage:** `leads.json`
* **Chat memory (1-3 months):** `data/chat_history.json`
