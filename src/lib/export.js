import { jsPDF } from 'jspdf'
import JSZip from 'jszip'

function timestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
}

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export function downloadComposedPng(canvas) {
  downloadDataUrl(canvas.toDataURL('image/png'), `lovebooth-strip-${timestamp()}.png`)
}

export function downloadIndividuals(shots) {
  shots.forEach((shot, i) => {
    downloadDataUrl(shot.left, `lovebooth-photo${i + 1}-left.jpg`)
    downloadDataUrl(shot.right, `lovebooth-photo${i + 1}-right.jpg`)
  })
}

// PDF: page 1 = composed layout, then one page per individual photo
export async function downloadPdf(canvas, shots) {
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height],
    hotfixes: ['px_scaling'],
  })
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, canvas.width, canvas.height)

  for (const shot of shots) {
    for (const side of ['left', 'right']) {
      const img = await loadImage(shot[side])
      pdf.addPage([img.width, img.height], img.width > img.height ? 'landscape' : 'portrait')
      pdf.addImage(shot[side], 'JPEG', 0, 0, img.width, img.height)
    }
  }
  pdf.save(`lovebooth-${timestamp()}.pdf`)
}

// ZIP bundle: composed PNG + all individual photos
export async function downloadZip(canvas, shots) {
  const zip = new JSZip()
  zip.file('lovebooth-strip.png', canvas.toDataURL('image/png').split(',')[1], { base64: true })
  shots.forEach((shot, i) => {
    zip.file(`photo${i + 1}-left.jpg`, shot.left.split(',')[1], { base64: true })
    zip.file(`photo${i + 1}-right.jpg`, shot.right.split(',')[1], { base64: true })
  })
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  downloadDataUrl(url, `lovebooth-${timestamp()}.zip`)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
