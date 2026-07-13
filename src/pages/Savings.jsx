import { useState } from 'react'
import SpaceHeader from '../components/SpaceHeader'
import { useCouple, useSharedState, useSharedList, getSelfId } from '../context/CoupleContext'

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const money = (n, cur) => `${cur} ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function Savings() {
  const { conn, name } = useCouple()
  const selfId = getSelfId()
  const [goal, setGoal] = useSharedState('savings-goal', null) // { title, target, currency }
  const contribs = useSharedList('contrib:').map((i) => i.value).filter(Boolean).sort((a, b) => b.ts - a.ts)

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(goal?.title || '')
  const [target, setTarget] = useState(goal?.target || '')
  const [currency, setCurrency] = useState(goal?.currency || 'AED')

  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const total = contribs.reduce((s, c) => s + (Number(c.amount) || 0), 0)
  const pct = goal?.target ? Math.min(100, (total / goal.target) * 100) : 0
  const remaining = goal?.target ? Math.max(0, goal.target - total) : 0

  const saveGoal = () => {
    if (!title.trim() || !(Number(target) > 0)) return
    setGoal({ title: title.trim(), target: Number(target), currency: currency.trim() || 'AED' })
    setEditing(false)
  }

  const addContribution = () => {
    const amt = Number(amount)
    if (!(amt > 0)) return
    conn()?.setState(`contrib:${uid()}`, { id: uid(), by: selfId, name: name || 'You', amount: amt, note: note.trim(), ts: Date.now() })
    setAmount(''); setNote('')
  }

  const removeContribution = (c) => {
    // Tombstone by zeroing it out (synced delete isn't in the store API).
    conn()?.setState(`contrib:${c.id}`, { ...c, amount: 0, note: '(removed)', removed: true })
  }

  if (!goal || editing) {
    return (
      <div className="p-4 lg:p-6">
        <SpaceHeader title="Savings" back />
        <main className="max-w-md mx-auto">
          <div className="clay p-6">
            <h2 className="font-display text-xl text-primary mb-1 text-center">Set your trip goal 💰</h2>
            <p className="text-sm text-ink/55 mb-4 text-center">Save toward seeing each other — together.</p>
            <div className="space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40}
                placeholder="Goal — e.g. Manila trip ✈️"
                className="w-full px-4 py-3 rounded-2xl border-2 border-rose-200 focus:border-primary focus:outline-none bg-cream/40 text-ink placeholder:text-ink/40" />
              <div className="flex gap-2">
                <input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={5}
                  className="w-20 px-3 py-3 rounded-2xl border-2 border-rose-200 focus:border-primary focus:outline-none bg-cream/40 text-ink text-center" />
                <input value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal"
                  placeholder="Target amount — e.g. 3000"
                  className="flex-1 px-4 py-3 rounded-2xl border-2 border-rose-200 focus:border-primary focus:outline-none bg-cream/40 text-ink placeholder:text-ink/40" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveGoal} disabled={!title.trim() || !(Number(target) > 0)} className="clay-btn flex-1 py-3 bg-primary hover:bg-primary-dark text-white">Save goal</button>
                {goal && <button onClick={() => setEditing(false)} className="clay-btn px-4 py-3 bg-rose-100 hover:bg-rose-200 text-ink text-sm">Cancel</button>}
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const reached = total >= goal.target

  return (
    <div className="p-4 lg:p-6">
      <SpaceHeader title="Savings" back />
      <main className="max-w-md mx-auto space-y-4">
        {/* Progress */}
        <div className="clay p-6 text-center">
          <h2 className="font-display text-xl text-primary">{goal.title}</h2>
          <p className="text-3xl font-display font-bold text-ink mt-2">{money(total, goal.currency)}</p>
          <p className="text-sm text-ink/55">of {money(goal.target, goal.currency)}</p>

          <div className="h-5 rounded-full bg-rose-100 overflow-hidden mt-4">
            <div className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%` }} />
          </div>
          <p className={`mt-3 font-display ${reached ? 'text-emerald-600 heartbeat' : 'text-ink/70'}`}>
            {reached ? "Goal reached — book those tickets! 🎉✈️" : `${money(remaining, goal.currency)} to go · ${Math.round(pct)}%`}
          </p>
          <button onClick={() => { setTitle(goal.title); setTarget(goal.target); setCurrency(goal.currency); setEditing(true) }}
            className="text-xs text-ink/45 hover:text-primary mt-3">Edit goal</button>
        </div>

        {/* Add contribution */}
        <div className="clay p-4">
          <div className="flex gap-2">
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal"
              placeholder={`Amount (${goal.currency})`}
              className="w-32 px-4 py-3 rounded-2xl border-2 border-rose-200 focus:border-primary focus:outline-none bg-cream/40 text-ink placeholder:text-ink/40" />
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={30}
              onKeyDown={(e) => e.key === 'Enter' && addContribution()}
              placeholder="Note (optional)"
              className="flex-1 px-4 py-3 rounded-2xl border-2 border-rose-200 focus:border-primary focus:outline-none bg-cream/40 text-ink placeholder:text-ink/40" />
          </div>
          <button onClick={addContribution} disabled={!(Number(amount) > 0)} className="clay-btn w-full mt-2 py-2.5 bg-cta hover:bg-orange-600 text-white">
            Add contribution
          </button>
        </div>

        {/* Log */}
        {contribs.filter((c) => !c.removed).length > 0 && (
          <div className="clay p-4">
            <h3 className="font-display text-ink/70 text-sm mb-2">Contributions</h3>
            <ul className="divide-y divide-rose-50">
              {contribs.filter((c) => !c.removed).map((c) => (
                <li key={c.id} className="flex items-center gap-2 py-2.5">
                  <span className="text-lg">{c.by === selfId ? '🫰' : '💝'}</span>
                  <span className="flex-1 min-w-0">
                    <span className="font-display text-ink">{money(c.amount, goal.currency)}</span>
                    <span className="text-ink/50 text-sm"> · {c.name}{c.note ? ` — ${c.note}` : ''}</span>
                  </span>
                  {c.by === selfId && (
                    <button onClick={() => removeContribution(c)} aria-label="Remove" className="text-ink/30 hover:text-primary text-sm">✕</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}
