# 🖋️ Desk Duel — Pen Fighting Championship

> **Desk Duel** is an authentic physics-based pen fighting arcade game with online room multiplayer powered by **Supabase Realtime & PostgreSQL**, Google Authentication, 5-league single-player Career mode, Quick match against intelligent CPU bots, and multi-player pass-and-play Party mode. Built with **Next.js** for effortless 1-click deployment to **Vercel**.

![Desk Duel Banner](https://img.shields.io/badge/Desk%20Duel-v2.0-ffc23d?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=next.js)
![Vercel Ready](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel)
![Supabase Realtime](https://img.shields.io/badge/Multiplayer-Supabase%20Realtime-3ecf8e?style=for-the-badge&logo=supabase)

---

## 🌟 Highlights & Features

- 🔒 **Google Auth Landing Screen & Game Gate**:
  - Unauthenticated players land on a sleek Google Auth Page before entering.
  - Links display name and avatar directly to in-game identity and leaderboards.
  - **+500 Coins Starter Bonus** for new Google duelists.
- 🌐 **Online Multiplayer (Supabase Realtime)**:
  - Create or join private 5-letter rooms (`ABCDE`) across any phone, tablet, or desktop.
  - **Live Room Browser**: Browse active public lobbies and join with one click.
  - Sub-50ms latency peer synchronization over secure WebSockets (`broadcast` + `presence`).
  - Automatic disconnection detection and smart CPU substitution for dropouts.
- 🏆 **Global Leaderboard & Daily Streaks**:
  - Live top-duelist podium and rankings for *Trophies, Online Wins, Total Wins, and Coins*.
  - Daily login bonus streak (+150 to +500 coins).
- ⚡ **Career Mode, Quick Match & Party**:
  - 5 weight-class leagues: *Featherweight, Light, Middle, Heavy, and Titan*.
  - 20 unique rivals and boss fight against **The Chairman** in Titan Tower.
  - 1-on-1 matches against 4 tiers of CPU bots (*Easy, Medium, Hard, Expert*).
  - 2 to 3 players on a single shared device or screen.
- 🛒 **Pen & Desk Shop**:
  - Unlock and equip distinct pens ranging from 5g lightweight racers to 62g titan crushers.
  - Realistic mass, grip, inertia, and spin dynamics.
  - Desks: *Classroom Wood, Lab Glass, Cafeteria Formica, Boardroom Mahogany, and Titan Concrete*.

---

## 🚀 Deploy to Vercel

Deploying Desk Duel to Vercel takes less than a minute:

### Option 1: Automatic GitHub Import (Recommended)

1. Push your repository to GitHub:

   ```bash
   git push origin main
   ```

2. Go to [vercel.com/new](https://vercel.com/new) and select your `desk-duel-game` repository.
3. Vercel automatically detects **Next.js**.
4. *(Optional)* Add your Supabase environment variables in the **Environment Variables** section:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   *(If omitted, it automatically falls back to your configured Supabase project).*
5. Click **Deploy**. Vercel will build and launch your live URL!

### Option 2: Deploy with Vercel CLI

```bash
npx vercel
```

---

## 🛠️ Running Locally (Next.js)

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Start the local development server**:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Production Build Validation**:

   ```bash
   npm run build
   npm run start
   ```

---

## 🗄️ Database Setup (Supabase)

1. In the Supabase SQL Editor run `supabase/schema.sql` (tables, view, functions).
2. Then run the migrations in `supabase/migrations/`. They lock the tables down:
   players can only write their own profile, emails are no longer public, the daily bonus can only be
   claimed for yourself, only a room's host can change it, and stale lobbies are cleaned up every 5 minutes
   (needs the `pg_cron` extension).

Cloud save requires a real Google sign-in; offline profiles stay on the device.

## 📦 Project Structure

```text
Desk Duel/
├── app/
│   ├── layout.jsx            # Next.js App Router root layout (SEO metadata & fonts)
│   ├── page.jsx              # Main game page
│   ├── globals.css           # 3D game UI design system & responsive styling
│   └── api/
│       └── config/
│           └── route.js      # Dynamic Supabase config API route (reads env vars)
├── components/
│   ├── GameMarkup.jsx        # Complete game HUD, screens, modals & SVG icons
│   └── GameBoot.jsx          # Engine hydration & bootstrap loader
├── lib/
│   ├── supabase.js           # Supabase client singleton & auth detector
│   └── game/
│       ├── audio.js          # Synthesized WebAudio sound FX engine
│       ├── data.js           # Pen classes, arenas, leagues, daily quests & achievements
│       ├── engine.js         # Core game loop, UI state machine, multiplayer & cloud sync
│       ├── physics.js        # Deterministic 2D pen fighting physics & collision solver
│       └── utils.js          # Vector math, math helpers & formatters
├── public/                   # Static assets
├── supabase/
│   ├── schema.sql            # Base PostgreSQL schema, tables, views & functions
│   └── migrations/           # Hardened RLS security & trigger migration scripts
├── next.config.mjs           # Next.js optimization configuration
├── vercel.json               # Vercel deployment presets & security headers
├── .env.example              # Environment variables template
├── package.json              # Next.js dependencies & scripts
└── README.md                 # Project documentation
```

---

## 📄 License

MIT License. Designed & developed for the Pen Fighting Championship!
