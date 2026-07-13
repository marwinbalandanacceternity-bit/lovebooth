import { NavLink } from 'react-router-dom'
import { useCouple } from '../context/CoupleContext'

// Fixed bottom nav present on every couple page. The dashboard grid links to
// the full feature set; this bar keeps the most-used ones one tap away.
const ITEMS = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/letters', label: 'Letters', icon: '💌' },
  { to: '/games', label: 'Games', icon: '🎮' },
  { to: '/mood', label: 'Mood', icon: '🫶' },
  { to: '/watch', label: 'Watch', icon: '🍿' },
]

export default function BottomNav() {
  const { code } = useCouple()
  if (!code) return null
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-rose-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 pb-[env(safe-area-inset-bottom)]">
      <ul className="max-w-lg mx-auto flex items-stretch justify-around">
        {ITEMS.map((it) => (
          <li key={it.to} className="flex-1">
            <NavLink
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] font-display transition-colors duration-200 ${
                  isActive ? 'text-primary' : 'text-ink/50 hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`text-xl leading-none transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                    {it.icon}
                  </span>
                  {it.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
