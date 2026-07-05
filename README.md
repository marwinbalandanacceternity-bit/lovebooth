# LoveBooth 💕

A real-time photobooth for long-distance couples. One partner creates a room, sends the link, and you take synced photos together — with filters, photostrip layouts, and PDF/ZIP export.

**Live app: https://lovebooth-app.vercel.app** — works on phones and PCs, any combination.

## How it works

Fully serverless: the app is a static site, and rooms connect **peer-to-peer** over WebRTC. [PeerJS's](https://peerjs.com) free cloud broker handles the introduction — whoever claims the room ID first becomes the host; the partner joins as a guest. Video, photos, chat, and all room events travel directly between the two browsers over the data channel. A free TURN relay keeps it working on strict mobile networks.

## Features

- **Rooms for two** — create, share link, join; a third person is politely rejected
- **Synced capture** — both press Ready → shared 8-second countdown with beeps → flash → both frames captured simultaneously
- **Solo mode** — take test shots while waiting for your partner
- **40 filters** in 4 categories (Natural / Aesthetic / B&W-Vintage / Fun) with live thumbnails; Fun filters add animated particle overlays (hearts, sparkles, confetti…) baked into the photo
- **Sides** — clear LEFT/RIGHT badges, and a "request side switch" your partner must accept
- **Mirror toggle**, front camera on phones, stacked layout on small screens
- **Layouts** — classic 4-strip, mini 3-strip, 2×2 grid, big single, polaroid; 8 border themes, rounded corners, caption + date stamp
- **Export** — strip PNG, individual 1×1 photos, multi-page PDF, everything as ZIP
- **Canva hand-off** — buttons that open Canva collage/photostrip templates for further editing
- **Chat sidebar** with unread badge, plus live filter sync (you see which filter your partner picked)

## Development

```bash
npm install
npm run dev     # Vite on http://localhost:5173
```

`Start.bat` does the same with a double-click and opens the browser.

## Deploying

```bash
vercel deploy --prod --yes
vercel alias set <deployment-url> lovebooth-app.vercel.app
```

The second command repoints the friendly domain at the new deployment.

## Tech

React 18 + Vite + Tailwind v4 · PeerJS / WebRTC (video + data channels, no backend) · Canvas (filters, particles, layout composer) · jsPDF + JSZip (export)
