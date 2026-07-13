import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCouple } from '../context/CoupleContext'

// Shared page header: title/back, the space code with copy-invite, a live
// connection dot, and (on the dashboard) space settings.
export default function SpaceHeader({ title, back = false, showSettings = false }) {
  const { code, connected, setCode } = useCouple()
  const [copied, setCopied] = useState(false)
  const [menu, setMenu] = useState(false)

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?join=${code}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked */ }
  }

  return (
    <header className="flex flex-wrap items-center gap-3 mb-5 max-w-5xl mx-auto">
      {back ? (
        <Link to="/" className="font-display text-xl font-semibold text-primary flex items-center gap-1">
          <span aria-hidden="true">‹</span> {title || 'LoveBooth'}
        </Link>
      ) : (
        <Link to="/" className="font-display text-2xl font-semibold text-primary">LoveBooth</Link>
      )}

      <span className="px-3 py-1 rounded-full bg-rose-100 text-ink text-sm font-mono">{code}</span>
      <button onClick={copyInvite} className="clay-btn px-4 py-1.5 bg-secondary hover:bg-rose-500 text-white text-sm">
        {copied ? 'Copied! ✓' : 'Invite'}
      </button>

      <div className="ml-auto flex items-center gap-2 text-sm">
        <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} aria-hidden="true" />
        <span className="text-ink/70">{connected ? 'Partner online' : 'Waiting…'}</span>
        {showSettings && (
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} aria-label="Space settings"
              className="w-8 h-8 rounded-full bg-rose-100 hover:bg-rose-200 text-ink transition-colors duration-200">⚙️</button>
            {menu && (
              <div className="absolute right-0 mt-2 w-44 clay p-2 z-50 text-left">
                <button
                  onClick={() => { if (confirm('Leave this shared space on this device? Your synced data stays with the code.')) setCode('') }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 text-sm text-primary">
                  Leave space
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
