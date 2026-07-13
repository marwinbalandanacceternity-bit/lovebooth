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
  // shotId -> { mine?, partner?, partnerSide?, timer, done } — pairs each
  // countdown's two photos deterministically, whoever captures/arrives first.
  const shotsMapRef = useRef(new Map())
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
  const [hasMic, setHasMic] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [speakerOn, setSpeakerOn] = useState(true)

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
  const micOnRef = useRef(true)
  const partnerRef = useRef(partner)
  partnerRef.current = partner

  // ---- Capture one frame of my own camera (filter + mirror + overlay baked in) ----
  const captureFrame = useCallback(() => {
    const video = localVideoRef.current
    if (!video || !video.videoWidth) return null
    // Cap at 1280px wide: phones capture 1920+ and the resulting payload can
    // be too large to transfer reliably over the data channel on mobile data.
    const scale = Math.min(1, 1280 / video.videoWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    const f = getFilter(filterIdRef.current)
    if (f.css !== 'none') ctx.filter = f.css
    if (mirrorRef.current) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
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
    const other = side === 'left' ? 'right' : 'left'
    const shot = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }
    if (mine) shot[side] = mine
    if (partnerImg) shot[partnerSide || other] = partnerImg
    // Fill any empty side by duplicating whatever we have so every layout renders.
    if (!shot.left && shot.right) shot.left = shot.right
    if (!shot.right && shot.left) shot.right = shot.left
    if (!shot.left && !shot.right) {
      showToast('Nothing was captured — check your camera and try again.')
      return
    }
    setShots((prev) => [...prev, shot])
    showToast(mine && partnerImg ? 'Photo of you two saved! 💕' : 'Photo saved to your strip! 📸')
  }, [])

  // ---- Deterministic pairing of the two photos from one countdown ----
  const PAIR_WAIT_MS = 15000
  const resolveShot = useCallback((shotId) => {
    const map = shotsMapRef.current
    const e = map.get(shotId)
    if (!e || e.done) return
    const haveMine = 'mine' in e
    const havePartner = 'partner' in e
    // Complete once both sides are in, or when the wait window expires.
    if ((haveMine && havePartner) || e.expired) {
      e.done = true
      clearTimeout(e.timer)
      map.delete(shotId)
      finishShot(e.mine ?? null, e.partner ?? null, e.partnerSide)
    }
  }, [finishShot])

  const recordShot = useCallback((shotId, patch) => {
    if (!shotId) return
    const map = shotsMapRef.current
    let e = map.get(shotId)
    if (!e) {
      e = {
        timer: setTimeout(() => {
          const cur = map.get(shotId)
          if (cur) { cur.expired = true; resolveShot(shotId) }
        }, PAIR_WAIT_MS),
      }
      map.set(shotId, e)
    }
    Object.assign(e, patch)
    resolveShot(shotId)
  }, [resolveShot])

  const runCountdown = useCallback((seconds, shotId) => {
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
      const solo = !partnerRef.current

      // Send our frame to the partner tagged with this shot's id.
      if (mine) roomRef.current?.sendPhoto(mine, mySideRef.current, shotId)

      if (solo) {
        // No partner connected — save immediately (duplicate for the layout).
        if (mine) finishShot(mine, null)
        else showToast('Could not capture — is your camera on?')
        return
      }

      // Partnered: record our capture (even a failed one) under the shared
      // shot id. The partner's frame merges in whenever it arrives, then the
      // pair is saved. If nothing arrives in time, resolveShot saves what we have.
      recordShot(shotId, { mine: mine ?? null })
    }, 1000)
  }, [captureFrame, finishShot, recordShot])

  // ---- Room connection (PeerJS) + camera ----
  useEffect(() => {
    const name = sessionStorage.getItem('lovebooth-name') || localStorage.getItem('lovebooth-name') || 'Anonymous'

    const room = new RoomConnection(roomId, name, {
      onState: ({ mySide: side, partner: p }) => {
        setMySide(side)
        setPartner(p)
      },
      onCountdown: (seconds, shotId) => runCountdown(seconds, shotId),
      onPartnerPhoto: ({ img, side, shotId }) => {
        // Merge the partner's frame into the shared shot; whether our own
        // capture already happened or not, resolveShot pairs them correctly.
        recordShot(shotId || `orphan-${Date.now()}`, { partner: img, partnerSide: side })
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

    const videoConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
    // Echo cancellation + noise suppression so partners can talk without a
    // feedback loop or hiss; auto gain keeps voices level.
    const audioConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    const setup = (stream) => {
      localStreamRef.current = stream
      setLocalStream(stream)
      const track = stream.getAudioTracks()[0]
      setHasMic(!!track)
      // Start muted-out if the user had toggled the mic off before (re)mount.
      if (track) track.enabled = micOnRef.current
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
      room.attachStream(stream)
    }

    navigator.mediaDevices
      .getUserMedia({ video: videoConstraints, audio: audioConstraints })
      .then(setup)
      .catch(() =>
        // Mic denied/unavailable shouldn't kill the camera — retry video-only.
        navigator.mediaDevices
          .getUserMedia({ video: videoConstraints, audio: false })
          .then(setup)
          .catch((err) => setCameraError(err.message || 'Camera access was denied.'))
      )

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

  // Mute/unmute my microphone (toggles the outgoing audio track).
  const toggleMic = () => {
    setMicOn((on) => {
      const next = !on
      micOnRef.current = next
      const track = localStreamRef.current?.getAudioTracks?.()[0]
      if (track) track.enabled = next
      return next
    })
  }

  // Speaker: mute/unmute my partner's voice on their video tile.
  const toggleSpeaker = () => setSpeakerOn((on) => !on)

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
          muted={!speakerOn}
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
        <Link to="/memories" className="px-3 py-1.5 rounded-full text-sm font-display text-primary hover:bg-rose-100 transition-colors duration-200">
          Memories
        </Link>
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
              onClick={toggleMic}
              disabled={!hasMic}
              className={`clay-btn px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed ${micOn && hasMic ? 'bg-ink text-white' : 'bg-rose-100 text-ink hover:bg-rose-200'}`}
              aria-pressed={micOn && hasMic}
              title={hasMic ? 'Turn your microphone on/off' : 'No microphone available'}
            >
              {micOn && hasMic ? '🎤 Mic on' : '🔇 Mic off'}
            </button>
            <button
              onClick={toggleSpeaker}
              className={`clay-btn px-4 py-2 text-sm ${speakerOn ? 'bg-ink text-white' : 'bg-rose-100 text-ink hover:bg-rose-200'}`}
              aria-pressed={speakerOn}
              title="Hear your partner / mute them"
            >
              {speakerOn ? '🔊 Sound on' : '🔈 Sound off'}
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
          {tab === 'strip' && (
            <ExportPanel
              shots={shots}
              roomId={roomId}
              onReset={() => setShots([])}
              onDeleteShot={(id) => setShots((prev) => prev.filter((s) => s.id !== id))}
              onToast={showToast}
            />
          )}
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
