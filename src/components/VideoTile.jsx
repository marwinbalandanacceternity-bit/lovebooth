import { useEffect, useRef } from 'react'

// One camera feed tile. Applies the CSS filter live, runs the particle
// overlay animation for "Fun" filters, and shows side / ready badges.
export default function VideoTile({
  videoRef,
  label,
  side,
  ready,
  mirrored,
  filterCss,
  overlayEngine,
  connected,
  isSelf,
}) {
  const overlayCanvasRef = useRef(null)

  useEffect(() => {
    if (!overlayEngine) return
    let raf
    const loop = (now) => {
      const canvas = overlayCanvasRef.current
      if (canvas) {
        const rect = canvas.parentElement.getBoundingClientRect()
        if (canvas.width !== Math.round(rect.width)) {
          canvas.width = Math.round(rect.width)
          canvas.height = Math.round(rect.height)
        }
        // remember preview size so captures can scale particles correctly
        overlayEngine.previewW = canvas.width
        overlayEngine.previewH = canvas.height
        overlayEngine.tick(canvas.width, canvas.height, now)
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        overlayEngine.draw(ctx, canvas.width, canvas.height)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [overlayEngine])

  return (
    <div className="relative flex-1 min-w-0 rounded-3xl overflow-hidden bg-rose-950 aspect-video shadow-lg shadow-rose-200">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{
          filter: filterCss !== 'none' ? filterCss : undefined,
          transform: mirrored ? 'scaleX(-1)' : undefined,
        }}
      />
      {overlayEngine && (
        <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      )}

      {!connected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-rose-100 bg-rose-950/90">
          <svg className="w-12 h-12 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path strokeLinecap="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" />
          </svg>
          <p className="font-display">{isSelf ? 'Starting camera…' : 'Waiting for your partner…'}</p>
        </div>
      )}

      {/* Side + name badge */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <span className="px-3 py-1 rounded-full text-sm font-display font-medium bg-black/50 text-white backdrop-blur">
          {label}
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-display uppercase tracking-wide bg-primary/90 text-white">
          {side}
        </span>
      </div>

      {ready && (
        <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-display bg-emerald-500 text-white shadow">
          Ready ✓
        </span>
      )}
    </div>
  )
}
