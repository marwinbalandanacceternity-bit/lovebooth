# LoveBooth 💕

A real-time photobooth for long-distance couples. One partner creates a room, sends the link, and you take synced photos together — with filters, photostrip layouts, and PDF/ZIP export.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 — create a room, then open the invite link in a second browser/device to be the partner.

- Vite dev server: port 5173
- Socket.io + signaling server: port 3001 (proxied through Vite)

## Production

```bash
npm run build
npm start        # Express serves dist/ and Socket.io on port 3001 (set LOVEBOOTH_PORT to change)
```

**Important:** browsers only allow camera access on `localhost` or **HTTPS**. To use it with your partner for real (phone-to-phone, phone-to-PC, any combo), either:

1. **Deploy it** (recommended — permanent link):

   [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/marwinbalandanacceternity-bit/lovebooth)

   Sign in with GitHub, click Apply, and Render builds it from `render.yaml` on the free plan. You get a permanent `https://lovebooth-xxxx.onrender.com` link. (Free instances sleep after idle — first visit may take ~50s to wake.)

2. **Instant link, no account** — run `Start Online.bat` (or the "LoveBooth Online" desktop shortcut). It builds the app, serves it locally, and opens a Cloudflare quick tunnel. Share the printed `https://….trycloudflare.com` link with your partner. Works on any device; the link lasts as long as the window stays open.

If your partner's video won't connect on strict mobile/corporate networks, you may need a TURN server (e.g. free tier of metered.ca) added to the `ICE` config in `src/pages/Room.jsx`.

## Features

- **Rooms for two** — create, share link, join; third person is politely rejected
- **Synced capture** — both press Ready → shared 8-second countdown with beeps → flash → both frames captured simultaneously
- **Solo mode** — take test shots while waiting for your partner
- **40 filters** in 4 categories (Natural / Aesthetic / B&W-Vintage / Fun), with live thumbnails; Fun filters add animated particle overlays (hearts, sparkles, confetti…) that get baked into the photo
- **Sides** — clear LEFT/RIGHT badges, and a "request side switch" your partner must accept
- **Mirror toggle** for that natural selfie feel
- **Layouts** — classic 4-strip, mini 3-strip, 2×2 grid, big single, polaroid; 8 border themes, rounded corners, caption + date stamp
- **Export** — strip PNG, individual 1×1 photos, multi-page PDF, everything as ZIP
- **Canva hand-off** — buttons that open Canva collage/photostrip templates for further editing
- **Chat sidebar** with unread badge, plus live filter preview sync (you see which filter your partner picked)

## Tech

React 18 + Vite + Tailwind v4 · Socket.io (rooms, signaling, chat) · WebRTC (peer-to-peer video) · Canvas (filters, particles, layout composer) · jsPDF + JSZip (export)
