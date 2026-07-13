import SpaceHeader from '../components/SpaceHeader'
import { useCouple, useSharedList, getSelfId } from '../context/CoupleContext'

const MOODS = [
  { e: '🤩', l: 'Amazing' },
  { e: '🥰', l: 'Loved' },
  { e: '😊', l: 'Good' },
  { e: '😐', l: 'Meh' },
  { e: '😴', l: 'Tired' },
  { e: '😔', l: 'Low' },
  { e: '😢', l: 'Sad' },
  { e: '😰', l: 'Anxious' },
  { e: '😡', l: 'Angry' },
  { e: '🤒', l: 'Unwell' },
]

const localDay = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}
const prettyDay = (iso) => {
  const today = localDay()
  if (iso === today) return 'Today'
  const y = localDay(new Date(Date.now() - 86400000))
  if (iso === y) return 'Yesterday'
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function Mood() {
  const { conn, name } = useCouple()
  const selfId = getSelfId()
  const all = useSharedList('mood:').map((i) => ({ ...i.value, key: i.key })).filter((v) => v && v.date)
  const today = localDay()

  const partnerProfile = useSharedList('profile:').map((i) => i.value).find((v) => v && v.id !== selfId)
  const partnerName = partnerProfile?.name || 'Partner'

  const mineToday = all.find((m) => m.date === today && m.by === selfId)

  const setMood = (mood) => {
    conn()?.setState(`mood:${today}:${selfId}`, { date: today, by: selfId, name: name || 'You', emoji: mood.e, label: mood.l, ts: Date.now() })
  }

  // Group by date, newest first
  const byDate = {}
  for (const m of all) {
    if (!byDate[m.date]) byDate[m.date] = {}
    byDate[m.date][m.by === selfId ? 'me' : 'partner'] = m
  }
  const days = Object.keys(byDate).sort((a, b) => b.localeCompare(a)).slice(0, 30)

  return (
    <div className="p-4 lg:p-6">
      <SpaceHeader title="Mood" back />
      <main className="max-w-lg mx-auto space-y-4">
        {/* Today's check-in */}
        <div className="clay p-5 text-center">
          <h2 className="font-display text-xl text-primary mb-1">How are you feeling today?</h2>
          <p className="text-sm text-ink/55 mb-4">One tap — {partnerName} will see it too.</p>
          <div className="grid grid-cols-5 gap-2">
            {MOODS.map((m) => (
              <button key={m.e} onClick={() => setMood(m)}
                className={`rounded-2xl py-3 flex flex-col items-center gap-1 border-2 transition-all duration-200 ${
                  mineToday?.emoji === m.e ? 'border-primary bg-rose-50 scale-105' : 'border-rose-100 hover:border-rose-300 bg-white'
                }`}>
                <span className="text-2xl">{m.e}</span>
                <span className="text-[10px] text-ink/60">{m.l}</span>
              </button>
            ))}
          </div>
          {mineToday && <p className="text-sm text-emerald-600 font-display mt-3">Checked in — feeling {mineToday.label.toLowerCase()} {mineToday.emoji}</p>}
        </div>

        {/* Side-by-side history */}
        <div className="clay p-4">
          <div className="flex items-center text-xs font-display text-ink/50 px-2 pb-2">
            <span className="flex-1">Day</span>
            <span className="w-16 text-center">You</span>
            <span className="w-16 text-center">{partnerName}</span>
          </div>
          {days.length === 0 ? (
            <p className="text-center text-ink/50 text-sm py-6">Your shared mood history will grow here. 🫶</p>
          ) : (
            <ul className="divide-y divide-rose-50">
              {days.map((d) => (
                <li key={d} className="flex items-center py-2.5 px-2">
                  <span className="flex-1 text-sm text-ink/70">{prettyDay(d)}</span>
                  <span className="w-16 text-center text-2xl" title={byDate[d].me?.label}>{byDate[d].me?.emoji || '·'}</span>
                  <span className="w-16 text-center text-2xl" title={byDate[d].partner?.label}>{byDate[d].partner?.emoji || '·'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
