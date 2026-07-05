// Countdown beeps + shutter sound via WebAudio (no audio files needed)
let ctx

function audioCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

export function beep(freq = 660, duration = 0.12, volume = 0.15) {
  try {
    const ac = audioCtx()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.frequency.value = freq
    osc.type = 'sine'
    gain.gain.setValueAtTime(volume, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
    osc.connect(gain).connect(ac.destination)
    osc.start()
    osc.stop(ac.currentTime + duration)
  } catch {
    /* audio not available — countdown still works silently */
  }
}

export function countdownBeep(secondsLeft) {
  beep(secondsLeft <= 3 ? 880 : 660, 0.1, secondsLeft <= 3 ? 0.2 : 0.12)
}

export function shutterSound() {
  beep(1200, 0.06, 0.25)
  setTimeout(() => beep(500, 0.1, 0.2), 70)
}
