import { useEffect, useRef, useState } from 'react'
import SpaceHeader from '../components/SpaceHeader'
import { useCouple, useSharedState, useCoupleMessage } from '../context/CoupleContext'

// Pull the video id out of any common YouTube URL form.
function parseId(input) {
  if (!input) return null
  const s = input.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)
  return m ? m[1] : null
}

function loadYT() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(window.YT)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev && prev(); resolve(window.YT) }
    if (!document.getElementById('yt-api')) {
      const s = document.createElement('script')
      s.id = 'yt-api'
      s.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(s)
    }
  })
}

export default function Watch() {
  const { connected } = useCouple()
  const [watch, setWatch] = useSharedState('watch', null) // { videoId }
  const [urlInput, setUrlInput] = useState('')
  const [ready, setReady] = useState(false)
  const hostElRef = useRef(null)
  const playerRef = useRef(null)
  const applyingRemote = useRef(false)

  const sendControl = useCoupleMessage('watch-control', (msg) => {
    const p = playerRef.current
    if (!p) return
    applyingRemote.current = true
    try {
      if (typeof msg.time === 'number') p.seekTo(msg.time, true)
      if (msg.action === 'play') p.playVideo()
      else if (msg.action === 'pause') p.pauseVideo()
    } catch { /* player not ready */ }
    setTimeout(() => { applyingRemote.current = false }, 700)
  })

  // Create the player once.
  useEffect(() => {
    let cancelled = false
    loadYT().then((YT) => {
      if (cancelled || !hostElRef.current) return
      playerRef.current = new YT.Player(hostElRef.current, {
        width: '100%', height: '100%',
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onReady: () => { setReady(true); if (watch?.videoId) playerRef.current.cueVideoById(watch.videoId) },
          onStateChange: (e) => {
            if (applyingRemote.current) return
            const p = playerRef.current
            const time = p?.getCurrentTime?.() || 0
            if (e.data === window.YT.PlayerState.PLAYING) sendControl({ action: 'play', time })
            else if (e.data === window.YT.PlayerState.PAUSED) sendControl({ action: 'pause', time })
          },
        },
      })
    })
    return () => { cancelled = true; try { playerRef.current?.destroy() } catch { /* ignore */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load a new shared video when it changes.
  useEffect(() => {
    if (ready && watch?.videoId && playerRef.current) {
      try { playerRef.current.cueVideoById(watch.videoId) } catch { /* ignore */ }
    }
  }, [ready, watch?.videoId])

  const loadUrl = () => {
    const id = parseId(urlInput)
    if (!id) return
    setWatch({ videoId: id, at: Date.now() })
    setUrlInput('')
  }

  // Manual "sync us" — push my current position + state to my partner.
  const syncNow = () => {
    const p = playerRef.current
    if (!p) return
    const state = p.getPlayerState?.()
    sendControl({ action: state === window.YT?.PlayerState?.PLAYING ? 'play' : 'pause', time: p.getCurrentTime?.() || 0 })
  }

  return (
    <div className="p-4 lg:p-6">
      <SpaceHeader title="Watch" back />
      <main className="max-w-2xl mx-auto space-y-4">
        <div className="clay p-4">
          <div className="flex gap-2">
            <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUrl()}
              placeholder="Paste a YouTube link…"
              className="flex-1 px-4 py-3 rounded-2xl border-2 border-rose-200 focus:border-primary focus:outline-none bg-cream/40 text-ink placeholder:text-ink/40" />
            <button onClick={loadUrl} className="clay-btn px-6 py-3 bg-primary hover:bg-primary-dark text-white">Load</button>
          </div>
          {!connected && <p className="text-xs text-amber-600 mt-2">Your partner isn't online yet — they'll get the video and your play/pause once connected.</p>}
        </div>

        <div className="clay p-3">
          <div className="rounded-2xl overflow-hidden bg-black aspect-video">
            {watch?.videoId ? (
              <div ref={hostElRef} className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/70">
                <span className="text-4xl mb-2">🍿</span>
                <p className="text-sm">Paste a YouTube link to watch together</p>
                {/* keep host mounted so the player can attach */}
                <div ref={hostElRef} className="hidden" />
              </div>
            )}
          </div>
          {watch?.videoId && (
            <div className="flex items-center gap-2 mt-3">
              <p className="text-xs text-ink/55 flex-1">Play, pause, and seek stay in sync between you. If you drift, tap Re-sync.</p>
              <button onClick={syncNow} className="clay-btn px-4 py-2 bg-secondary hover:bg-rose-500 text-white text-sm">Re-sync</button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
