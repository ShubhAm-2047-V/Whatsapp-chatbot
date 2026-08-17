# 🚀 Shubdeep Labs WhatsApp Bot — 24/7 Deployment Guide

## ⚠️ Important Note: Vercel vs Persistent Cloud Server

- **Why NOT Vercel?**
  Vercel is built for **serverless websites and APIs**. Serverless functions wake up on an HTTP request, run for 10-30 seconds, and immediately shut down.
  WhatsApp bots (via Baileys) require a **continuous, 24/7 background WebSocket connection** to WhatsApp's servers. On Vercel, the connection drops after a few seconds and incoming messages cannot be received.

- **Recommended 24/7 Platforms (Free / Low Cost):**
  1. **Render.com** (Recommended — free tier available, persistent disks)
  2. **Railway.app** (Easy GitHub deployment)
  3. **Fly.io / Koyeb** (Fast 24/7 container runners)
  4. **A cheap Linux VPS** (DigitalOcean / Hetzner / AWS EC2 at $3–$5/mo)

---

## 🛠️ Option 1: Deploy to Render.com (Recommended & Easiest)

1. **Push your code to GitHub**:
   - Create a private or public repository on GitHub.
   - Upload this folder (`shubdeep-wa-bot`).

2. **Create Web Service on Render**:
   - Go to [render.com](https://render.com) and sign up / log in.
   - Click **New +** → **Web Service**.
   - Connect your GitHub repository.

3. **Configure Settings**:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Environment Variables**:
     - `GEMINI_API_KEY` = your Gemini API key (`AQ.Ab8RN6Ku...`)
     - `GEMINI_MODEL` = `gemini-2.5-flash`
     - `PORT` = `3000`

4. **Add Persistent Disk (For WhatsApp Session)**:
   - In your Render service settings, go to **Disks** → **Add Disk**.
   - Mount Path: `/app/auth_session`
   - Size: `1 GB` (This preserves your WhatsApp login across server restarts).

5. **View QR Code & Connect**:
   - Once deployed, check the **Logs** tab on Render.
   - You will see the WhatsApp QR code in the build/runtime logs, or open the Render URL to see the Web Dashboard and scan the QR code!

---

## 🛠️ Option 2: Deploy to Railway.app

1. Go to [railway.app](https://railway.app).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Add Environment Variable: `GEMINI_API_KEY`.
4. Railway will automatically detect the `Dockerfile` or `package.json` and start the bot + dashboard.

---

## 🛠️ Option 3: Deploy to any Ubuntu/Linux VPS (PM2)

If you have a cloud server (AWS, DigitalOcean, Hetzner, etc.):

```bash
# 1. Clone your repo
git clone <your-repo-url>
cd <repo-folder>

# 2. Install dependencies & PM2
npm install
npm install -g pm2

# 3. Start bot in background 24/7
pm2 start index.js --name "shubdeep-wa-bot"

# 4. Make it auto-restart on system reboot
pm2 startup
pm2 save
```
