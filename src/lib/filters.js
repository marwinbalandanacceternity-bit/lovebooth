// Filter library — CSS filter strings applied to the live video preview
// and baked into captures via canvas ctx.filter.

export const FILTER_CATEGORIES = ['Natural', 'Aesthetic', 'B&W / Vintage', 'Fun']

export const FILTERS = [
  // ---------- Natural ----------
  { id: 'none', name: 'Original', category: 'Natural', css: 'none' },
  { id: 'soft-glow', name: 'Soft Glow', category: 'Natural', css: 'brightness(1.08) contrast(0.95) saturate(1.05) blur(0.4px)' },
  { id: 'brighten', name: 'Brighten', category: 'Natural', css: 'brightness(1.15) contrast(1.02)' },
  { id: 'smooth', name: 'Smooth Skin', category: 'Natural', css: 'brightness(1.06) contrast(0.92) saturate(1.08) blur(0.6px)' },
  { id: 'warm', name: 'Warm', category: 'Natural', css: 'brightness(1.05) sepia(0.18) saturate(1.25)' },
  { id: 'cool', name: 'Cool', category: 'Natural', css: 'brightness(1.03) hue-rotate(-8deg) saturate(1.1)' },
  { id: 'peachy', name: 'Peachy', category: 'Natural', css: 'brightness(1.08) sepia(0.12) saturate(1.3) hue-rotate(-5deg)' },
  { id: 'fresh', name: 'Fresh', category: 'Natural', css: 'brightness(1.1) contrast(1.05) saturate(1.15)' },
  { id: 'golden-hour', name: 'Golden Hour', category: 'Natural', css: 'brightness(1.06) sepia(0.28) saturate(1.35) contrast(1.02)' },
  { id: 'rosy', name: 'Rosy', category: 'Natural', css: 'brightness(1.07) saturate(1.2) hue-rotate(-10deg)' },

  // ---------- Aesthetic ----------
  { id: 'pastel-dream', name: 'Pastel Dream', category: 'Aesthetic', css: 'brightness(1.12) contrast(0.85) saturate(0.85)' },
  { id: 'film', name: 'Film', category: 'Aesthetic', css: 'contrast(1.08) saturate(0.88) sepia(0.12) brightness(1.02)' },
  { id: 'vhs', name: 'VHS', category: 'Aesthetic', css: 'contrast(1.15) saturate(1.4) hue-rotate(5deg) brightness(0.98)' },
  { id: 'cinematic', name: 'Cinematic', category: 'Aesthetic', css: 'contrast(1.18) saturate(0.9) brightness(0.95) sepia(0.08)' },
  { id: 'teal-orange', name: 'Teal & Orange', category: 'Aesthetic', css: 'contrast(1.12) saturate(1.3) hue-rotate(8deg)' },
  { id: 'fade', name: 'Fade', category: 'Aesthetic', css: 'contrast(0.82) brightness(1.1) saturate(0.9)' },
  { id: 'matte', name: 'Matte', category: 'Aesthetic', css: 'contrast(0.88) brightness(1.05) saturate(0.95) sepia(0.06)' },
  { id: 'moody', name: 'Moody', category: 'Aesthetic', css: 'contrast(1.15) brightness(0.88) saturate(0.85)' },
  { id: 'lavender', name: 'Lavender Haze', category: 'Aesthetic', css: 'brightness(1.08) contrast(0.9) hue-rotate(15deg) saturate(0.95)' },
  { id: 'sunkissed', name: 'Sun-kissed', category: 'Aesthetic', css: 'brightness(1.1) sepia(0.22) saturate(1.4) contrast(1.05)' },
  { id: 'pop', name: 'Color Pop', category: 'Aesthetic', css: 'saturate(1.6) contrast(1.1) brightness(1.02)' },
  { id: 'vivid', name: 'Vivid', category: 'Aesthetic', css: 'saturate(1.45) contrast(1.15)' },
  { id: 'dreamy-blue', name: 'Dreamy Blue', category: 'Aesthetic', css: 'brightness(1.05) hue-rotate(-15deg) saturate(1.1) contrast(0.95)' },
  { id: 'neon', name: 'Neon Nights', category: 'Aesthetic', css: 'saturate(1.7) contrast(1.25) brightness(0.95) hue-rotate(10deg)' },
  { id: 'honey', name: 'Honey', category: 'Aesthetic', css: 'sepia(0.35) saturate(1.5) brightness(1.05)' },

  // ---------- B&W / Vintage ----------
  { id: 'bw', name: 'B&W Classic', category: 'B&W / Vintage', css: 'grayscale(1) contrast(1.05)' },
  { id: 'bw-high', name: 'B&W Bold', category: 'B&W / Vintage', css: 'grayscale(1) contrast(1.35) brightness(1.02)' },
  { id: 'bw-soft', name: 'B&W Soft', category: 'B&W / Vintage', css: 'grayscale(1) contrast(0.9) brightness(1.1)' },
  { id: 'silver', name: 'Silver Screen', category: 'B&W / Vintage', css: 'grayscale(0.9) contrast(1.15) brightness(1.05) sepia(0.08)' },
  { id: 'sepia', name: 'Sepia', category: 'B&W / Vintage', css: 'sepia(0.85) contrast(1.05) brightness(1.02)' },
  { id: 'old-photo', name: 'Old Photo', category: 'B&W / Vintage', css: 'sepia(0.6) contrast(0.9) brightness(1.08) saturate(0.8)' },
  { id: 'retro-70s', name: 'Retro 70s', category: 'B&W / Vintage', css: 'sepia(0.4) saturate(1.4) contrast(1.05) hue-rotate(-10deg)' },
  { id: 'newspaper', name: 'Newspaper', category: 'B&W / Vintage', css: 'grayscale(1) contrast(1.5) brightness(1.05)' },
  { id: 'faded-polaroid', name: 'Faded Polaroid', category: 'B&W / Vintage', css: 'sepia(0.25) contrast(0.8) brightness(1.15) saturate(0.75)' },
  { id: 'antique', name: 'Antique', category: 'B&W / Vintage', css: 'sepia(0.7) contrast(1.1) brightness(0.95) saturate(0.9)' },

  // ---------- Fun (animated overlays, baked into captures) ----------
  { id: 'hearts', name: 'Floating Hearts', category: 'Fun', css: 'brightness(1.05) saturate(1.15)', overlay: 'hearts' },
  { id: 'sparkles', name: 'Sparkles', category: 'Fun', css: 'brightness(1.08) contrast(1.05)', overlay: 'sparkles' },
  { id: 'confetti', name: 'Confetti', category: 'Fun', css: 'saturate(1.3) brightness(1.05)', overlay: 'confetti' },
  { id: 'bubbles', name: 'Bubbles', category: 'Fun', css: 'brightness(1.05) hue-rotate(-5deg)', overlay: 'bubbles' },
  { id: 'stars', name: 'Starry', category: 'Fun', css: 'brightness(0.95) contrast(1.1) saturate(1.1)', overlay: 'stars' },
  { id: 'snow', name: 'Snowfall', category: 'Fun', css: 'brightness(1.08) hue-rotate(-8deg) saturate(0.9)', overlay: 'snow' },
  { id: 'butterflies', name: 'Butterflies', category: 'Fun', css: 'brightness(1.06) saturate(1.2)', overlay: 'butterflies' },
  { id: 'love-mail', name: 'Love Letters', category: 'Fun', css: 'sepia(0.15) brightness(1.05) saturate(1.2)', overlay: 'lovemail' },
]

export function getFilter(id) {
  return FILTERS.find((f) => f.id === id) || FILTERS[0]
}
