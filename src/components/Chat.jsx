import { useEffect, useRef, useState } from 'react'

export default function Chat({ messages, onSend, selfId }) {
  const [text, setText] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    const t = text.trim()
    if (!t) return
    onSend(t)
    setText('')
  }

  return (
    <div className="flex flex-col h-72">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-ink/40 text-center mt-8">
            Say hi while you pose 💬
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.from === selfId
          return (
            <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                  mine
                    ? 'bg-primary text-white rounded-br-md'
                    : 'bg-rose-100 text-ink rounded-bl-md'
                }`}
              >
                {!mine && <span className="block text-xs font-display text-primary mb-0.5">{m.name}</span>}
                {m.text}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 mt-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message…"
          aria-label="Chat message"
          className="flex-1 px-3 py-2 rounded-xl border-2 border-rose-200 focus:border-primary focus:outline-none text-sm bg-white text-ink"
        />
        <button
          onClick={send}
          className="clay-btn px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm"
          aria-label="Send message"
        >
          Send
        </button>
      </div>
    </div>
  )
}
