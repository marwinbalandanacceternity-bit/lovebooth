import { useState } from 'react'
import SpaceHeader from '../components/SpaceHeader'
import { useCouple, useSharedList, getSelfId } from '../context/CoupleContext'
import { useNow } from '../hooks/useNow'

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const fmt = (ts) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

// A sealed letter addressed to me — locked until its delivery time, then it
// opens with a little animation to reveal the message.
function IncomingLetter({ letter, now, onOpen }) {
  const sealed = now < letter.deliverAt
  const [opening, setOpening] = useState(false)

  if (sealed) {
    let d = letter.deliverAt - now
    const days = Math.floor(d / 86400000); d -= days * 86400000
    const hrs = Math.floor(d / 3600000); d -= hrs * 3600000
    const mins = Math.floor(d / 60000)
    return (
      <div className="clay p-5 text-center">
        <div className="text-5xl mb-2 seal-wiggle">💌</div>
        <p className="font-display text-primary">A sealed letter from {letter.fromName}</p>
        <p className="text-sm text-ink/60 mt-1">Opens in {days > 0 ? `${days}d ` : ''}{hrs}h {mins}m</p>
        <p className="text-[11px] text-ink/40 mt-1">Delivers {fmt(letter.deliverAt)}</p>
      </div>
    )
  }

  if (letter.openedAt || opening) {
    return (
      <div className="clay p-5 rise-in">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">💗</span>
          <p className="font-display text-primary flex-1">From {letter.fromName}</p>
          <span className="text-[11px] text-ink/40">{fmt(letter.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap text-ink leading-relaxed">{letter.body}</p>
      </div>
    )
  }

  return (
    <button onClick={() => { setOpening(true); onOpen(letter) }}
      className="clay p-6 w-full text-center hover:-translate-y-0.5 transition-transform duration-200">
      <div className="text-5xl mb-2 floaty">✉️</div>
      <p className="font-display text-primary">You have a letter from {letter.fromName}!</p>
      <p className="text-sm text-ink/60">Tap to open 💕</p>
    </button>
  )
}

function OutgoingLetter({ letter, now }) {
  const delivered = now >= letter.deliverAt
  return (
    <div className="clay p-4 opacity-90">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">📤</span>
        <p className="font-display text-ink flex-1">To {letter.toName || 'your partner'}</p>
        <span className="text-[11px] text-ink/40">
          {delivered ? (letter.openedAt ? 'Read ✓✓' : 'Delivered') : `Delivers ${fmt(letter.deliverAt)}`}
        </span>
      </div>
      <p className="text-sm text-ink/70 whitespace-pre-wrap line-clamp-3">{letter.body}</p>
    </div>
  )
}

export default function Letters() {
  const { conn, name } = useCouple()
  const selfId = getSelfId()
  const letters = useSharedList('letter:')
    .map((i) => i.value)
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt)
  const now = useNow(1000)

  const [body, setBody] = useState('')
  const [deliverAt, setDeliverAt] = useState('') // datetime-local or '' for now
  const [sent, setSent] = useState(false)

  const partnerProfile = useSharedList('profile:').map((i) => i.value).find((v) => v && v.id !== selfId)

  const send = () => {
    if (!body.trim()) return
    const id = uid()
    const deliver = deliverAt ? new Date(deliverAt).getTime() : Date.now()
    conn()?.setState(`letter:${id}`, {
      id, from: selfId, fromName: name || 'Someone',
      toName: partnerProfile?.name || null,
      body: body.trim(), createdAt: Date.now(), deliverAt: deliver, openedAt: null,
    })
    setBody(''); setDeliverAt(''); setSent(true)
    setTimeout(() => setSent(false), 2500)
  }

  const markOpened = (letter) => {
    conn()?.setState(`letter:${letter.id}`, { ...letter, openedAt: Date.now() })
  }

  return (
    <div className="p-4 lg:p-6">
      <SpaceHeader title="Letters" back />
      <main className="max-w-lg mx-auto space-y-4">
        {/* Composer */}
        <div className="clay p-5">
          <h2 className="font-display text-lg text-primary mb-2">Write a love letter 💌</h2>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000}
            placeholder="Pour your heart out… it'll be sealed until the moment you choose."
            className="w-full px-4 py-3 rounded-2xl border-2 border-rose-200 focus:border-primary focus:outline-none bg-cream/40 text-ink placeholder:text-ink/40 resize-none" />
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <label className="text-sm text-ink/70 flex items-center gap-2">
              Deliver at
              <input type="datetime-local" value={deliverAt} onChange={(e) => setDeliverAt(e.target.value)}
                className="px-3 py-2 rounded-xl border-2 border-rose-200 focus:border-primary focus:outline-none bg-white text-ink text-sm" />
            </label>
            {deliverAt && (
              <button onClick={() => setDeliverAt('')} className="text-xs text-ink/50 hover:text-primary">deliver now instead</button>
            )}
            <button onClick={send} disabled={!body.trim()} className="clay-btn ml-auto px-6 py-2.5 bg-primary hover:bg-primary-dark text-white">
              {deliverAt ? 'Seal & schedule' : 'Send now'}
            </button>
          </div>
          {sent && <p className="text-sm text-emerald-600 font-display mt-2">Sealed and on its way 💗</p>}
        </div>

        {/* Mailbox */}
        {letters.length === 0 ? (
          <p className="text-center text-ink/50 text-sm py-8">No letters yet — write the first one above. 💕</p>
        ) : (
          <div className="space-y-3">
            {letters.map((l) =>
              l.from === selfId
                ? <OutgoingLetter key={l.id} letter={l} now={now} />
                : <IncomingLetter key={l.id} letter={l} now={now} onOpen={markOpened} />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
