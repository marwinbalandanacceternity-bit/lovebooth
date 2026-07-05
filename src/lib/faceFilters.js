// Face-tracked AR filters (dog ears, sunglasses, heart eyes, …) powered by
// MediaPipe FaceLandmarker. The model + wasm load lazily from Google's CDN
// the first time a face filter is picked, then everything runs on-device.
//
// FaceFilterEngine exposes the same tick()/draw() interface as
// ParticleEngine so VideoTile and the capture pipeline treat them the same.

let landmarkerPromise = null

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
      )
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
      })
    })()
    landmarkerPromise.catch(() => { landmarkerPromise = null }) // allow retry
  }
  return landmarkerPromise
}

// Landmark indices (MediaPipe face mesh)
const LM = {
  forehead: 10,
  chin: 152,
  faceLeft: 234,
  faceRight: 454,
  leftIris: 468,
  rightIris: 473,
  noseTip: 1,
  philtrum: 164,
  leftCheek: 50,
  rightCheek: 280,
}

export class FaceFilterEngine {
  constructor(type, getVideo) {
    this.type = type
    this.getVideo = getVideo
    this.landmarks = null
    this.mirrored = false
    this.lm = null
    this.lastTs = 0
    this.busy = false
    getLandmarker().then((lm) => { this.lm = lm }).catch(() => {})
  }

  // Called every animation frame by VideoTile. Runs detection ~15fps.
  tick(_w, _h, now) {
    const video = this.getVideo?.()
    if (!this.lm || this.busy || !video || video.readyState < 2 || !video.videoWidth) return
    if (now - this.lastTs < 66) return
    const ts = Math.max(performance.now(), this.lastTs + 1)
    this.lastTs = ts
    this.busy = true
    try {
      const res = this.lm.detectForVideo(video, ts)
      this.landmarks = res.faceLandmarks?.[0] || null
    } catch {
      this.landmarks = null
    }
    this.busy = false
  }

  /**
   * Preview call (3 args): canvas overlays the object-cover video element.
   * Capture call (5 args): canvas is the full video frame.
   * Mirroring is applied to x so accessories line up with the mirrored view.
   */
  draw(ctx, w, h, srcW) {
    if (!this.landmarks) return
    const video = this.getVideo?.()
    if (!video?.videoWidth) return

    let map
    if (srcW) {
      map = (i) => {
        const p = this.landmarks[i]
        let x = p.x * w
        if (this.mirrored) x = w - x
        return { x, y: p.y * h }
      }
    } else {
      const scale = Math.max(w / video.videoWidth, h / video.videoHeight)
      const dx = (w - video.videoWidth * scale) / 2
      const dy = (h - video.videoHeight * scale) / 2
      map = (i) => {
        const p = this.landmarks[i]
        let x = p.x * video.videoWidth * scale + dx
        if (this.mirrored) x = w - x
        return { x, y: p.y * video.videoHeight * scale + dy }
      }
    }

    const lEye = map(LM.leftIris)
    const rEye = map(LM.rightIris)
    const sideA = map(LM.faceLeft)
    const sideB = map(LM.faceRight)
    const fw = Math.hypot(sideB.x - sideA.x, sideB.y - sideA.y) // face width in px
    if (fw < 10) return
    const angle = Math.atan2(rEye.y - lEye.y, rEye.x - lEye.x)
    const dir = { x: Math.cos(angle), y: Math.sin(angle) } // along the eye line
    const up = { x: Math.sin(angle), y: -Math.cos(angle) } // toward top of head
    const forehead = map(LM.forehead)
    const headTop = { x: forehead.x + up.x * fw * 0.32, y: forehead.y + up.y * fw * 0.32 }
    const face = {
      fw, angle, dir, up, headTop,
      lEye, rEye,
      eyeMid: { x: (lEye.x + rEye.x) / 2, y: (lEye.y + rEye.y) / 2 },
      nose: map(LM.noseTip),
      philtrum: map(LM.philtrum),
      lCheek: map(LM.leftCheek),
      rCheek: map(LM.rightCheek),
    }
    DRAWERS[this.type]?.(ctx, face)
  }
}

// ---------- drawing helpers ----------

function at(ctx, x, y, angle, fn) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  fn()
  ctx.restore()
}

function glyph(ctx, g, size) {
  ctx.font = `${size}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(g, 0, 0)
}

function ellipse(ctx, rx, ry, fill, ox = 0, oy = 0) {
  ctx.beginPath()
  ctx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
}

function triangle(ctx, w, h, fill) {
  ctx.beginPath()
  ctx.moveTo(-w / 2, 0)
  ctx.lineTo(w / 2, 0)
  ctx.lineTo(0, -h)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

// Each drawer gets (ctx, face) with all key points in canvas px
const DRAWERS = {
  dog(ctx, f) {
    for (const s of [-1, 1]) {
      const x = f.headTop.x + f.dir.x * f.fw * 0.38 * s
      const y = f.headTop.y + f.dir.y * f.fw * 0.38 * s
      at(ctx, x, y, f.angle + s * 0.5, () => {
        ellipse(ctx, f.fw * 0.14, f.fw * 0.22, '#7c4a21')
        ellipse(ctx, f.fw * 0.08, f.fw * 0.14, '#b5854f', 0, f.fw * 0.03)
      })
    }
    at(ctx, f.nose.x, f.nose.y, f.angle, () => {
      ellipse(ctx, f.fw * 0.11, f.fw * 0.08, '#1c1917')
      ellipse(ctx, f.fw * 0.03, f.fw * 0.02, 'rgba(255,255,255,0.7)', -f.fw * 0.03, -f.fw * 0.02)
    })
  },

  cat(ctx, f) {
    for (const s of [-1, 1]) {
      const x = f.headTop.x + f.dir.x * f.fw * 0.34 * s
      const y = f.headTop.y + f.dir.y * f.fw * 0.34 * s
      at(ctx, x, y, f.angle + s * 0.25, () => {
        triangle(ctx, f.fw * 0.3, f.fw * 0.32, '#44403c')
        triangle(ctx, f.fw * 0.16, f.fw * 0.2, '#f9a8d4')
      })
    }
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = Math.max(1.5, f.fw * 0.012)
    for (const [cheek, s] of [[f.lCheek, -1], [f.rCheek, 1]]) {
      for (const spread of [-0.12, 0, 0.12]) {
        ctx.beginPath()
        ctx.moveTo(cheek.x, cheek.y)
        ctx.lineTo(
          cheek.x + (f.dir.x * s + f.up.x * spread) * f.fw * 0.42,
          cheek.y + (f.dir.y * s + f.up.y * spread) * f.fw * 0.42
        )
        ctx.stroke()
      }
    }
    ctx.restore()
    at(ctx, f.nose.x, f.nose.y, f.angle + Math.PI, () => triangle(ctx, f.fw * 0.12, f.fw * 0.09, '#f472b6'))
  },

  bunny(ctx, f) {
    for (const s of [-1, 1]) {
      const x = f.headTop.x + f.dir.x * f.fw * 0.2 * s
      const y = f.headTop.y + f.dir.y * f.fw * 0.2 * s
      at(ctx, x, y, f.angle + s * 0.12, () => {
        ellipse(ctx, f.fw * 0.11, f.fw * 0.42, '#fafafa', 0, -f.fw * 0.3)
        ellipse(ctx, f.fw * 0.055, f.fw * 0.3, '#fbcfe8', 0, -f.fw * 0.3)
      })
    }
  },

  sunglasses(ctx, f) {
    const lw = f.fw * 0.36
    const lh = f.fw * 0.26
    ctx.save()
    ctx.fillStyle = 'rgba(12,12,14,0.88)'
    for (const eye of [f.lEye, f.rEye]) {
      at(ctx, eye.x, eye.y, f.angle, () => {
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(-lw / 2, -lh / 2, lw, lh, f.fw * 0.07)
        else ctx.rect(-lw / 2, -lh / 2, lw, lh)
        ctx.fill()
      })
    }
    ctx.strokeStyle = 'rgba(12,12,14,0.88)'
    ctx.lineWidth = f.fw * 0.035
    ctx.beginPath()
    ctx.moveTo(f.lEye.x + f.dir.x * lw * 0.5, f.lEye.y + f.dir.y * lw * 0.5)
    ctx.lineTo(f.rEye.x - f.dir.x * lw * 0.5, f.rEye.y - f.dir.y * lw * 0.5)
    ctx.stroke()
    ctx.restore()
  },

  hearteyes(ctx, f) {
    for (const eye of [f.lEye, f.rEye]) {
      at(ctx, eye.x, eye.y, f.angle, () => glyph(ctx, '❤️', f.fw * 0.34))
    }
  },

  flowercrown(ctx, f) {
    const flowers = ['🌸', '🌼', '🌺', '🌼', '🌸']
    flowers.forEach((g, i) => {
      const t = (i / (flowers.length - 1)) * 2 - 1 // -1 … 1
      const lift = (1 - t * t) * 0.1 // arc: middle sits higher
      const x = f.headTop.x + f.dir.x * f.fw * 0.44 * t + f.up.x * f.fw * lift
      const y = f.headTop.y + f.dir.y * f.fw * 0.44 * t + f.up.y * f.fw * lift
      at(ctx, x, y, f.angle, () => glyph(ctx, g, f.fw * 0.2))
    })
  },

  crown(ctx, f) {
    const x = f.headTop.x + f.up.x * f.fw * 0.12
    const y = f.headTop.y + f.up.y * f.fw * 0.12
    at(ctx, x, y, f.angle, () => glyph(ctx, '👑', f.fw * 0.6))
  },

  mustache(ctx, f) {
    at(ctx, f.philtrum.x, f.philtrum.y, f.angle, () => {
      ctx.fillStyle = '#2f2015'
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.quadraticCurveTo(s * f.fw * 0.12, -f.fw * 0.06, s * f.fw * 0.24, -f.fw * 0.02)
        ctx.quadraticCurveTo(s * f.fw * 0.16, f.fw * 0.08, 0, f.fw * 0.03)
        ctx.closePath()
        ctx.fill()
      }
    })
  },
}

export const FACE_FILTER_TYPES = Object.keys(DRAWERS)
