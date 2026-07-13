import { useSharedList, useCouple, getSelfId } from '../context/CoupleContext'
import { useNow } from '../hooks/useNow'
import { timeInZone, dayTimeInZone, zoneCity, hourDiff, myTimezone } from '../lib/timefmt'

// Both partners' local clocks side by side. Each device publishes its own
// timezone (see usePublishProfile); this reads them from synced state.
export default function TimezoneStrip() {
  const { name } = useCouple()
  const profiles = useSharedList('profile:')
  useNow(1000) // tick the clocks

  const selfId = getSelfId()
  // Ensure "you" always shows even before the profile round-trips.
  const me = profiles.find((p) => p.value?.id === selfId)?.value || { id: selfId, name: name || 'You', tz: myTimezone() }
  const partner = profiles.map((p) => p.value).find((v) => v && v.id !== selfId)

  const Clock = ({ label, tz, accent }) => (
    <div className="flex-1 text-center">
      <p className="text-xs font-display text-ink/50 truncate">{label}</p>
      <p className={`font-display font-bold text-2xl sm:text-3xl tabular-nums ${accent ? 'text-primary' : 'text-ink'}`}>{timeInZone(tz)}</p>
      <p className="text-[11px] text-ink/45">{zoneCity(tz)} · {dayTimeInZone(tz).split(',')[0]}</p>
    </div>
  )

  const diff = partner ? hourDiff(partner.tz) : 0

  return (
    <div className="clay p-4">
      <div className="flex items-center gap-2">
        <Clock label={`${me.name || 'You'} (you)`} tz={me.tz} accent />
        <div className="text-center px-1">
          <span className="text-2xl">🌍</span>
          {partner && (
            <p className="text-[10px] text-ink/45 mt-0.5">
              {diff === 0 ? 'same time' : `${diff > 0 ? '+' : ''}${diff}h`}
            </p>
          )}
        </div>
        {partner ? (
          <Clock label={partner.name || 'Partner'} tz={partner.tz} />
        ) : (
          <div className="flex-1 text-center text-ink/40">
            <p className="text-2xl">🕰️</p>
            <p className="text-[11px]">waiting for your<br />partner's clock</p>
          </div>
        )}
      </div>
    </div>
  )
}
