import SpaceHeader from '../components/SpaceHeader'
import VisitCountdown from '../components/VisitCountdown'

export default function CountdownPage() {
  return (
    <div className="p-4 lg:p-6">
      <SpaceHeader title="Countdown" back />
      <main className="max-w-lg mx-auto">
        <VisitCountdown />
        <p className="text-center text-xs text-ink/50 mt-4">
          The date is shared — whoever sets it, you both see the same countdown. 💞
        </p>
      </main>
    </div>
  )
}
