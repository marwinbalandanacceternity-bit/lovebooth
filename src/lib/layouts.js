// Layout composer — draws captured photo pairs onto a canvas photostrip.
// Each "shot" is { left: dataUrl, right: dataUrl } (one photo per partner).

export const LAYOUTS = [
  { id: 'strip4', name: 'Classic Strip', shots: 4, desc: '4 photos, vertical strip' },
  { id: 'strip3', name: 'Mini Strip', shots: 3, desc: '3 photos, vertical strip' },
  { id: 'grid2x2', name: '2×2 Grid', shots: 4, desc: '4 photos in a square grid' },
  { id: 'single', name: 'Big Single', shots: 1, desc: 'One large side-by-side frame' },
  { id: 'polaroid', name: 'Polaroid', shots: 1, desc: 'Single shot, polaroid frame' },
]

export const BORDER_THEMES = [
  { id: 'white', name: 'Classic White', bg: '#ffffff', text: '#881337', accent: '#e11d48' },
  { id: 'black', name: 'Noir Black', bg: '#18181b', text: '#fafafa', accent: '#fb7185' },
  { id: 'pink', name: 'Pastel Pink', bg: '#ffe4e6', text: '#881337', accent: '#e11d48' },
  { id: 'rose-gradient', name: 'Rose Gradient', bg: 'gradient:#fda4af,#e11d48', text: '#ffffff', accent: '#ffffff' },
  { id: 'dark', name: 'Midnight', bg: '#1e1b4b', text: '#e0e7ff', accent: '#a5b4fc' },
  { id: 'minimal', name: 'Minimal Gray', bg: '#f4f4f5', text: '#3f3f46', accent: '#71717a' },
  { id: 'cream', name: 'Warm Cream', bg: '#fef3c7', text: '#78350f', accent: '#f97316' },
  { id: 'sage', name: 'Soft Sage', bg: '#ecfdf5', text: '#064e3b', accent: '#10b981' },
]

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function fillBg(ctx, w, h, bg) {
  if (bg.startsWith('gradient:')) {
    const [c1, c2] = bg.replace('gradient:', '').split(',')
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, c1)
    g.addColorStop(1, c2)
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = bg
  }
  ctx.fillRect(0, 0, w, h)
}

function roundedPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Draws one pair (left+right images side by side) into a target rect
async function drawPair(ctx, shot, x, y, w, h, rounded) {
  const half = w / 2
  const gap = 4
  const imgs = await Promise.all([loadImage(shot.left), loadImage(shot.right)])
  ctx.save()
  if (rounded) {
    roundedPath(ctx, x, y, w, h, 16)
    ctx.clip()
  }
  const targets = [
    { img: imgs[0], tx: x, tw: half - gap / 2 },
    { img: imgs[1], tx: x + half + gap / 2, tw: half - gap / 2 },
  ]
  for (const { img, tx, tw } of targets) {
    // cover-fit crop
    const scale = Math.max(tw / img.width, h / img.height)
    const sw = tw / scale
    const sh = h / scale
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, tx, y, tw, h)
  }
  ctx.restore()
}

function drawCaption(ctx, theme, caption, dateStamp, x, y, w, big = false) {
  ctx.fillStyle = theme.text
  ctx.textAlign = 'center'
  if (caption) {
    ctx.font = `600 ${big ? 44 : 28}px Fredoka, sans-serif`
    ctx.fillText(caption, x + w / 2, y)
  }
  if (dateStamp) {
    ctx.font = `${big ? 24 : 18}px Nunito, sans-serif`
    ctx.fillStyle = theme.accent
    ctx.fillText(
      new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
      x + w / 2,
      y + (caption ? (big ? 40 : 30) : 0)
    )
  }
}

/**
 * Compose a vertical strip of *however many* shots exist (1..N). Used for the
 * Memories fallback so a saved set always has a real strip image, even when
 * there aren't enough photos for the layout picked in the panel.
 */
export async function composeStrip(shots, { themeId, rounded, caption, dateStamp }) {
  const theme = BORDER_THEMES.find((t) => t.id === themeId) || BORDER_THEMES[0]
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const pairW = 800
  const pairH = 450
  const margin = 40
  const n = Math.max(1, shots.length)
  const footer = caption || dateStamp ? 90 : 40
  canvas.width = pairW + margin * 2
  canvas.height = margin + n * (pairH + margin) + footer
  fillBg(ctx, canvas.width, canvas.height, theme.bg)
  for (let i = 0; i < n; i++) {
    await drawPair(ctx, shots[i], margin, margin + i * (pairH + margin), pairW, pairH, rounded)
  }
  drawCaption(ctx, theme, caption, dateStamp, margin, canvas.height - footer + 34, pairW)
  return canvas
}

/**
 * Compose a layout. Returns a canvas.
 * options: { layoutId, shots, themeId, rounded, caption, dateStamp }
 */
export async function composeLayout({ layoutId, shots, themeId, rounded, caption, dateStamp }) {
  const theme = BORDER_THEMES.find((t) => t.id === themeId) || BORDER_THEMES[0]
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const pairW = 800
  const pairH = 450 // 16:9 pair (two ~8:9 halves)
  const margin = 40

  if (layoutId === 'strip4' || layoutId === 'strip3') {
    const n = layoutId === 'strip4' ? 4 : 3
    const footer = caption || dateStamp ? 90 : 40
    canvas.width = pairW + margin * 2
    canvas.height = margin + n * (pairH + margin) + footer
    fillBg(ctx, canvas.width, canvas.height, theme.bg)
    for (let i = 0; i < n; i++) {
      await drawPair(ctx, shots[i], margin, margin + i * (pairH + margin), pairW, pairH, rounded)
    }
    drawCaption(ctx, theme, caption, dateStamp, margin, canvas.height - footer + 34, pairW)
  } else if (layoutId === 'grid2x2') {
    const cellW = 640
    const cellH = 360
    const footer = caption || dateStamp ? 100 : 0
    canvas.width = cellW * 2 + margin * 3
    canvas.height = cellH * 2 + margin * 3 + footer
    fillBg(ctx, canvas.width, canvas.height, theme.bg)
    for (let i = 0; i < 4; i++) {
      const col = i % 2
      const row = Math.floor(i / 2)
      await drawPair(ctx, shots[i], margin + col * (cellW + margin), margin + row * (cellH + margin), cellW, cellH, rounded)
    }
    drawCaption(ctx, theme, caption, dateStamp, margin, canvas.height - footer + 44, canvas.width - margin * 2)
  } else if (layoutId === 'single') {
    const w = 1200
    const h = 675
    const footer = caption || dateStamp ? 110 : 0
    canvas.width = w + margin * 2
    canvas.height = h + margin * 2 + footer
    fillBg(ctx, canvas.width, canvas.height, theme.bg)
    await drawPair(ctx, shots[0], margin, margin, w, h, rounded)
    drawCaption(ctx, theme, caption, dateStamp, margin, canvas.height - footer + 50, w, true)
  } else if (layoutId === 'polaroid') {
    const w = 900
    const h = 560
    canvas.width = w + 70
    canvas.height = h + 35 + 190 // classic thick polaroid bottom
    fillBg(ctx, canvas.width, canvas.height, theme.bg)
    await drawPair(ctx, shots[0], 35, 35, w, h, rounded)
    drawCaption(ctx, theme, caption || 'us ♥', dateStamp, 35, h + 35 + 100, w, true)
  }

  return canvas
}
