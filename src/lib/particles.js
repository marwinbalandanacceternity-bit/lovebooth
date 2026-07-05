// Particle engine for "Fun" overlay filters. Renders animated glyphs on a
// preview canvas and can bake the current frame into a capture canvas.

const GLYPHS = {
  hearts: ['❤️', '\u{1F495}', '\u{1F49E}', '\u{1F497}'],
  sparkles: ['✨', '⭐', '\u{1F4AB}'],
  confetti: ['\u{1F389}', '\u{1F38A}', '●', '■'],
  bubbles: ['○', '◯', '〇'],
  stars: ['⭐', '\u{1F31F}', '✦'],
  snow: ['❄️', '❅', '❆'],
  butterflies: ['\u{1F98B}'],
  lovemail: ['\u{1F48C}', '❤️'],
}

const CONFETTI_COLORS = ['#e11d48', '#f97316', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa']

export class ParticleEngine {
  constructor(type) {
    this.type = type
    this.particles = []
    this.lastSpawn = 0
  }

  spawn(w, h) {
    const glyphs = GLYPHS[this.type] || GLYPHS.hearts
    const upward = ['hearts', 'bubbles', 'sparkles', 'butterflies', 'lovemail'].includes(this.type)
    this.particles.push({
      x: Math.random() * w,
      y: upward ? h + 30 : -30,
      vy: (upward ? -1 : 1) * (0.4 + Math.random() * 1.2),
      vx: (Math.random() - 0.5) * 0.8,
      size: 16 + Math.random() * 22,
      glyph: glyphs[Math.floor(Math.random() * glyphs.length)],
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.06,
      wobble: Math.random() * Math.PI * 2,
      alpha: 0.75 + Math.random() * 0.25,
    })
  }

  tick(w, h, now) {
    if (now - this.lastSpawn > 260 && this.particles.length < 26) {
      this.spawn(w, h)
      this.lastSpawn = now
    }
    for (const p of this.particles) {
      p.wobble += 0.04
      p.x += p.vx + Math.sin(p.wobble) * 0.6
      p.y += p.vy
      p.rot += p.vrot
    }
    this.particles = this.particles.filter((p) => p.y > -60 && p.y < h + 60)
  }

  // Draw current particles onto any canvas ctx, scaled from preview size to target size
  draw(ctx, w, h, srcW = w, srcH = h) {
    const sx = w / srcW
    const sy = h / srcH
    ctx.save()
    for (const p of this.particles) {
      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.translate(p.x * sx, p.y * sy)
      ctx.rotate(p.rot)
      ctx.font = `${p.size * sx}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (this.type === 'confetti' && (p.glyph === '●' || p.glyph === '■')) {
        ctx.fillStyle = p.color
      } else if (this.type === 'bubbles') {
        ctx.fillStyle = 'rgba(180, 220, 255, 0.9)'
      } else {
        ctx.fillStyle = '#fff'
      }
      ctx.fillText(p.glyph, 0, 0)
      ctx.restore()
    }
    ctx.restore()
  }
}
