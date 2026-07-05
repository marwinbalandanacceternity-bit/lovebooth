// Device-local session history stored in IndexedDB (localStorage is far too
// small for base64 photos). Each record: { id, date, roomId, stripPng, shots }.

const DB_NAME = 'lovebooth'
const STORE = 'sessions'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const store = t.objectStore(STORE)
    const result = fn(store)
    t.oncomplete = () => resolve(result?.result)
    t.onerror = () => reject(t.error)
  })
}

export async function saveSession({ roomId, stripPng, shots }) {
  const db = await openDb()
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: Date.now(),
    roomId,
    stripPng: stripPng || null,
    shots: shots || [],
  }
  await tx(db, 'readwrite', (s) => s.put(record))
  db.close()
  return record.id
}

export async function listSessions() {
  const db = await openDb()
  const all = await tx(db, 'readonly', (s) => s.getAll())
  db.close()
  return (all || []).sort((a, b) => b.date - a.date)
}

export async function deleteSession(id) {
  const db = await openDb()
  await tx(db, 'readwrite', (s) => s.delete(id))
  db.close()
}
