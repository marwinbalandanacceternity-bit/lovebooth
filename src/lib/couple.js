// Persistent "couple space" connection — the backbone for every LDR feature
// outside the booth. Same serverless P2P approach as the booth (PeerJS cloud
// signaling, host election by claiming a well-known peer id), but generic:
//
//  - Arbitrary real-time messages for live features (games, watch-together,
//    shared drawing):        couple.send(type, payload) / couple.on(type, cb)
//  - A last-write-wins synced key/value store for shared state that must
//    persist and converge across both devices (visit countdown, love letters,
//    mood check-ins, savings goal):   couple.setState(key, value) /
//    couple.getState(key) / couple.onState(key, cb)
//
// State lives in localStorage keyed by the couple code so each partner keeps
// their own copy offline; when both are online the stores merge by timestamp.

import Peer from 'peerjs'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
]

const RETRY_MS = 3000
const now = () => Date.now()

export class CoupleConnection {
  constructor(code, name) {
    this.code = code
    this.name = name || 'Someone'
    this.hostId = `lovebooth-couple-${code}`
    this.isHost = false
    this.peer = null
    this.conn = null
    this.destroyed = false
    this.retryTimer = null
    this.connected = false

    this.msgHandlers = new Map() // type -> Set(cb)
    this.stateHandlers = new Map() // key -> Set(cb)
    this.anyHandlers = new Set() // cb(key, value) — any state change
    this.statusHandlers = new Set() // cb(connected)

    this.storeKey = `lovebooth:${code}`
    this.store = this._loadStore() // { [key]: { v, t } }

    this._start()
  }

  // ---------- persistence ----------
  _loadStore() {
    try {
      return JSON.parse(localStorage.getItem(this.storeKey)) || {}
    } catch {
      return {}
    }
  }
  _persist() {
    try {
      localStorage.setItem(this.storeKey, JSON.stringify(this.store))
    } catch {
      /* quota — ignore, memory copy still works this session */
    }
  }

  // ---------- peer wiring ----------
  _start() {
    const peer = new Peer(this.hostId, { config: { iceServers: ICE_SERVERS } })
    this.peer = peer
    peer.on('open', () => {
      if (this.destroyed) return
      this.isHost = true
    })
    peer.on('error', (err) => {
      if (this.destroyed) return
      if (err.type === 'unavailable-id') {
        peer.destroy()
        this._startGuest()
      }
      // peer-unavailable etc. are transient; the retry loop handles reconnects
    })
    peer.on('connection', (c) => this._onIncoming(c))
  }

  _startGuest() {
    const peer = new Peer({ config: { iceServers: ICE_SERVERS } })
    this.peer = peer
    peer.on('open', () => {
      if (this.destroyed) return
      this.isHost = false
      this._connect()
    })
    peer.on('error', (err) => {
      if (this.destroyed) return
      if (err.type === 'peer-unavailable') this._scheduleRetry()
    })
  }

  _connect() {
    if (this.destroyed || this.conn?.open) return
    const c = this.peer.connect(this.hostId, { reliable: true, metadata: { name: this.name } })
    this._wire(c)
  }

  _scheduleRetry() {
    if (this.destroyed) return
    clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(() => {
      if (this.isHost) return
      this._connect()
    }, RETRY_MS)
  }

  _onIncoming(c) {
    // One partner per space; if we already have someone, ignore extras.
    if (this.conn && this.conn.open) return
    this._wire(c)
  }

  _wire(c) {
    this.conn = c
    c.on('open', () => {
      if (this.destroyed) return
      this._setConnected(true)
      // Exchange full stores so both sides converge (merge is idempotent).
      c.send({ t: 'sync-full', store: this.store, name: this.name })
    })
    c.on('data', (d) => this._onData(d))
    c.on('close', () => {
      if (this.destroyed) return
      this.conn = null
      this._setConnected(false)
      if (!this.isHost) this._scheduleRetry()
    })
    c.on('error', () => {
      if (!this.isHost) this._scheduleRetry()
    })
  }

  _setConnected(v) {
    this.connected = v
    this.statusHandlers.forEach((cb) => cb(v))
  }

  _onData(d) {
    if (!d || typeof d !== 'object') return
    switch (d.t) {
      case 'sync-full':
        this._mergeStore(d.store || {})
        break
      case 'sync-set':
        this._applyState(d.key, d.v, d.ts)
        break
      case 'msg': {
        const set = this.msgHandlers.get(d.mtype)
        if (set) set.forEach((cb) => cb(d.payload))
        break
      }
      default:
        break
    }
  }

  _mergeStore(incoming) {
    let changed = false
    for (const [key, rec] of Object.entries(incoming)) {
      if (rec && typeof rec.t === 'number') {
        if (this._applyState(key, rec.v, rec.t)) changed = true
      }
    }
    if (changed) this._persist()
  }

  // Returns true if the value was newer and got applied.
  _applyState(key, v, ts) {
    const cur = this.store[key]
    if (cur && cur.t >= ts) return false
    this.store[key] = { v, t: ts }
    this._persist()
    const set = this.stateHandlers.get(key)
    if (set) set.forEach((cb) => cb(v))
    this.anyHandlers.forEach((cb) => cb(key, v))
    return true
  }

  // ---------- public: real-time messages ----------
  send(type, payload) {
    if (this.conn?.open) this.conn.send({ t: 'msg', mtype: type, payload })
  }
  on(type, cb) {
    if (!this.msgHandlers.has(type)) this.msgHandlers.set(type, new Set())
    this.msgHandlers.get(type).add(cb)
    return () => this.msgHandlers.get(type)?.delete(cb)
  }

  // ---------- public: synced state ----------
  getState(key, fallback = null) {
    return this.store[key] ? this.store[key].v : fallback
  }
  setState(key, value) {
    const ts = now()
    this.store[key] = { v: value, t: ts }
    this._persist()
    if (this.conn?.open) this.conn.send({ t: 'sync-set', key, v: value, ts })
    const set = this.stateHandlers.get(key)
    if (set) set.forEach((cb) => cb(value))
    this.anyHandlers.forEach((cb) => cb(key, value))
  }
  onState(key, cb) {
    if (!this.stateHandlers.has(key)) this.stateHandlers.set(key, new Set())
    this.stateHandlers.get(key).add(cb)
    return () => this.stateHandlers.get(key)?.delete(cb)
  }
  onAny(cb) {
    this.anyHandlers.add(cb)
    return () => this.anyHandlers.delete(cb)
  }

  // All values whose key starts with `prefix` (e.g. "profile:", "letter:").
  listState(prefix) {
    return Object.entries(this.store)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, rec]) => ({ key: k, value: rec.v, t: rec.t }))
  }

  onStatus(cb) {
    this.statusHandlers.add(cb)
    cb(this.connected)
    return () => this.statusHandlers.delete(cb)
  }

  destroy() {
    this.destroyed = true
    clearTimeout(this.retryTimer)
    try { this.conn?.close() } catch { /* already closed */ }
    try { this.peer?.destroy() } catch { /* already destroyed */ }
  }
}
