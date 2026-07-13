import { useState } from 'react'
import { useCouple } from '../context/CoupleContext'

function randomCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const HeartIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
  </svg>
)

// First-run: name yourself and create or join your shared space. The space
// code is the key everything syncs on — both partners enter the same one.
export default function Onboarding() {
  const { setCode, setName } = useCouple()
  const [nameInput, setNameInput] = useState('')
  // Prefill the code when arriving from an invite link (/?join=abc123).
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(window.location.search).get('join') || '')
  const [error, setError] = useState('')

  const commit = (code) => {
    setName(nameInput.trim() || 'Someone')
    setCode(code)
  }

  const create = () => commit(randomCode())

  const join = () => {
    const match = joinCode.trim().match(/([a-z0-9]{6})\/?$/i)
    if (!match) { setError("That doesn't look like a space code."); return }
    commit(match[1].toLowerCase())
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary text-white mb-4 shadow-lg shadow-rose-300 floaty">
            <HeartIcon className="w-10 h-10" />
          </div>
          <h1 className="text-5xl font-semibold text-primary mb-2">LoveBooth</h1>
          <p className="text-lg text-ink/70">Your shared space, any distance apart</p>
        </div>

        <div className="clay p-8 space-y-6">
          <div>
            <label htmlFor="name" className="block font-display font-medium mb-2">Your name</label>
            <input id="name" type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Marwin" maxLength={20}
              className="w-full px-4 py-3 rounded-2xl border-2 border-rose-200 focus:border-primary focus:outline-none bg-cream/50 text-ink placeholder:text-ink/40" />
          </div>

          <button onClick={create} className="clay-btn w-full py-4 bg-primary hover:bg-primary-dark text-white text-lg">
            Create our space
          </button>

          <div className="flex items-center gap-3 text-ink/40">
            <div className="flex-1 h-px bg-rose-200" />
            <span className="text-sm font-medium">or join your partner</span>
            <div className="flex-1 h-px bg-rose-200" />
          </div>

          <div className="flex gap-2">
            <input type="text" value={joinCode} onChange={(e) => { setJoinCode(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && join()}
              placeholder="Paste space code" aria-label="Space code"
              className="flex-1 px-4 py-3 rounded-2xl border-2 border-rose-200 focus:border-primary focus:outline-none bg-cream/50 text-ink placeholder:text-ink/40" />
            <button onClick={join} className="clay-btn px-6 py-3 bg-cta hover:bg-orange-600 text-white">Join</button>
          </div>
          {error && <p className="text-sm text-primary font-medium" role="alert">{error}</p>}
        </div>

        <p className="text-center text-sm text-ink/50 mt-6">
          One space, shared between two hearts — photos, letters, games, and the countdown to your next hug. 💕
        </p>
      </div>
    </div>
  )
}
