import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import VideoTile from '../components/VideoTile'
import FilterPicker from '../components/FilterPicker'
import Chat from '../components/Chat'
import ExportPanel from '../components/ExportPanel'
import { getFilter } from '../lib/filters'
import { ParticleEngine } from '../lib/particles'
import { FaceFilterEngine } from '../lib/faceFilters'
import { RoomConnection } from '../lib/room'
import { countdownBeep, shutterSound } from '../lib/sound'

export default function Room() {
  const { roomId } = useParams()

  const roomRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const pendingShotRef = useRef(null)
  const engineRef = useRef(null)

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

  // ---- Overlay engine (particles or face tracking) follows the selected filter ----
  const [engine, setEngine] = useState(null)
  useEffect(() => {
    if (myFilter.face) setEngine(new FaceFilterEngine(myFilter.face, () => localVideoRef.current))
    else if (myFilter.overlay) setEngine(new ParticleEngine(myFilter.overlay))
    else setEngine(null)
  }, [myFilter.face, myFilter.overlay])
  engineRef.current = engine
  if (engine) engine.mirrored = mirror

  // Refs so the countdown timer always reads current values
  const filterIdRef = useRef(filterId)
  filterIdRef.current = filterId
  const mirrorRef = useRef(mirror)
  mirrorRef.current = mirror
  const mySideRef = useRef(mySide)
  mySideRef.current = mySide
  const partnerRef = useRef(partner)
  partnerRef.current = partner

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
    const eng = engineRef.current
    if (eng && eng.previewW) {
      eng.draw(ctx, canvas.width, canvas.height, eng.previewW, eng.previewH)
    }
    return canvas.toDataURL('image/jpeg', 0.85)
  }, [])

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
      roomRef.current?.sendPhoto(mine, mySideRef.current)
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

  // ---- Room connection (PeerJS) + camera ----
  useEffect(() => {
    const name = sessionStorage.getItem('lovebooth-name') || 'Anonymous'

    const room = new RoomConnection(roomId, name, {
      onState: ({ mySide: side, partner: p }) => {
        setMySide(side)
        setPartner(p)
      },
      onCountdown: (seconds) => runCountdown(seconds),
      onPartnerPhoto: ({ img, side }) => {
        const pending = pendingShotRef.current
        if (pending) {
          clearTimeout(pending.timer)
          pendingShotRef.current = null
          finishShot(pending.mine, img, side)
        }
      },
      onPartnerFilter: (fid) => setPartnerFilterId(fid),
      onChat: (msg) => {
        setMessages((prev) => [...prev, msg])
        setUnread((u) => u + 1)
      },
      onSwitchRequested: () => setSwitchIncoming(true),
      onSwitchResult: (accepted) => {
        setSwitchPending(false)
        setSwitchIncoming(false)
        showToast(accepted ? 'Sides switched! 🔄' : 'Your partner kept the sides as they are.')
      },
      onPartnerLeft: () => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
        showToast('Your partner left the room.')
      },
      onRemoteStream: (stream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
      },
      onFull: () => setRoomFull(true),
      onError: (e) => showToast(`Connection problem: ${e}. Retrying…`),
    })
    roomRef.current = room
    window.__lovebooth = room // debugging hook

    navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      })
      .then((stream) => {
        localStreamRef.current = stream
        setLocalStream(stream)
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
        room.attachStream(stream)
      })
      .catch((err) => setCameraError(err.message || 'Camera access was denied.'))

    return () => {
      room.destroy()
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
    roomRef.current?.setReady(next)
  }

  const pickFilter = (fid) => {
    setFilterId(fid)
    roomRef.current?.sendFilter(fid)
  }

  const sendChat = (text) => {
    const msg = roomRef.current?.sendChat(text)
    if (msg) setMessages((prev) => [...prev, msg])
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
              onClick={() => { setSwitchPending(true); roomRef.current?.requestSwitch() }}
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
            <Chat messages={messages} selfId="me" onSend={sendChat} />
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
                onClick={() => { roomRef.current?.respondSwitch(true); setSwitchIncoming(false) }}
                className="clay-btn px-6 py-2.5 bg-primary hover:bg-primary-dark text-white"
              >
                Switch!
              </button>
              <button
                onClick={() => { roomRef.current?.respondSwitch(false); setSwitchIncoming(false) }}
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
