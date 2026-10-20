# 🖋️ Desk Duel — Pen Fighting Championship

> **Desk Duel** is an authentic physics-based pen fighting arcade game with online room multiplayer powered by **Supabase Realtime & PostgreSQL**, 5-league single-player Career mode, Quick match against intelligent CPU bots, and multi-player pass-and-play Party mode.

![Desk Duel Banner](https://img.shields.io/badge/Desk%20Duel-v2.0-ffc23d?style=for-the-badge)
![Supabase Realtime](https://img.shields.io/badge/Multiplayer-Supabase%20Realtime-3ecf8e?style=for-the-badge&logo=supabase)
![Pure Web Tech](https://img.shields.io/badge/Stack-HTML5%20%7C%20Canvas%20%7C%20JS-38bdf8?style=for-the-badge)

---

## 🌟 Highlights & Features

- 🌐 **Online Multiplayer (Supabase Realtime)**:
  - Create or join private 5-letter rooms (`ABCDE`) across any device or browser.
  - **Live Room Browser**: Browse active public lobbies and join with one click.
  - Sub-50ms latency peer synchronization over secure WebSockets (`broadcast` + `presence`).
  - Automatic disconnection detection and smart CPU substitution for dropouts.
- 🏆 **Career Mode**:
  - Climb through 5 weight-class leagues: *Featherweight, Light, Middle, Heavy, and Titan*.
  - Defeat 20 unique rivals and dethrone **The Chairman** in Titan Tower.
- ⚡ **Quick Match & Pass-and-Play Party**:
  - 1-on-1 matches against 4 tiers of CPU bots (*Easy, Medium, Hard, Expert*).
  - 2 to 3 players on a single shared device or screen.
- 🛒 **Pen & Desk Shop**:
  - Unlock and equip distinct pens ranging from 5g lightweight racers to 62g titan crushers.
  - Realistic mass, grip, inertia, and spin dynamics.
  - Unlockable desks: *Classroom Wood, Lab Glass, Cafeteria Formica, Boardroom Mahogany, and Titan Concrete*.
- ☁️ **Cloud Save & Global Leaderboard**:
  - Player level, XP, coins, unlocks, and match statistics sync to Supabase database.
  - In-game global rankings view.

---

## 🎮 How to Play

1. **Aim & Power**: Press on your pen and pull back like a slingshot. Drag further for more power.
2. **Add Spin**: Grab near the tip or tail of your pen to impart spin. Spinning pens curve across the table and sweep opponents off edges.
3. **Knockout**: A pen falls off when its center of mass leaves the desk perimeter. Last pen standing wins the round!
4. **Trick Shots**: Earn bonus coins for *Double KO*, *Bank Shots*, *Spin KO*, *Sniper KO*, and *Close Calls*.

---

## 🚀 Supabase Backend Setup

1. **Create Tables & Realtime**:
   - Open your [Supabase Dashboard](https://supabase.com/dashboard) and go to the **SQL Editor**.
   - Run the script located in [`supabase-schema.sql`](./supabase-schema.sql).
   - This creates:
     - `deskduel_profiles`: Cloud saves for player level, coins, and unlocks.
     - `deskduel_rooms`: Live lobby registry for multiplayer.
     - `deskduel_matches`: Match logs and champion records.
     - `deskduel_leaderboard`: Global leaderboard view.
     - Enables Realtime publication on `deskduel_rooms`.

2. **Configure Credentials**:
   - Copy your **Project URL** and **Anon Key** from *Project Settings &rarr; API*.
   - Either enter them into [`supabase-config.js`](./supabase-config.js) or paste your Anon Key into the in-game **Online &rarr; Connect** setup dialog.

---

## 📦 Project Structure

```text
Desk Duel/
├── desk-duel.html         # Complete single-file game client (UI, Canvas, Physics, AI, Supabase Realtime)
├── supabase-config.js     # Supabase client configuration
├── supabase-schema.sql    # PostgreSQL schema, RLS policies & Realtime setup
└── README.md              # Project documentation
```

---

## 🛠️ Running Locally

Simply open `desk-duel.html` in any modern web browser, or serve it using any static HTTP server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js
npx serve .
```

Open `http://localhost:8080/desk-duel.html` in your browser.

---

## 📄 License

MIT License. Designed & developed for the Pen Fighting Championship!
