import { useState } from 'react'
import SpaceHeader from '../components/SpaceHeader'
import { useCouple } from '../context/CoupleContext'
import ThisOrThat from '../games/ThisOrThat'
import KnowMe from '../games/KnowMe'
import DrawTogether from '../games/DrawTogether'

const GAMES = [
  { id: 'tot', icon: '⚖️', title: 'This or That', desc: 'Pick together, reveal together' },
  { id: 'know', icon: '❓', title: 'How Well Do You Know Me?', desc: 'Ask, guess, and find out' },
  { id: 'draw', icon: '🎨', title: 'Draw Together', desc: 'One shared canvas, two hands' },
]

export default function Games() {
  const { connected } = useCouple()
  const [active, setActive] = useState(null)

  return (
    <div className="p-4 lg:p-6">
      <SpaceHeader title="Games" back />
      <main className="max-w-lg mx-auto space-y-4">
        {!connected && (
          <div className="clay p-4 text-center text-sm text-ink/60 border-2 border-amber-200 bg-amber-50/50">
            Games play best when you're both online. Waiting for your partner to join the space…
          </div>
        )}

        {!active && (
          <div className="space-y-3">
            {GAMES.map((g) => (
              <button key={g.id} onClick={() => setActive(g.id)}
                className="clay p-5 w-full flex items-center gap-4 text-left hover:-translate-y-0.5 transition-transform duration-200">
                <span className="text-4xl">{g.icon}</span>
                <span>
                  <span className="block font-display text-lg text-primary">{g.title}</span>
                  <span className="block text-sm text-ink/60">{g.desc}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {active && (
          <div>
            <button onClick={() => setActive(null)} className="text-sm font-display text-ink/50 hover:text-primary mb-3">
              ‹ All games
            </button>
            {active === 'tot' && <ThisOrThat />}
            {active === 'know' && <KnowMe />}
            {active === 'draw' && <DrawTogether />}
          </div>
        )}
      </main>
    </div>
  )
}
