import { useCouple, useSharedState, useSharedList, getSelfId } from '../context/CoupleContext'

const PROMPTS = [
  ['Beach 🏖️', 'Mountains ⛰️'],
  ['Morning person ☀️', 'Night owl 🌙'],
  ['Text 💬', 'Call 📞'],
  ['Sweet 🍫', 'Savory 🍟'],
  ['Movie night 🎬', 'Night out 🪩'],
  ['Cats 🐈', 'Dogs 🐕'],
  ['Coffee ☕', 'Tea 🍵'],
  ['Big party 🎉', 'Quiet dinner 🍝'],
  ['Plan everything 🗒️', 'Go with the flow 🌊'],
  ['Window seat 🪟', 'Aisle seat 🚶'],
  ['Save it 💰', 'Treat us ✨'],
  ['Little spoon 🥄', 'Big spoon 🍥'],
]

export default function ThisOrThat() {
  const { name } = useCouple()
  const selfId = getSelfId()
  const [round, setRound] = useSharedState('tot-round', 0)
  const picks = useSharedList(`tot:${round}:`)

  const prompt = PROMPTS[round % PROMPTS.length]
  const myKey = `tot:${round}:${selfId}`
  const myPick = picks.find((p) => p.key === myKey)?.value
  const partnerPick = picks.find((p) => p.key !== myKey)?.value?.choice != null
    ? picks.find((p) => p.key !== myKey)?.value
    : null
  const both = myPick && partnerPick
  const matched = both && myPick.choice === partnerPick.choice

  const { conn } = useCouple()
  const pick = (choice) => {
    if (myPick) return
    conn()?.setState(myKey, { choice, name: name || 'You' })
  }
  const next = () => setRound((round || 0) + 1)

  return (
    <div className="clay p-6 text-center rise-in">
      <p className="text-sm text-ink/50 font-display mb-1">Round {round + 1}</p>
      <h2 className="font-display text-xl text-primary mb-5">This or That?</h2>

      <div className="grid grid-cols-2 gap-3">
        {prompt.map((opt, i) => {
          const chosenByMe = myPick?.choice === i
          const chosenByPartner = both && partnerPick.choice === i
          return (
            <button key={i} onClick={() => pick(i)} disabled={!!myPick}
              className={`rounded-3xl p-6 border-3 font-display text-lg transition-all duration-200 ${
                chosenByMe ? 'border-primary bg-rose-50 scale-[1.02]' : 'border-rose-200 hover:border-rose-300 bg-white'
              } ${myPick ? 'cursor-default' : 'cursor-pointer'}`}>
              <span className="block">{opt}</span>
              {both && (
                <span className="block text-xs mt-2 text-ink/60">
                  {chosenByMe && `you${chosenByPartner ? ' + ' + (partnerPick.name || 'partner') : ''}`}
                  {!chosenByMe && chosenByPartner && (partnerPick.name || 'partner')}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-5 min-h-[2rem]">
        {!myPick && <p className="text-ink/50 text-sm">Make your pick…</p>}
        {myPick && !partnerPick && <p className="text-ink/50 text-sm">Waiting for your partner… 💭</p>}
        {both && (
          <p className={`font-display text-lg ${matched ? 'text-emerald-600 heartbeat' : 'text-cta'}`}>
            {matched ? 'You matched! 💞' : 'Opposites attract 😄'}
          </p>
        )}
      </div>

      <button onClick={next} className="clay-btn mt-3 px-6 py-2.5 bg-secondary hover:bg-rose-500 text-white text-sm">
        Next question →
      </button>
    </div>
  )
}
