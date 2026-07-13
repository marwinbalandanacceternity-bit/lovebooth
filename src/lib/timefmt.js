// Small date/time helpers shared by the visit countdown and timezone display.

export const myTimezone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }
  catch { return 'UTC' }
}

// Break a future timestamp into countdown parts relative to now.
export function countdownParts(targetTs, now = Date.now()) {
  let diff = Math.max(0, targetTs - now)
  const over = targetTs - now <= 0
  const days = Math.floor(diff / 86400000); diff -= days * 86400000
  const hours = Math.floor(diff / 3600000); diff -= hours * 3600000
  const minutes = Math.floor(diff / 60000); diff -= minutes * 60000
  const seconds = Math.floor(diff / 1000)
  return { days, hours, minutes, seconds, over, ms: targetTs - now }
}

// Current wall-clock time in an IANA timezone, e.g. "3:04 PM".
export function timeInZone(tz, now = new Date()) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric', minute: '2-digit', timeZone: tz,
    }).format(now)
  } catch { return '—' }
}

// Longer label, e.g. "Sat, 3:04 PM".
export function dayTimeInZone(tz, now = new Date()) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: tz,
    }).format(now)
  } catch { return '—' }
}

// Signed hour difference of `tz` relative to the local zone, e.g. +4, -3.5.
export function hourDiff(tz, now = new Date()) {
  try {
    const local = new Date(now.toLocaleString('en-US'))
    const there = new Date(now.toLocaleString('en-US', { timeZone: tz }))
    return Math.round(((there - local) / 3600000) * 10) / 10
  } catch { return 0 }
}

// "Manila" from "Asia/Manila"
export const zoneCity = (tz) => (tz || '').split('/').pop()?.replace(/_/g, ' ') || tz
