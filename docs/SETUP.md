# DELO — Local Development & Setup Guide

This guide provides step-by-step instructions for running the complete Delo stack locally.

---

## 1. Prerequisites

- **Node.js**: v20.x or higher (v24 recommended)
- **npm**: v10.x or higher
- **Git**: Installed and configured
- **Supabase Account**: (Free tier at [supabase.com](https://supabase.com))
- **Telegram Bot Token**: (Obtained from `@BotFather`)
- **OpenAI API Key**: (Obtained from [platform.openai.com](https://platform.openai.com))

---

## 2. Installation Steps

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/NikitaDmitrenco/delo.git
   cd delo
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Fill in the required values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `TELEGRAM_BOT_TOKEN`

---

## 3. Running the Project

### Running the Web Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running the Telegram Bot Locally (Long Polling Mode)
During local development, you can run the bot without configuring webhooks:
```bash
npm run bot:dev
```

### Running Tests
```bash
npm run test
```

### Building for Production
```bash
npm run build
npm run start
```

---

## 4. Production Deployment (Vercel + Supabase)

### Step 1: Deploy Web App to Vercel
1. Push repository to GitHub: `https://github.com/NikitaDmitrenco/delo`
2. Import repository in [Vercel Dashboard](https://vercel.com/new).
3. Set environment variables in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET`
   - `NEXT_PUBLIC_APP_URL` (e.g. `https://your-delo-domain.vercel.app`)
4. Deploy.

### Step 2: Apply Database Schema to Production Supabase
In your Supabase project dashboard -> SQL Editor, run the contents of:
`supabase/migrations/001_initial_schema.sql`

### Step 3: Configure Telegram Webhook
To point Telegram Bot API updates to your deployed Next.js endpoint:
```bash
curl -F "url=https://your-delo-domain.vercel.app/api/telegram/webhook" \
     -F "secret_token=your_telegram_webhook_secret" \
     https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook
```
