# Desk Duel — Next.js

The pen fighting championship: flick your pen, knock rivals off the desk, earn coins and unlock heavier pens. Career, Quick Match, Party (2–3 players on one device) and Online (2–3 players on their own devices).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

## Build and host

```bash
npm run build      # writes a static website to ./out
npm start          # preview ./out locally
```

`./out` is plain HTML/JS/CSS, so it can be hosted anywhere: Vercel, Netlify, GitHub Pages or itch.io (zip the `out` folder). Once it is online, the Share button in an online room gives friends a link (`?room=CODE`) that opens straight into the room.

## Project layout

| Path | What it is |
| --- | --- |
| `app/layout.js` | Fonts (Rubik via `next/font`), page metadata, mobile viewport |
| `app/page.js` | The single game page |
| `app/globals.css` | Design system and all screen styles |
| `components/GameMarkup.jsx` | Static screens, HUD and icon sprite |
| `components/GameBoot.jsx` | Client component that starts the engine after hydration |
| `lib/game/utils.js` | Math, colour and string helpers |
| `lib/game/data.js` | Weight classes, pens, desks, career leagues, trophies |
| `lib/game/physics.js` | Rigid-body pen physics (real mm/g units) and the CPU planner |
| `lib/game/engine.js` | Save data, audio, renderer, match rules, online play (PeerJS) and UI |

Progress is saved in the browser's localStorage. Online play uses peer-to-peer WebRTC through the free PeerJS service, loaded only when a player opens Online.
