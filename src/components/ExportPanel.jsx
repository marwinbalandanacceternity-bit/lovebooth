import { useEffect, useState } from 'react'
import { LAYOUTS, BORDER_THEMES, composeLayout } from '../lib/layouts'
import { downloadComposedPng, downloadIndividuals, downloadPdf, downloadZip, downloadDataUrl } from '../lib/export'

export default function ExportPanel({ shots }) {
  const [layoutId, setLayoutId] = useState('strip4')
  const [themeId, setThemeId] = useState('white')
  const [rounded, setRounded] = useState(true)
  const [caption, setCaption] = useState('')
  const [dateStamp, setDateStamp] = useState(true)
  const [preview, setPreview] = useState(null)
  const [composedCanvas, setComposedCanvas] = useState(null)
  const [busy, setBusy] = useState(false)

  const layout = LAYOUTS.find((l) => l.id === layoutId)
  const usable = shots.slice(-layout.shots) // newest N shots
  const enough = usable.length >= layout.shots

  useEffect(() => {
    if (!enough) {
      setPreview(null)
      setComposedCanvas(null)
      return
    }
    let cancelled = false
    composeLayout({ layoutId, shots: usable, themeId, rounded, caption, dateStamp })
      .then((canvas) => {
        if (cancelled) return
        setComposedCanvas(canvas)
        setPreview(canvas.toDataURL('image/jpeg', 0.85))
      })
      .catch(console.error)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutId, themeId, rounded, caption, dateStamp, shots, enough])

  const run = async (fn) => {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {/* Layout choices */}
      <div>
        <h3 className="font-display font-medium mb-2">Layout</h3>
        <div className="grid grid-cols-2 gap-2">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLayoutId(l.id)}
              className={`cursor-pointer text-left px-3 py-2 rounded-xl border-2 transition-colors duration-200 ${
                layoutId === l.id ? 'border-primary bg-rose-50' : 'border-rose-200 hover:border-rose-300 bg-white'
              }`}
            >
              <span className="block font-display text-sm">{l.name}</span>
              <span className="block text-xs text-ink/60">{l.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Border theme */}
      <div>
        <h3 className="font-display font-medium mb-2">Border theme</h3>
        <div className="flex flex-wrap gap-2">
          {BORDER_THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setThemeId(t.id)}
              title={t.name}
              aria-label={`Border theme: ${t.name}`}
              className={`cursor-pointer w-9 h-9 rounded-full border-3 transition-transform duration-150 ${
                themeId === t.id ? 'border-primary scale-110' : 'border-rose-200'
              }`}
              style={{
                background: t.bg.startsWith('gradient:')
                  ? `linear-gradient(135deg, ${t.bg.replace('gradient:', '').split(',').join(', ')})`
                  : t.bg,
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={rounded} onChange={(e) => setRounded(e.target.checked)} className="accent-primary w-4 h-4" />
            Rounded corners
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={dateStamp} onChange={(e) => setDateStamp(e.target.checked)} className="accent-primary w-4 h-4" />
            Date stamp
          </label>
        </div>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption (e.g. 6,842 km apart ♥)"
          maxLength={40}
          aria-label="Strip caption"
          className="mt-3 w-full px-3 py-2 rounded-xl border-2 border-rose-200 focus:border-primary focus:outline-none text-sm bg-white text-ink"
        />
      </div>

      {/* Live preview */}
      <div>
        <h3 className="font-display font-medium mb-2">
          Preview {!enough && <span className="text-sm font-body text-ink/50">— take {layout.shots - usable.length} more photo{layout.shots - usable.length > 1 ? 's' : ''} for this layout</span>}
        </h3>
        {preview ? (
          <img src={preview} alt="Photostrip preview" className="max-h-80 mx-auto rounded-xl shadow-md" />
        ) : (
          <div className="h-40 rounded-xl bg-rose-50 border-2 border-dashed border-rose-200 flex items-center justify-center text-ink/40 text-sm">
            Your strip will appear here
          </div>
        )}
      </div>

      {/* Downloads */}
      <div className="grid grid-cols-2 gap-2">
        <button disabled={!composedCanvas || busy} onClick={() => run(() => downloadComposedPng(composedCanvas))} className="clay-btn py-2.5 bg-primary hover:bg-primary-dark text-white text-sm">
          Save Strip PNG
        </button>
        <button disabled={shots.length === 0 || busy} onClick={() => run(() => downloadIndividuals(shots))} className="clay-btn py-2.5 bg-secondary hover:bg-rose-500 text-white text-sm">
          Save 1×1 Photos
        </button>
        <button disabled={!composedCanvas || busy} onClick={() => run(() => downloadPdf(composedCanvas, shots))} className="clay-btn py-2.5 bg-cta hover:bg-orange-600 text-white text-sm">
          Export PDF
        </button>
        <button disabled={!composedCanvas || busy} onClick={() => run(() => downloadZip(composedCanvas, shots))} className="clay-btn py-2.5 bg-ink hover:bg-rose-900 text-white text-sm">
          Download ZIP
        </button>
      </div>

      {/* Canva hand-off */}
      <div className="rounded-2xl bg-violet-50 border-2 border-violet-200 p-4">
        <h3 className="font-display font-medium text-violet-900 mb-1">Customize in Canva</h3>
        <p className="text-xs text-violet-800/80 mb-3">
          Download your 1×1 photos above, then drop them into a Canva collage or photostrip template to keep editing.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="https://www.canva.com/create/photo-collages/" target="_blank" rel="noreferrer" className="clay-btn px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs inline-block">
            Photo Collage Templates
          </a>
          <a href="https://www.canva.com/templates/?query=photo-booth-strip" target="_blank" rel="noreferrer" className="clay-btn px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-xs inline-block">
            Photobooth Strip Templates
          </a>
        </div>
      </div>

      {/* Shot gallery */}
      {shots.length > 0 && (
        <div>
          <h3 className="font-display font-medium mb-2">Your shots ({shots.length})</h3>
          <div className="grid grid-cols-3 gap-2">
            {shots.map((s, i) => (
              <div key={s.id} className="relative group rounded-lg overflow-hidden">
                <div className="flex">
                  <img src={s.left} alt={`Shot ${i + 1} left`} className="w-1/2 aspect-square object-cover" />
                  <img src={s.right} alt={`Shot ${i + 1} right`} className="w-1/2 aspect-square object-cover" />
                </div>
                <button
                  onClick={() => {
                    downloadDataUrl(s.left, `photo${i + 1}-left.jpg`)
                    downloadDataUrl(s.right, `photo${i + 1}-right.jpg`)
                  }}
                  className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer text-white text-xs font-display"
                  aria-label={`Download shot ${i + 1}`}
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
