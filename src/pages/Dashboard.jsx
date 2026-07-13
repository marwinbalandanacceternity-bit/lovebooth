import { Link } from 'react-router-dom'
import { useCouple } from '../context/CoupleContext'
import SpaceHeader from '../components/SpaceHeader'
import TimezoneStrip from '../components/TimezoneStrip'
import VisitCountdown from '../components/VisitCountdown'

const FEATURES = [
  { to: (c) => `/room/${c}`, icon: '📸', title: 'Photobooth', desc: 'Take synced photos together' },
  { to: () => '/countdown', icon: '🗓️', title: 'Visit Countdown', desc: 'Days until your next hug' },
  { to: () => '/letters', icon: '💌', title: 'Love Letters', desc: 'Write notes delivered later' },
  { to: () => '/games', icon: '🎮', title: 'Games', desc: 'Play together in real time' },
  { to: () => '/mood', icon: '🫶', title: 'Mood Check-in', desc: 'Share how you feel each day' },
  { to: () => '/watch', icon: '🍿', title: 'Watch Together', desc: 'Synced YouTube viewing' },
  { to: () => '/savings', icon: '💰', title: 'Trip Savings', desc: 'Save for a visit together' },
  { to: () => '/memories', icon: '🖼️', title: 'Memories', desc: 'Your saved photostrips' },
]

export default function Dashboard() {
  const { code, name } = useCouple()

  return (
    <div className="p-4 lg:p-6">
      <SpaceHeader showSettings />

      <main className="max-w-5xl mx-auto space-y-4">
        <p className="font-display text-lg text-ink/80 px-1">
          {name ? `Hi ${name} 💗` : 'Welcome 💗'}
        </p>

        <TimezoneStrip />
        <VisitCountdown compact />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {FEATURES.map((f) => (
            <Link key={f.title} to={f.to(code)}
              className="clay p-4 flex flex-col gap-1 hover:-translate-y-0.5 transition-transform duration-200">
              <span className="text-3xl">{f.icon}</span>
              <span className="font-display font-medium text-ink mt-1">{f.title}</span>
              <span className="text-xs text-ink/55 leading-snug">{f.desc}</span>
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-ink/45 pt-2">
          Share your space code <span className="font-mono text-ink/70">{code}</span> with your partner so you both land here. Everything syncs between you.
        </p>
      </main>
    </div>
  )
}
