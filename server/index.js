import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, { maxHttpBufferSize: 20e6 })

// Serve production build if it exists
const dist = path.join(__dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

/**
 * rooms: roomId -> {
 *   users: [socketId, socketId],
 *   sides: { [socketId]: 'left' | 'right' },
 *   names: { [socketId]: string },
 *   ready: Set<socketId>,
 *   capturing: boolean
 * }
 */
const rooms = new Map()

function roomState(room) {
  return {
    users: room.users.map((id) => ({
      id,
      side: room.sides[id],
      name: room.names[id] || 'Partner',
      ready: room.ready.has(id),
    })),
  }
}

function broadcastState(roomId) {
  const room = rooms.get(roomId)
  if (room) io.to(roomId).emit('room-state', roomState(room))
}

io.on('connection', (socket) => {
  let joinedRoom = null

  socket.on('join-room', ({ roomId, name }, cb) => {
    let room = rooms.get(roomId)
    if (!room) {
      room = { users: [], sides: {}, names: {}, ready: new Set(), capturing: false }
      rooms.set(roomId, room)
    }
    if (room.users.length >= 2) {
      cb?.({ error: 'Room is full — LoveBooth rooms fit exactly two people.' })
      return
    }
    room.users.push(socket.id)
    room.names[socket.id] = name || (room.users.length === 1 ? 'Partner 1' : 'Partner 2')
    // First person gets left, second gets right
    const taken = Object.values(room.sides)
    room.sides[socket.id] = taken.includes('left') ? 'right' : 'left'
    socket.join(roomId)
    joinedRoom = roomId

    cb?.({ ok: true, side: room.sides[socket.id], isInitiator: room.users.length === 2 })
    broadcastState(roomId)
    if (room.users.length === 2) {
      // Tell the newcomer to start the WebRTC offer
      socket.emit('start-call')
    }
  })

  // WebRTC signaling relay (offer / answer / ICE candidates)
  socket.on('signal', (data) => {
    if (joinedRoom) socket.to(joinedRoom).emit('signal', data)
  })

  // Ready / countdown flow
  socket.on('set-ready', (isReady) => {
    const room = rooms.get(joinedRoom)
    if (!room || room.capturing) return
    if (isReady) room.ready.add(socket.id)
    else room.ready.delete(socket.id)
    broadcastState(joinedRoom)

    // Solo mode (partner not here yet) starts the countdown immediately;
    // with two people both must be ready.
    const everyoneReady = room.ready.size === room.users.length
    if (everyoneReady && room.ready.size > 0) {
      room.capturing = true
      room.ready.clear()
      io.to(joinedRoom).emit('countdown-start', { seconds: 8 })
      // Safety: unlock capturing after countdown + capture window
      setTimeout(() => {
        room.capturing = false
        broadcastState(joinedRoom)
      }, 11000)
    }
  })

  // Each client sends its own captured frame; relay to the partner
  socket.on('photo', (payload) => {
    const room = rooms.get(joinedRoom)
    if (!room) return
    socket.to(joinedRoom).emit('partner-photo', {
      ...payload,
      side: room.sides[socket.id],
    })
  })

  // Live filter preview sync (partner sees your chosen filter on your feed)
  socket.on('filter-changed', (filter) => {
    socket.to(joinedRoom)?.emit('partner-filter', filter)
  })

  // Switch sides flow
  socket.on('request-switch', () => {
    socket.to(joinedRoom)?.emit('switch-requested')
  })
  socket.on('respond-switch', (accepted) => {
    const room = rooms.get(joinedRoom)
    if (!room) return
    if (accepted) {
      for (const id of room.users) {
        room.sides[id] = room.sides[id] === 'left' ? 'right' : 'left'
      }
    }
    io.to(joinedRoom).emit('switch-result', { accepted })
    broadcastState(joinedRoom)
  })

  // Chat relay
  socket.on('chat', (msg) => {
    const room = rooms.get(joinedRoom)
    if (!room) return
    io.to(joinedRoom).emit('chat', {
      text: String(msg).slice(0, 500),
      from: socket.id,
      name: room.names[socket.id],
      ts: Date.now(),
    })
  })

  socket.on('disconnect', () => {
    const room = rooms.get(joinedRoom)
    if (!room) return
    room.users = room.users.filter((id) => id !== socket.id)
    delete room.sides[socket.id]
    delete room.names[socket.id]
    room.ready.delete(socket.id)
    if (room.users.length === 0) rooms.delete(joinedRoom)
    else {
      socket.to(joinedRoom).emit('partner-left')
      broadcastState(joinedRoom)
    }
  })
})

// In dev, don't use process.env.PORT — dev tooling sets it to the Vite port
// and the two servers would collide (Vite proxies /socket.io to 3001).
// In production (--prod, used by `npm start`), hosts assign PORT and we must use it.
const isProd = process.argv.includes('--prod')
const PORT = process.env.LOVEBOOTH_PORT || (isProd && process.env.PORT) || 3001
httpServer.listen(PORT, () => console.log(`LoveBooth server on http://localhost:${PORT}`))
