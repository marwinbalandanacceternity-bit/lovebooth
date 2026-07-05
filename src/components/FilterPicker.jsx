import { useState } from 'react'
import { FILTERS, FILTER_CATEGORIES } from '../lib/filters'

export default function FilterPicker({ selected, onSelect, previewStream }) {
  const [category, setCategory] = useState(FILTER_CATEGORIES[0])
  const filters = FILTERS.filter((f) => f.category === category)

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        {FILTER_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-4 py-1.5 rounded-full text-sm font-display cursor-pointer transition-colors duration-200 ${
              category === c
                ? 'bg-primary text-white'
                : 'bg-rose-100 text-ink hover:bg-rose-200'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={`cursor-pointer rounded-2xl overflow-hidden border-3 transition-colors duration-200 ${
              selected === f.id ? 'border-primary' : 'border-transparent hover:border-rose-300'
            }`}
            aria-pressed={selected === f.id}
          >
            <FilterThumb css={f.css} stream={previewStream} overlay={f.overlay} face={f.face} />
            <span className="block text-xs font-medium py-1.5 px-1 truncate bg-white text-ink">
              {f.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Tiny live thumbnail: re-uses the camera stream via a mini <video>
function FilterThumb({ css, stream, overlay, face }) {
  return (
    <div className="relative aspect-video bg-rose-200">
      {stream ? (
        <video
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ filter: css !== 'none' ? css : undefined, transform: 'scaleX(-1)' }}
          ref={(el) => {
            if (el && el.srcObject !== stream) el.srcObject = stream
          }}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-rose-300 to-rose-400" style={{ filter: css !== 'none' ? css : undefined }} />
      )}
      {(overlay || face) && (
        <span className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-white font-display">
          {face ? 'FACE' : 'FX'}
        </span>
      )}
    </div>
  )
}
