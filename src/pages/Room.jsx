import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { io } from 'socket.io-client'
import VideoTile from '../components/VideoTile'
import FilterPicker from '../components/FilterPicker'
import Chat from '../components/Chat'
import ExportPanel from '../components/ExportPanel'
import { getFilter } from '../lib/filters'
import { ParticleEngine } from '../lib/particles'
import { countdownBeep, shutterSound } from '../lib/sound'

// STUN for discovery + free TURN relay so video connects even on mobile
// carrier NAT (phone-to-phone over LTE) and strict networks.
const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
}

export default function Room() {
  const { roomId } = useParams()

  const socketRef = useRef(null)
  const pcRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const pendingShotRef = useRef(null)
  const engineRef = useRef(null)

  const [selfId, setSelfId] = useState(null)
  const [mySide, setMySide] = useState('left')
  const [partner, setPartner] = useState(null) // { name, ready }
  const [meReady, setMeReady] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [flash, setFlash] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [roomFull, setRoomFull] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mirror, setMirror] = useState(true)
  const [filterId, setFilterId] = useState('none')
  const [partnerFilterId, setPartnerFilterId] = useState('none')
  const [shots, setShots] = useState([])
  const [messages, setMessages] = useState([])
  const [tab, setTab] = useState('filters')
  const [unread, setUnread] = useState(0)
  const [switchIncoming, setSwitchIncoming] = useState(false)
  const [switchPending, setSwitchPending] = useState(false)
  const [toast, setToast] = useState(null)
  const [localStream, setLocalStream] = useState(null)

  const myFilter = getFilter(filterId)
  const partnerFilter = getFilter(partnerFilterId)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  // ---- Particle overlay engine follows the selected filter ----
  const [engine, setEngine] = useState(null)
  useEffect(() => {
    setEngine(myFilter.overlay ? new ParticleEngine(myFilter.overlay) : null)
  }, [myFilter.overlay])
  engineRef.current = engine

  // ---- Capture one frame of my own camera (filter + mirror + overlay baked in) ----
  const captureFrame = useCallback(() => {
    const video = localVideoRef.current
    if (!video || !video.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    const f = getFilter(filterIdRef.current)
    if (f.css !== 'none') ctx.filter = f.css
    if (mirrorRef.current) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.filter = 'none'
    const engine = engineRef.current
    if (engine && engine.previewW) {
      engine.draw(ctx, canvas.width, canvas.height, engine.previewW, engine.previewH)
    }
    return canvas.toDataURL('image/jpeg', 0.92)
  }, [])

  // Refs so the countdown timer always reads current values
  const filterIdRef = useRef(filterId)
  filterIdRef.current = filterId
  const mirrorRef = useRef(mirror)
  mirrorRef.current = mirror
  const mySideRef = useRef(mySide)
  mySideRef.current = mySide
  const partnerRef = useRef(partner)
  partnerRef.current = partner

  const finishShot = useCallback((mine, partnerImg, partnerSide) => {
    const side = mySideRef.current
    const shot = { id: Date.now() }
    shot[side] = mine
    if (partnerImg) {
      shot[partnerSide] = partnerImg
    } else {
      // Solo mode: duplicate my photo so layouts still work
      shot[side === 'left' ? 'right' : 'left'] = mine
    }
    setShots((prev) => [...prev, shot])
    showToast('Photo saved to your strip! 📸')
  }, [])

  const runCountdown = useCallback((seconds) => {
    setMeReady(false)
    let s = seconds
    setCountdown(s)
    countdownBeep(s)
    const interval = setInterval(() => {
      s -= 1
      if (s > 0) {
        setCountdown(s)
        countdownBeep(s)
        return
      }
      clearInterval(interval)
      setCountdown(null)
      setFlash(true)
      setTimeout(() => setFlash(false), 500)
      shutterSound()

      const mine = captureFrame()
      if (!mine) {
        showToast('Could not capture — is your camera on?')
        return
      }
      const solo = !partnerRef.current
      socketRef.current?.emit('photo', { img: mine })
      if (solo) {
        finishShot(mine, null)
      } else {
        // wait for partner's frame (they send theirs at the same moment)
        pendingShotRef.current = { mine, timer: setTimeout(() => {
          if (pendingShotRef.current) {
            finishShot(pendingShotRef.current.mine, null)
            pendingShotRef.current = null
            showToast("Partner's photo didn't arrive — saved yours solo.")
          }
        }, 8000) }
      }
    }, 1000)
  }, [captureFrame, finishShot])

  // ---- Socket + WebRTC setup ----
  useEffect(() => {
    const socket = io()
    socketRef.current = socket
    const name = sessionStorage.getItem('lovebooth-name') || 'Anonymous'

    const createPeer = () => {
      if (pcRef.current) pcRef.current.close()
      const pc = new RTCPeerConnection(ICE)
      pcRef.current = pc
      localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current))
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('signal', { type: 'candidate', candidate: e.candidate })
      }
      pc.ontrack = (e) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]
      }
      return pc
    }

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        })
        localStreamRef.current = stream
        setLocalStream(stream)
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
      } catch (err) {
        setCameraError(err.message || 'Camera access was denied.')
      }

      socket.emit('join-room', { roomId, name }, (res) => {
        if (res?.error) {
          setRoomFull(true)
          return
        }
        setSelfId(socket.id)
        setMySide(res.side)
      })
    }

    socket.on('room-state', ({ users }) => {
      const me = users.find((u) => u.id === socket.id)
      const other = users.find((u) => u.id !== socket.id)
      if (me) {
        setMySide(me.side)
        setMeReady(me.ready)
      }
      setPartner(other ? { name: other.name, ready: other.ready } : null)
    })

    socket.on('start-call', async () => {
      const pc = createPeer()
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('signal', { type: 'offer', sdp: offer })
    })

    socket.on('signal', async (data) => {
      if (data.type === 'offer') {
        const pc = createPeer()
        await pc.setRemoteDescription(data.sdp)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('signal', { type: 'answer', sdp: answer })
      } else if (data.type === 'answer') {
        await pcRef.current?.setRemoteDescription(data.sdp)
      } else if (data.type === 'candidate') {
        try { await pcRef.current?.addIceCandidate(data.candidate) } catch { /* ignore stale candidates */ }
      }
    })

    socket.on('countdown-start', ({ seconds }) => runCountdown(seconds))

    socket.on('partner-photo', ({ img, side }) => {
      const pending = pendingShotRef.current
      if (pending) {
        clearTimeout(pending.timer)
        pendingShotRef.current = null
        finishShot(pending.mine, img, side)
      }
    })

    socket.on('partner-filter', (fid) => setPartnerFilterId(fid))

    socket.on('switch-requested', () => setSwitchIncoming(true))
    socket.on('switch-result', ({ accepted }) => {
      setSwitchPending(false)
      setSwitchIncoming(false)
      showToast(accepted ? 'Sides switched! 🔄' : 'Your partner kept the sides as they are.')
    })

    socket.on('chat', (msg) => {
      setMessages((prev) => [...prev, msg])
      setUnread((u) => u + 1)
    })

    socket.on('partner-left', () => {
      setPartner(null)
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
      showToast('Your partner left the room.')
    })

    start()

    return () => {
      socket.disconnect()
      pcRef.current?.close()
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  useEffect(() => {
    if (tab === 'chat') setUnread(0)
  }, [tab, messages])

  // Re-attach the local stream if the video element re-mounts
  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream
  })

  const toggleReady = () => {
    const next = !meReady
    setMeReady(next)
    socketRef.current?.emit('set-ready', next)
  }

  const pickFilter = (fid) => {
    setFilterId(fid)
    socketRef.current?.emit('filter-changed', fid)
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (roomFull) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="clay p-8 text-center max-w-sm">
          <h1 className="text-2xl text-primary mb-2">Room is full</h1>
          <p className="text-ink/70 mb-4">LoveBooth rooms fit exactly two people.</p>
          <Link to="/" className="clay-btn inline-block px-6 py-3 bg-primary text-white">Create your own room</Link>
        </div>
      </div>
    )
  }

  const tiles = [
    {
      key: 'me',
      side: mySide,
      el: (
        <VideoTile
          key="me"
          videoRef={localVideoRef}
          label="You"
          side={mySide}
          ready={meReady}
          mirrored={mirror}
          filterCss={myFilter.css}
          overlayEngine={engine}
          connected={!!localStream}
          isSelf
        />
      ),
    },
    {
      key: 'partner',
      side: mySide === 'left' ? 'right' : 'left',
      el: (
        <VideoTile
          key="partner"
          videoRef={remoteVideoRef}
          label={partner?.name || 'Partner'}
          side={mySide === 'left' ? 'right' : 'left'}
          ready={!!partner?.ready}
          mirrored={false}
          filterCss={partnerFilter.css}
          connected={!!partner}
        />
      ),
    },
  ].sort((a, b) => (a.side === 'left' ? -1 : 1) - (b.side === 'left' ? -1 : 1))

  return (
    <div className="min-h-screen p-4 lg:p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 mb-4 max-w-7xl mx-auto">
        <Link to="/" className="font-display text-2xl font-semibold text-primary">LoveBooth</Link>
        <span className="px-3 py-1 rounded-full bg-rose-100 text-ink text-sm font-mono">{roomId}</span>
        <button onClick={copyLink} className="clay-btn px-4 py-1.5 bg-secondary hover:bg-rose-500 text-white text-sm">
          {copied ? 'Copied! ✓' : 'Copy invite link'}
        </button>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className={`w-2.5 h-2.5 rounded-full ${partner ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} aria-hidden="true" />
          <span className="text-ink/70">{partner ? `${partner.name} is here` : 'Waiting for partner…'}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_360px] gap-4">
        {/* Left: booth */}
        <div className="space-y-4 min-w-0">
          <div className="relative">
            <div className="flex flex-col sm:flex-row gap-3">{tiles.map((t) => t.el)}</div>

            {/* Countdown overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <span key={countdown} className="countdown-pop font-display text-[6rem] sm:text-[10rem] leading-none font-bold text-white drop-shadow-[0_4px_24px_rgba(225,29,72,0.8)]">
                  {countdown}
                </span>
              </div>
            )}
            {/* Flash */}
            {flash && <div className="flash-overlay absolute inset-0 bg-white z-30 rounded-3xl" />}
          </div>

          {cameraError && (
            <div className="clay p-4 border-2 border-amber-300 bg-amber-50 text-amber-900 text-sm" role="alert">
              Camera problem: {cameraError} — check browser permissions and reload.
            </div>
          )}

          {/* Controls */}
          <div className="clay p-4 flex flex-wrap items-center gap-3">
            <button
              onClick={toggleReady}
              disabled={countdown !== null || !localStream}
              className={`clay-btn px-8 py-3.5 text-lg text-white ${
                meReady ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-primary hover:bg-primary-dark'
              }`}
            >
              {meReady ? 'Ready ✓ (tap to cancel)' : 'I’m Ready!'}
            </button>
            <p className="text-sm text-ink/60 flex-1 min-w-40">
              {countdown !== null
                ? 'Strike a pose!'
                : meReady && partner && !partner.ready
                ? `Waiting for ${partner.name} to press ready…`
                : partner
                ? 'When you both press ready, an 8-second countdown starts.'
                : 'You can take solo test shots while you wait.'}
            </p>
            <button
              onClick={() => setMirror((m) => !m)}
              className={`clay-btn px-4 py-2 text-sm ${mirror ? 'bg-ink text-white' : 'bg-rose-100 text-ink hover:bg-rose-200'}`}
              aria-pressed={mirror}
            >
              Mirror: {mirror ? 'On' : 'Off'}
            </button>
            <button
              onClick={() => { setSwitchPending(true); socketRef.current?.emit('request-switch') }}
              disabled={!partner || switchPending}
              className="clay-btn px-4 py-2 bg-cta hover:bg-orange-600 text-white text-sm"
            >
              {switchPending ? 'Asking…' : 'Request side switch'}
            </button>
          </div>
        </div>

        {/* Right: tabs panel */}
        <div className="clay p-4 h-fit lg:sticky lg:top-4">
          <div className="flex gap-1 mb-4 bg-rose-50 p-1 rounded-2xl">
            {[
              ['filters', 'Filters'],
              ['strip', 'Strip & Save'],
              ['chat', unread > 0 ? `Chat (${unread})` : 'Chat'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-2 rounded-xl text-sm font-display cursor-pointer transition-colors duration-200 ${
                  tab === id ? 'bg-white text-primary shadow-sm' : 'text-ink/60 hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'filters' && (
            <FilterPicker selected={filterId} onSelect={pickFilter} previewStream={localStream} />
          )}
          {tab === 'strip' && <ExportPanel shots={shots} />}
          {tab === 'chat' && (
            <Chat messages={messages} selfId={selfId} onSend={(t) => socketRef.current?.emit('chat', t)} />
          )}
        </div>
      </main>

      {/* Switch-sides incoming request modal */}
      {switchIncoming && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="clay p-6 max-w-sm w-full text-center">
            <h2 className="font-display text-xl text-primary mb-2">Switch sides?</h2>
            <p className="text-ink/70 mb-5">{partner?.name || 'Your partner'} wants to swap left and right.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { socketRef.current?.emit('respond-switch', true); setSwitchIncoming(false) }}
                className="clay-btn px-6 py-2.5 bg-primary hover:bg-primary-dark text-white"
              >
                Switch!
              </button>
              <button
                onClick={() => { socketRef.current?.emit('respond-switch', false); setSwitchIncoming(false) }}
                className="clay-btn px-6 py-2.5 bg-rose-100 hover:bg-rose-200 text-ink"
              >
                Keep as is
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl bg-ink text-white text-sm shadow-xl z-50" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
