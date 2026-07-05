import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listSessions, deleteSession } from '../lib/history'
import { downloadDataUrl } from '../lib/export'

export default function Memories() {
  const [sessions, setSessions] = useState(null) // null = loading
  const [viewing, setViewing] = useState(null)

  const refresh = () => listSessions().then(setSessions).catch(() => setSessions([]))
  useEffect(() => { refresh() }, [])

  const remove = async (id) => {
    await deleteSession(id)
    setViewing(null)
    refresh()
  }

  const fmtDate = (ts) =>
    new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <header className="flex flex-wrap items-center gap-3 mb-6 max-w-5xl mx-auto">
        <Link to="/" className="font-display text-2xl font-semibold text-primary">LoveBooth</Link>
        <h1 className="text-xl text-ink">Memories</h1>
        <span className="text-xs text-ink/50">saved on this device</span>
        <Link to="/" className="ml-auto clay-btn px-4 py-1.5 bg-primary hover:bg-primary-dark text-white text-sm">
          New room
        </Link>
      </header>

      <main className="max-w-5xl mx-auto">
        {sessions === null && (
          <p className="text-center text-ink/50 mt-16">Loading your memories…</p>
        )}

        {sessions?.length === 0 && (
          <div className="clay p-10 text-center max-w-md mx-auto mt-10">
            <p className="text-4xl mb-3">📸</p>
            <h2 className="font-display text-xl text-primary mb-2">No memories yet</h2>
            <p className="text-ink/60 mb-5 text-sm">
              Take some photos together, then hit "Save to Memories" or "Start New Set" in the booth — your strips will show up here.
            </p>
            <Link to="/" className="clay-btn inline-block px-6 py-3 bg-primary hover:bg-primary-dark text-white">
              Open the booth
            </Link>
          </div>
        )}

        {sessions?.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setViewing(s)}
                className="clay overflow-hidden cursor-pointer text-left hover:-translate-y-0.5 transition-transform duration-200"
              >
                {s.stripPng ? (
                  <img src={s.stripPng} alt={`Photostrip from ${fmtDate(s.date)}`} className="w-full aspect-[3/4] object-cover object-top bg-rose-100" />
                ) : (
                  <div className="w-full aspect-[3/4] bg-rose-100 grid grid-cols-2 gap-0.5 p-0.5">
                    {s.shots.slice(0, 2).map((shot, i) => (
                      <img key={i} src={shot.left} alt="" className="w-full h-full object-cover" />
                    ))}
                  </div>
                )}
                <div className="p-2.5">
                  <p className="text-xs font-display text-ink truncate">{fmtDate(s.date)}</p>
                  <p className="text-[11px] text-ink/50">{s.shots.length} photo{s.shots.length !== 1 ? 's' : ''} · room {s.roomId}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Full-size viewer */}
      {viewing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-3xl p-4 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-display text-primary flex-1 truncate">{fmtDate(viewing.date)}</h2>
              <button onClick={() => setViewing(null)} className="w-8 h-8 rounded-full bg-rose-100 hover:bg-rose-200 text-ink cursor-pointer transition-colors duration-200" aria-label="Close">✕</button>
            </div>
            {viewing.stripPng && (
              <img src={viewing.stripPng} alt="Photostrip" className="w-full rounded-xl mb-3" />
            )}
            {viewing.shots.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {viewing.shots.map((shot, i) => (
                  <div key={i} className="flex rounded-lg overflow-hidden">
                    <img src={shot.left} alt={`Shot ${i + 1} left`} className="w-1/2 object-cover" />
                    <img src={shot.right} alt={`Shot ${i + 1} right`} className="w-1/2 object-cover" />
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              {viewing.stripPng && (
                <button
                  onClick={() => downloadDataUrl(viewing.stripPng, `lovebooth-memory-${new Date(viewing.date).toISOString().slice(0, 10)}.jpg`)}
                  className="clay-btn flex-1 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm"
                >
                  Download strip
                </button>
              )}
              <button
                onClick={() => remove(viewing.id)}
                className="clay-btn px-5 py-2.5 bg-rose-100 hover:bg-rose-200 text-ink text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
