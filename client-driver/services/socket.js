import { io } from 'socket.io-client'
import { getToken } from './auth'

let socket = null

/** Lazily creates a single shared, JWT-authenticated Socket.io connection. */
export async function getSocket() {
  if (socket) return socket

  const token = await getToken()
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api'
  const baseUrl = apiUrl.replace(/\/api\/?$/, '')

  socket = io(baseUrl, {
    auth: { token },
    transports: ['websocket'],
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
