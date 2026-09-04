import AsyncStorage from '@react-native-async-storage/async-storage'
import api from './api'

const QUEUE_KEY = 'awabus_ping_queue'
// 60 pings at a 10s cadence = 10 minutes of offline coverage, per spec.
const MAX_QUEUE = 60

export async function getQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function saveQueue(queue) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

/** Appends a failed ping, dropping the oldest once the 60-ping cap is hit. */
export async function enqueuePing(ping) {
  const queue = await getQueue()
  queue.push(ping)
  while (queue.length > MAX_QUEUE) queue.shift()
  await saveQueue(queue)
  return queue.length
}

/**
 * Replays queued pings in order (oldest first). Stops at the first failure
 * so a still-offline device doesn't burn through retries out of order —
 * whatever didn't send stays queued for the next attempt.
 */
export async function flushQueue() {
  const queue = await getQueue()
  if (!queue.length) return { sent: 0, remaining: 0 }

  let sent = 0
  while (queue.length) {
    const next = queue[0]
    try {
      await api.post('/trips/ping', next)
      queue.shift()
      sent += 1
    } catch {
      break
    }
  }

  await saveQueue(queue)
  return { sent, remaining: queue.length }
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY)
}

export async function queueSize() {
  return (await getQueue()).length
}
