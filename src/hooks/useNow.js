import { useEffect, useState } from 'react'

// Re-render every `interval` ms with the current time. Used by the live
// countdown and the timezone clocks.
export function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(id)
  }, [interval])
  return now
}
