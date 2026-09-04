import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import AsyncStorage from '@react-native-async-storage/async-storage'
import api from './api'
import { enqueuePing, flushQueue } from './pingQueue'

const LOCATION_TASK = 'awabus-background-location'
const ACTIVE_TRIP_KEY = 'awabus_active_trip_id'
const GPS_INTERVAL_MS = Number(process.env.EXPO_PUBLIC_GPS_INTERVAL_MS) || 10000

// Defined at module scope, as required by expo-task-manager, so it keeps
// running via the OS-level background service even if the JS context is
// torn down and restarted — which is why the active trip id is read fresh
// from AsyncStorage on every tick rather than trusted from a closure.
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[gpsService] background task error:', error.message)
    return
  }
  const locations = data?.locations
  const latest = locations?.[locations.length - 1]
  if (!latest) return

  const tripId = await AsyncStorage.getItem(ACTIVE_TRIP_KEY)
  if (!tripId) return // trip ended after this tick was already queued by the OS

  const payload = {
    tripId,
    lat: latest.coords.latitude,
    lng: latest.coords.longitude,
    timestamp: new Date(latest.timestamp).toISOString(),
  }

  // Best-effort: send anything queued from a previous outage first, in order.
  await flushQueue()

  try {
    await api.post('/trips/ping', payload)
  } catch {
    await enqueuePing(payload)
  }
})

export async function requestLocationPermissions() {
  const fg = await Location.requestForegroundPermissionsAsync()
  if (fg.status !== 'granted') return { foreground: false, background: false }

  const bg = await Location.requestBackgroundPermissionsAsync()
  return { foreground: true, background: bg.status === 'granted' }
}

export async function hasBackgroundPermission() {
  const bg = await Location.getBackgroundPermissionsAsync()
  return bg.status === 'granted'
}

export async function startTracking(tripId) {
  await AsyncStorage.setItem(ACTIVE_TRIP_KEY, String(tripId))

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
  if (alreadyStarted) return

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: GPS_INTERVAL_MS,
    distanceInterval: 0,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'AwaBus trip in progress',
      notificationBody: 'Sharing your location so parents get proximity alerts.',
      notificationColor: '#FDB913',
    },
    pausesUpdatesAutomatically: false,
  })
}

export async function stopTracking() {
  await AsyncStorage.removeItem(ACTIVE_TRIP_KEY)
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
  if (alreadyStarted) await Location.stopLocationUpdatesAsync(LOCATION_TASK)
}

export async function isTracking() {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
}

/** One-shot fix for the dashboard's "current location" preview before a trip starts. */
export async function getCurrentPosition() {
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: pos.timestamp }
}
