import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { CoupleConnection } from '../lib/couple'

const CoupleContext = createContext(null)

const CODE_KEY = 'lovebooth-couple-code'
const NAME_KEY = 'lovebooth-name'
const SELF_KEY = 'lovebooth-self-id'

export function getSavedCode() {
  return localStorage.getItem(CODE_KEY) || ''
}
export function getSavedName() {
  return localStorage.getItem(NAME_KEY) || ''
}
// Stable per-device id so each partner can publish their own profile
// (name, timezone) under a distinct key that survives host/guest role flips.
export function getSelfId() {
  let id = localStorage.getItem(SELF_KEY)
  if (!id) {
    id = `d-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(SELF_KEY, id)
  }
  return id
}

// Wraps the app. Holds one persistent CoupleConnection for the active couple
// code and exposes it + connection status to the whole feature set.
export function CoupleProvider({ children }) {
  const [code, setCodeState] = useState(getSavedCode())
  const [name, setNameState] = useState(getSavedName())
  const [connected, setConnected] = useState(false)
  const connRef = useRef(null)

  useEffect(() => {
    if (!code) {
      connRef.current?.destroy()
      connRef.current = null
      setConnected(false)
      return
    }
    const conn = new CoupleConnection(code, name || 'Someone')
    connRef.current = conn
    window.__couple = conn // debug hook
    const off = conn.onStatus(setConnected)
    return () => { off(); conn.destroy(); connRef.current = null }
    // Reconnect only when the code changes (name is passed at connect time).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const setCode = useCallback((c) => {
    const clean = (c || '').trim().toLowerCase()
    if (clean) localStorage.setItem(CODE_KEY, clean)
    else localStorage.removeItem(CODE_KEY)
    setCodeState(clean)
  }, [])

  const setName = useCallback((n) => {
    const clean = (n || '').trim().slice(0, 24)
    localStorage.setItem(NAME_KEY, clean)
    setNameState(clean)
  }, [])

  const value = useMemo(
    () => ({ code, name, connected, setCode, setName, conn: () => connRef.current }),
    [code, name, connected, setCode, setName]
  )
  return <CoupleContext.Provider value={value}>{children}</CoupleContext.Provider>
}

export function useCouple() {
  const ctx = useContext(CoupleContext)
  if (!ctx) throw new Error('useCouple must be used inside CoupleProvider')
  return ctx
}

// Synced key/value state bound to the couple connection. Reads the current
// value, re-renders on remote updates, and setValue persists + broadcasts.
export function useSharedState(key, fallback) {
  const { conn } = useCouple()
  const [value, setValue] = useState(() => conn()?.getState(key, fallback) ?? fallback)

  useEffect(() => {
    const c = conn()
    if (!c) return
    setValue(c.getState(key, fallback) ?? fallback)
    const off = c.onState(key, (v) => setValue(v))
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const set = useCallback(
    (v) => {
      const next = typeof v === 'function' ? v(conn()?.getState(key, fallback) ?? fallback) : v
      conn()?.setState(key, next)
      setValue(next)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  )

  return [value, set]
}

// All synced values whose key starts with `prefix`, kept live. Used for
// collections both partners contribute to (profiles, letters, mood days).
export function useSharedList(prefix) {
  const { conn } = useCouple()
  const [items, setItems] = useState(() => conn()?.listState(prefix) || [])
  useEffect(() => {
    const c = conn()
    if (!c) return
    const refresh = () => setItems(c.listState(prefix))
    refresh()
    const off = c.onAny((key) => { if (key.startsWith(prefix)) refresh() })
    const offStatus = c.onStatus(refresh) // re-read after a sync exchange
    return () => { off(); offStatus() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix])
  return items
}

// Subscribe to a real-time message type (games / watch-together / drawing).
export function useCoupleMessage(type, handler) {
  const { conn } = useCouple()
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const c = conn()
    if (!c) return
    return c.on(type, (payload) => ref.current?.(payload))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])
  return useCallback((payload) => conn()?.send(type, payload), [type]) // eslint-disable-line react-hooks/exhaustive-deps
}
