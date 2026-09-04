import { useState, useEffect, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import Toast from 'react-native-toast-message'
import { Colors } from './constants/theme'
import { getStoredUser, logout as clearAuth } from './services/auth'
import { setUnauthorizedHandler } from './services/api'
import { stopTracking } from './services/gpsService'
import { disconnectSocket } from './services/socket'

import AnimatedSplash from './app/SplashScreen'
import LoginScreen from './app/auth/LoginScreen'
import DashboardScreen from './app/trip/DashboardScreen'
import ActiveTripScreen from './app/trip/ActiveTripScreen'
import DelayBroadcastScreen from './app/trip/DelayBroadcastScreen'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function App() {
  const [screen, setScreen] = useState('splash')
  const [user, setUser] = useState(null)
  const [trip, setTrip] = useState(null)
  const [students, setStudents] = useState([])
  const [appReady, setAppReady] = useState(false)

  const handleLogout = useCallback(async () => {
    await stopTracking()
    disconnectSocket()
    await clearAuth()
    setUser(null)
    setTrip(null)
    setStudents([])
    setScreen('login')
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(handleLogout)
  }, [handleLogout])

  useEffect(() => {
    async function prepare() {
      try {
        const stored = await getStoredUser()
        if (stored) setUser(stored)
      } catch {
        // fall through to login
      }
      setAppReady(true)
      await SplashScreen.hideAsync().catch(() => {})
    }
    prepare()
  }, [])

  function handleSplashDone() {
    setScreen(user ? 'dashboard' : 'login')
  }

  function handleLogin(loggedInUser) {
    setUser(loggedInUser)
    setScreen('dashboard')
  }

  function handleTripStart(newTrip, routeStudents) {
    setTrip(newTrip)
    setStudents(routeStudents)
    setScreen('active-trip')
  }

  function handleTripEnd() {
    setTrip(null)
    setStudents([])
    setScreen('dashboard')
  }

  if (!appReady) return null

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        {screen === 'splash' && <AnimatedSplash onFinish={handleSplashDone} />}
        {screen === 'login' && <LoginScreen onLogin={handleLogin} />}
        {screen === 'dashboard' && (
          <DashboardScreen user={user} onTripStart={handleTripStart} onLogout={handleLogout} />
        )}
        {screen === 'active-trip' && trip && (
          <ActiveTripScreen
            trip={trip}
            initialStudents={students}
            onTripEnd={handleTripEnd}
            onBroadcast={() => setScreen('broadcast')}
          />
        )}
        {screen === 'broadcast' && trip && (
          <DelayBroadcastScreen trip={trip} onBack={() => setScreen('active-trip')} />
        )}
        <Toast />
      </View>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.navy },
})
