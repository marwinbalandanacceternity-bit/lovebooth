// Peer-to-peer room connection built on PeerJS (free cloud signaling).
// No backend needed: the first person to claim the room's peer ID becomes
// the host; everyone else joins as a guest. All events (ready/countdown,
// photos, chat, filters, side switching) travel over the WebRTC data
// channel, with the host as the authority for shared state.

import Peer from 'peerjs'

// STUN for discovery + free TURN relay so video connects even on mobile
// carrier NAT (phone-to-phone over LTE) and strict networks.
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
]

const COUNTDOWN_SECONDS = 8
const RETRY_MS = 3000

// A shared id both partners stamp on the same capture, so their two photos
// can be paired deterministically regardless of who captures/arrives first.
const newShotId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export class RoomConnection {
  constructor(roomId, name, handlers) {
    this.roomId = roomId
    this.name = name || 'Anonymous'
    this.h = handlers
    this.hostId = `lovebooth-${roomId}`
    this.isHost = false
    this.peer = null
    this.conn = null
    this.mediaCall = null
    this.localStream = null
    this.destroyed = false
    this.retryTimer = null
    this.callTimer = null
    this.meReady = false
    // Host-authoritative shared state
    this.state = { hostSide: 'left', hostReady: false, guestReady: false, hostName: this.name, guestName: null }
    this._start()
  }

  _start() {
    // Try to claim the room ID; if taken, someone is hosting — join as guest.
    const peer = new Peer(this.hostId, { config: { iceServers: ICE_SERVERS } })
    this.peer = peer
    peer.on('open', () => {
      if (this.destroyed) return
      this.isHost = true
      this.h.onRole?.(true)
      this._emitState()
    })
    peer.on('error', (err) => {
      if (this.destroyed) return
      if (err.type === 'unavailable-id') {
        peer.destroy()
        this._startGuest()
      } else if (err.type !== 'peer-unavailable') {
        this.h.onError?.(err.type || String(err))
      }
    })
    peer.on('connection', (c) => this._onIncomingConnection(c))
    peer.on('call', (call) => this._onIncomingCall(call))
  }

  _startGuest() {
    const peer = new Peer({ config: { iceServers: ICE_SERVERS } })
    this.peer = peer
    peer.on('open', () => {
      if (this.destroyed) return
      this.isHost = false
      this.h.onRole?.(false)
      this._emitState()
      this._connectToHost()
    })
    peer.on('error', (err) => {
      if (this.destroyed) return
      if (err.type === 'peer-unavailable') {
        // Host isn't there (yet) — keep retrying, they may arrive after us.
        this._scheduleRetry()
      } else if (err.type !== 'unavailable-id') {
        this.h.onError?.(err.type || String(err))
      }
    })
    peer.on('call', (call) => this._onIncomingCall(call))
  }

  _connectToHost() {
    if (this.destroyed || this.conn?.open) return
    const c = this.peer.connect(this.hostId, { reliable: true, metadata: { name: this.name } })
    this._wireConnection(c)
  }

  _scheduleRetry() {
    if (this.destroyed) return
    clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(() => this._connectToHost(), RETRY_MS)
  }

  _onIncomingConnection(c) {
    if (this.conn && this.conn.open) {
      // Rooms fit exactly two people
      c.on('open', () => {
        c.send({ t: 'full' })
        setTimeout(() => c.close(), 500)
      })
      return
    }
    this.conn = c
    this._wireConnection(c)
  }

  _wireConnection(c) {
    this.conn = c
    c.on('open', () => {
      if (this.destroyed) return
      if (this.isHost) {
        this.state.guestName = c.metadata?.name || 'Partner'
        this._broadcastState()
        // If the guest can't send video (camera denied), call them ourselves
        clearTimeout(this.callTimer)
        this.callTimer = setTimeout(() => this._maybeCall(), 2500)
      } else {
        this._maybeCall()
      }
      this._emitState()
    })
    c.on('data', (d) => this._onData(d))
    c.on('close', () => {
      if (this.destroyed) return
      this.conn = null
      this.mediaCall = null
      if (this.isHost) {
        this.state.guestReady = false
        this.state.guestName = null
      }
      this.h.onPartnerLeft?.()
      this._emitState()
      if (!this.isHost) this._scheduleRetry()
    })
  }

  _onIncomingCall(call) {
    this.mediaCall = call
    call.answer(this.localStream || undefined)
    call.on('stream', (s) => this.h.onRemoteStream?.(s))
  }

  _maybeCall() {
    if (this.destroyed || this.mediaCall || !this.localStream || !this.conn?.open) return
    const call = this.peer.call(this.conn.peer, this.localStream)
    if (!call) return
    this.mediaCall = call
    call.on('stream', (s) => this.h.onRemoteStream?.(s))
  }

  _onData(d) {
    if (!d || typeof d !== 'object') return
    switch (d.t) {
      case 'full':
        this.h.onFull?.()
        break
      case 'state': {
        // Guest receives host-authoritative state
        this.state = { ...this.state, ...d.s }
        this._emitState()
        break
      }
      case 'ready': {
        if (this.isHost) {
          this.state.guestReady = !!d.v
          this._broadcastState()
          this._checkCountdown()
        }
        break
      }
      case 'countdown':
        this.h.onCountdown?.(d.seconds || COUNTDOWN_SECONDS, d.shotId)
        break
      case 'photo':
        this.h.onPartnerPhoto?.({ img: d.img, side: d.side, shotId: d.shotId })
        break
      case 'filter':
        this.h.onPartnerFilter?.(d.id)
        break
      case 'chat':
        this.h.onChat?.({ text: d.text, name: d.name, ts: d.ts, from: 'them' })
        break
      case 'switch-req':
        this.h.onSwitchRequested?.()
        break
      case 'switch-res': {
        if (d.accepted && this.isHost) this._swapSides()
        this.h.onSwitchResult?.(!!d.accepted)
        break
      }
      default:
        break
    }
  }

  _swapSides() {
    this.state.hostSide = this.state.hostSide === 'left' ? 'right' : 'left'
    this._broadcastState()
    this._emitState()
  }

  _emitState() {
    const mySide = this.isHost
      ? this.state.hostSide
      : this.state.hostSide === 'left' ? 'right' : 'left'
    const connected = !!this.conn?.open
    const partner = connected
      ? this.isHost
        ? { name: this.state.guestName || 'Partner', ready: this.state.guestReady }
        : { name: this.state.hostName || 'Partner', ready: this.state.hostReady }
      : null
    this.h.onState?.({ mySide, partner })
  }

  _broadcastState() {
    if (this.isHost && this.conn?.open) {
      const { hostSide, hostReady, guestReady, hostName } = this.state
      this.conn.send({ t: 'state', s: { hostSide, hostReady, guestReady, hostName } })
    }
    this._emitState()
  }

  _checkCountdown() {
    if (!this.isHost) return
    if (this.state.hostReady && this.state.guestReady) {
      this.state.hostReady = false
      this.state.guestReady = false
      const shotId = newShotId()
      this.conn?.send({ t: 'countdown', seconds: COUNTDOWN_SECONDS, shotId })
      this._broadcastState()
      this.h.onCountdown?.(COUNTDOWN_SECONDS, shotId)
    }
  }

  // ---------- public API ----------

  attachStream(stream) {
    this.localStream = stream
    this._maybeCall()
  }

  setReady(v) {
    this.meReady = v
    if (!this.conn?.open) {
      // Solo mode: no partner yet, countdown starts right away
      if (v) this.h.onCountdown?.(COUNTDOWN_SECONDS, newShotId())
      return
    }
    if (this.isHost) {
      this.state.hostReady = v
      this._broadcastState()
      this._checkCountdown()
    } else {
      this.conn.send({ t: 'ready', v })
    }
  }

  sendPhoto(img, side, shotId) {
    this.conn?.open && img && this.conn.send({ t: 'photo', img, side, shotId })
  }

  sendFilter(id) {
    this.conn?.open && this.conn.send({ t: 'filter', id })
  }

  sendChat(text) {
    const msg = { t: 'chat', text: String(text).slice(0, 500), name: this.name, ts: Date.now() }
    this.conn?.open && this.conn.send(msg)
    return { ...msg, from: 'me' }
  }

  requestSwitch() {
    this.conn?.open && this.conn.send({ t: 'switch-req' })
  }

  respondSwitch(accepted) {
    if (accepted && this.isHost) this._swapSides()
    this.conn?.open && this.conn.send({ t: 'switch-res', accepted })
  }

  destroy() {
    this.destroyed = true
    clearTimeout(this.retryTimer)
    clearTimeout(this.callTimer)
    try { this.conn?.close() } catch { /* already closed */ }
    try { this.peer?.destroy() } catch { /* already destroyed */ }
  }
}
