import { io } from 'socket.io-client'
import { TOKEN_KEY } from './api'

let socket = null

/** Lazily creates a single shared, JWT-authenticated Socket.io connection. */
export function getSocket() {
  if (socket) return socket

  const token = localStorage.getItem(TOKEN_KEY)
  const url = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : undefined // undefined -> same origin, proxied by Vite in dev

  socket = io(url, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
