# Shubdeep Labs — WhatsApp AI FAQ Agent (100% Free)

This bot connects to WhatsApp using your own number (QR scan, like WhatsApp Web)
and answers customer questions using Google's Gemini API free tier — no card,
no Meta business approval needed.

**Stack:** Baileys (WhatsApp) + Gemini API free tier (AI).

---

## 1. Prerequisites

- **Node.js** (v18 or newer) — check with `node -v`. If missing, install from https://nodejs.org
- **A free Gemini API key:**
  1. Go to https://aistudio.google.com/apikey
  2. Sign in with any Google account
  3. Click "Create API key" — no credit card required
  4. Copy the key

## 2. Install dependencies

Open PowerShell/CMD in the `shubdeep-wa-bot` folder:

```
npm install
```

## 3. Add your Gemini API key

Open `config.js` and either:
- Paste your key directly in place of `PASTE_YOUR_FREE_API_KEY_HERE`, or
- (Safer) Set it as an environment variable instead, so it's never saved in the file:
  ```
  $env:GEMINI_API_KEY="your-key-here"
  ```
  (PowerShell — you'll need to set this each session, or add it to your
  Windows environment variables permanently via System Properties.)

**Note on free-tier limits:** Gemini's free tier has a daily request cap that
varies by model (currently generous for personal/small-business FAQ volume,
but not infinite). If you hit a rate limit, either wait for it to reset or
switch `GEMINI_MODEL` in `config.js` to a lighter model like
`gemini-2.5-flash-lite`, which has a higher free daily quota. Check current
limits at https://ai.google.dev/pricing since Google updates these periodically.

## 4. Fill in your business info

Open `business-info.js` and replace the placeholder text with real details
about Shubdeep Labs — services, pricing, contact info, FAQs. The bot **only**
answers using what's in this file, so the more complete it is, the better
it performs. No restart needed logic beyond re-running the bot after edits.

## 5. Run the bot

```
npm start
```

A QR code will appear in your terminal.

1. Open WhatsApp on the phone number you want the bot to use.
2. Go to **Settings → Linked Devices → Link a Device**.
3. Scan the QR code shown in the terminal.

Once connected you'll see:
```
✅ Connected to WhatsApp! Shubdeep Labs bot is live.
```

Your session is saved in the `auth_session` folder, so you won't need to
scan the QR again unless you log out or delete that folder.

## 6. Test it

Message the connected WhatsApp number from a different phone — you should
get an AI reply grounded in your `business-info.js` content within a couple
of seconds.

---

## Notes & honest trade-offs

- **This uses an unofficial method (Baileys).** WhatsApp doesn't officially
  support this, so there's a small risk of the number being temporarily
  restricted if it sends a very high volume of messages very fast. For a
  normal FAQ-volume use case this is generally fine, but **don't use your
  personal daily-driver number** — use a spare SIM/number if you have one.
- **Must stay running on your laptop.** Since it's not on cloud hosting,
  the bot only replies while `npm start` is active and your laptop is on
  with internet. Closing the terminal stops it.
- **Groups are ignored by default** (`IGNORE_GROUPS = true` in `index.js`).
  Change to `false` if you want it to also reply in group chats.
- **Conversation memory is per-session** — it resets if you restart the bot
  (kept simple on purpose; can be upgraded to persist to a file if useful).
- To stop the bot: `Ctrl + C` in the terminal.

## Next steps (optional upgrades, just ask if you want these built)

- Move `auth_session` and chat history to persist across restarts more robustly
- Add a simple logging file of all conversations
- Add "handoff to human" keyword (e.g. typing "agent" pings you directly)
- Move to free cloud hosting later so it runs 24/7 without your laptop
