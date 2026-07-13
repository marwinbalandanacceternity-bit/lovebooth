import { useState } from 'react'
import { useCouple, useSharedState, getSelfId } from '../context/CoupleContext'

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
// The true answer is kept only on the asker's device (never synced) until
// they choose to reveal, so the guesser can't peek at it in transit.
const secretKey = (id) => `kwm-secret-${id}`
const saveSecret = (id, a) => { try { localStorage.setItem(secretKey(id), a) } catch { /* ignore */ } }
const loadSecret = (id) => { try { return localStorage.getItem(secretKey(id)) || '' } catch { return '' } }

export default function KnowMe() {
  const { name } = useCouple()
  const selfId = getSelfId()
  const [game, setGame] = useSharedState('kwm', null)

  const [q, setQ] = useState('')
  const [a, setA] = useState('')
  const [guess, setGuess] = useState('')

  const startAsk = () => {
    if (!q.trim() || !a.trim()) return
    const id = uid()
    saveSecret(id, a.trim())
    setGame({ id, askerId: selfId, askerName: name || 'Someone', question: q.trim(), phase: 'asking', guess: null, guesserName: null, answer: null })
    setQ(''); setA('')
  }

  const submitGuess = () => {
    if (!guess.trim() || !game) return
    setGame({ ...game, guess: guess.trim(), guesserName: name || 'Someone', phase: 'answered' })
    setGuess('')
  }

  const reveal = () => setGame({ ...game, answer: loadSecret(game.id) || '(answer was lost)', phase: 'revealed' })
  const reset = () => setGame(null)

  // ----- No active question: anyone can ask -----
  if (!game || game.phase === 'done') {
    return (
      <div className="clay p-6 rise-in">
        <h2 className="font-display text-xl text-primary mb-1 text-center">How Well Do You Know Me?</h2>
        <p className="text-sm text-ink/60 mb-4 text-center">Ask something about yourself — your partner guesses.</p>
        <div className="space-y-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={120}
            placeholder="Your question — e.g. What's my comfort food?"
            className="w-full px-4 py-3 rounded-2xl border-2 border-rose-200 focus:border-primary focus:outline-none bg-cream/40 text-ink placeholder:text-ink/40" />
          <input value={a} onChange={(e) => setA(e.target.value)} maxLength={120}
            placeholder="The real answer (kept secret until reveal)"
            className="w-full px-4 py-3 rounded-2xl border-2 border-rose-200 focus:border-primary focus:outline-none bg-cream/40 text-ink placeholder:text-ink/40" />
          <button onClick={startAsk} disabled={!q.trim() || !a.trim()} className="clay-btn w-full py-3 bg-primary hover:bg-primary-dark text-white">
            Ask my partner
          </button>
        </div>
      </div>
    )
  }

  const iAsked = game.askerId === selfId
  const match = game.phase === 'revealed' && game.guess && game.answer &&
    game.guess.trim().toLowerCase() === game.answer.trim().toLowerCase()

  return (
    <div className="clay p-6 rise-in space-y-4">
      <div>
        <p className="text-xs font-display text-ink/50">{game.askerName} asks</p>
        <p className="font-display text-lg text-primary">{game.question}</p>
      </div>

      {/* Guesser's turn */}
      {!iAsked && game.phase === 'asking' && (
        <div className="space-y-2">
          <input value={guess} onChange={(e) => setGuess(e.target.value)} maxLength={120}
            onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
            placeholder="Your guess…"
            className="w-full px-4 py-3 rounded-2xl border-2 border-rose-200 focus:border-primary focus:outline-none bg-cream/40 text-ink placeholder:text-ink/40" />
          <button onClick={submitGuess} disabled={!guess.trim()} className="clay-btn w-full py-3 bg-cta hover:bg-orange-600 text-white">
            Lock in my guess
          </button>
        </div>
      )}

      {iAsked && game.phase === 'asking' && (
        <p className="text-ink/50 text-sm">Waiting for your partner to guess… 💭</p>
      )}

      {/* Asker reveals */}
      {iAsked && game.phase === 'answered' && (
        <div className="space-y-3">
          <p className="text-sm text-ink/70"><span className="text-ink/50">Their guess:</span> <span className="font-display">{game.guess}</span></p>
          <button onClick={reveal} className="clay-btn w-full py-3 bg-primary hover:bg-primary-dark text-white">Reveal the answer</button>
        </div>
      )}
      {!iAsked && game.phase === 'answered' && (
        <p className="text-ink/50 text-sm">Guess locked in — waiting for {game.askerName} to reveal… ✨</p>
      )}

      {/* Reveal */}
      {game.phase === 'revealed' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-rose-50 p-3">
              <p className="text-[11px] text-ink/50">Guess</p>
              <p className="font-display text-ink">{game.guess}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3">
              <p className="text-[11px] text-ink/50">Answer</p>
              <p className="font-display text-ink">{game.answer}</p>
            </div>
          </div>
          <p className={`text-center font-display text-lg ${match ? 'text-emerald-600 heartbeat' : 'text-cta'}`}>
            {match ? 'Nailed it! 💞' : 'So close — now you know 💕'}
          </p>
          <button onClick={reset} className="clay-btn w-full py-3 bg-secondary hover:bg-rose-500 text-white">Ask another</button>
        </div>
      )}
    </div>
  )
}
