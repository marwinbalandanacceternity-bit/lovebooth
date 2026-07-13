import { useEffect } from 'react'
import { useCouple, getSelfId } from '../context/CoupleContext'
import { myTimezone } from '../lib/timefmt'

// Publishes THIS device's profile (name + timezone) into synced state under a
// stable per-device key, so the partner's dashboard can show our local time
// and greet us by name. Re-publishes when the name changes or we reconnect.
export function usePublishProfile() {
  const { conn, name, connected } = useCouple()
  useEffect(() => {
    const c = conn()
    if (!c) return
    c.setState(`profile:${getSelfId()}`, {
      id: getSelfId(),
      name: name || 'Someone',
      tz: myTimezone(),
      updated: Date.now(),
    })
  }, [conn, name, connected])
}
