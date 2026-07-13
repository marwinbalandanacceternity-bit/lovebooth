import { useState } from 'react'
import { useSharedState } from '../context/CoupleContext'
import { useNow } from '../hooks/useNow'
import { countdownParts } from '../lib/timefmt'

function Unit({ value, label, big }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`font-display font-bold tabular-nums leading-none ${big ? 'text-5xl sm:text-7xl' : 'text-3xl sm:text-4xl'} text-primary`}>
        {String(value).padStart(2, '0')}
      </span>
      <span className={`uppercase tracking-wide text-ink/50 ${big ? 'text-xs mt-2' : 'text-[10px] mt-1'}`}>{label}</span>
    </div>
  )
}

// Shared "next visit" countdown. `compact` renders the dashboard hero; full
// mode adds the date editor. Data lives in synced state so both partners see
// the same date. Heartbeat animation kicks in under 24 hours.
export default function VisitCountdown({ compact = false }) {
  // { date: ISO 'YYYY-MM-DD', label, ts }
  const [visit, setVisit] = useSharedState('visit', null)
  const [editing, setEditing] = useState(false)
  const [draftDate, setDraftDate] = useState(visit?.date || '')
  const [draftLabel, setDraftLabel] = useState(visit?.label || '')
  const now = useNow(1000)

  const parts = visit?.ts ? countdownParts(visit.ts, now) : null
  const soon = parts && !parts.over && parts.ms < 86400000
  const reunited = parts && parts.over

  const save = () => {
    if (!draftDate) return
    // Count down to the start of the chosen day in local time.
    const ts = new Date(`${draftDate}T00:00:00`).getTime()
    setVisit({ date: draftDate, label: draftLabel.trim() || 'Next time together', ts })
    setEditing(false)
  }

  const clear = () => { setVisit(null); setEditing(false); setDraftDate(''); setDraftLabel('') }

  if (editing || (!visit && !compact)) {
    return (
      <div className="clay p-6 text-center">
        <h2 className="font-display text-xl text-primary mb-1">When do you meet next? 💞</h2>
        <p className="text-sm text-ink/60 mb-4">Set the date — you'll both watch it count down.</p>
        <div className="space-y-3 max-w-xs mx-auto text-left">
          <label className="block">
            <span className="text-sm font-display">The date</span>
            <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)}
              className="mt-1 w-full px-4 py-3 rounded-2xl border-2 border-rose-200 focus:border-primary focus:outline-none bg-cream/40 text-ink" />
          </label>
          <label className="block">
            <span className="text-sm font-display">What's happening (optional)</span>
            <input type="text" value={draftLabel} maxLength={40} onChange={(e) => setDraftLabel(e.target.value)}
              placeholder="e.g. Manila reunion ✈️"
              className="mt-1 w-full px-4 py-3 rounded-2xl border-2 border-rose-200 focus:border-primary focus:outline-none bg-cream/40 text-ink placeholder:text-ink/40" />
          </label>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={!draftDate} className="clay-btn flex-1 py-3 bg-primary hover:bg-primary-dark text-white">Save</button>
            {visit && <button onClick={clear} className="clay-btn px-4 py-3 bg-rose-100 hover:bg-rose-200 text-ink text-sm">Clear</button>}
            {visit && <button onClick={() => setEditing(false)} className="clay-btn px-4 py-3 bg-rose-100 hover:bg-rose-200 text-ink text-sm">Cancel</button>}
          </div>
        </div>
      </div>
    )
  }

  if (!visit) {
    // Compact placeholder on the dashboard when no date is set yet.
    return (
      <button onClick={() => setEditing(true)} className="clay p-5 w-full text-center hover:-translate-y-0.5 transition-transform duration-200">
        <p className="text-3xl mb-1">🗓️💗</p>
        <p className="font-display text-primary">Set your next visit</p>
        <p className="text-xs text-ink/50">Start a countdown you'll both feel</p>
      </button>
    )
  }

  return (
    <div className={`clay ${compact ? 'p-5' : 'p-8'} text-center relative overflow-hidden`}>
      <div className="absolute -top-6 -right-4 text-6xl opacity-10 floaty" aria-hidden="true">💗</div>
      <p className="text-sm font-display text-ink/60 mb-1">{reunited ? "It's time! 🎉" : 'Together again in'}</p>
      <h2 className={`font-display font-semibold text-primary mb-4 ${compact ? 'text-lg' : 'text-2xl'}`}>{visit.label}</h2>

      {reunited ? (
        <p className="text-4xl py-4 heartbeat">🥰💞🥳</p>
      ) : (
        <div className={`flex items-start justify-center gap-3 sm:gap-6 ${soon ? 'heartbeat' : ''}`}>
          <Unit value={parts.days} label="days" big={!compact} />
          <Unit value={parts.hours} label="hrs" big={!compact} />
          <Unit value={parts.minutes} label="min" big={!compact} />
          <Unit value={parts.seconds} label="sec" big={!compact} />
        </div>
      )}

      {soon && !reunited && (
        <p className="text-sm text-primary font-display mt-4 heartbeat">Less than a day — almost there! 💓</p>
      )}

      <button onClick={() => { setDraftDate(visit.date); setDraftLabel(visit.label); setEditing(true) }}
        className="mt-5 text-sm font-display text-ink/50 hover:text-primary transition-colors duration-200">
        Change date
      </button>
    </div>
  )
}
