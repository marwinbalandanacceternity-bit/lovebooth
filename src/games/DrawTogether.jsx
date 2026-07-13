import { useEffect, useRef, useState } from 'react'
import { useCoupleMessage } from '../context/CoupleContext'

const W = 640
const H = 440
const COLORS = ['#e11d48', '#f97316', '#eab308', '#10b981', '#3b82f6', '#8b5cf6', '#111827', '#ffffff']

// A single shared canvas. Each stroke segment is sent to the partner in
// normalized (0..1) coordinates so it lands in the same spot on any screen.
export default function DrawTogether() {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)
  const [color, setColor] = useState('#e11d48')
  const [width, setWidth] = useState(4)

  const drawSeg = (x0, y0, x1, y1, c, w) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = c
    ctx.lineWidth = w
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(x0 * W, y0 * H)
    ctx.lineTo(x1 * W, y1 * H)
    ctx.stroke()
  }

  const sendDraw = useCoupleMessage('draw', (seg) => drawSeg(seg.x0, seg.y0, seg.x1, seg.y1, seg.c, seg.w))
  const sendClear = useCoupleMessage('draw-clear', () => clearLocal())

  const clearLocal = () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, W, H)
  }

  useEffect(() => { clearLocal() }, [])

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const p = e.touches ? e.touches[0] : e
    return { x: (p.clientX - rect.left) / rect.width, y: (p.clientY - rect.top) / rect.height }
  }

  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = pos(e) }
  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const p = pos(e)
    const l = last.current
    drawSeg(l.x, l.y, p.x, p.y, color, width)
    sendDraw({ x0: l.x, y0: l.y, x1: p.x, y1: p.y, c: color, w: width })
    last.current = p
  }
  const end = () => { drawing.current = false; last.current = null }

  const clearAll = () => { clearLocal(); sendClear() }

  return (
    <div className="clay p-4 rise-in">
      <h2 className="font-display text-xl text-primary mb-3 text-center">Draw Together 🎨</h2>
      <div className="rounded-2xl overflow-hidden border-2 border-rose-200 bg-white">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full touch-none block bg-white cursor-crosshair"
          style={{ aspectRatio: `${W} / ${H}` }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={`Color ${c}`}
              className={`w-7 h-7 rounded-full border-2 transition-transform duration-150 ${color === c ? 'border-primary scale-110' : 'border-rose-200'}`}
              style={{ background: c }} />
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-ink/60 ml-1">
          Size
          <input type="range" min="2" max="16" value={width} onChange={(e) => setWidth(+e.target.value)} className="accent-primary" />
        </label>
        <button onClick={clearAll} className="clay-btn ml-auto px-4 py-2 bg-rose-100 hover:bg-rose-200 text-ink text-sm">Clear</button>
      </div>
      <p className="text-[11px] text-ink/45 text-center mt-2">You both draw on the same canvas in real time.</p>
    </div>
  )
}
