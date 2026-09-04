import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Bus, Users, ShieldAlert, LogOut } from 'lucide-react-native'
import Toast from 'react-native-toast-message'
import api, { apiErrorMessage } from '../../services/api'
import { logout as clearAuth } from '../../services/auth'
import { requestLocationPermissions, hasBackgroundPermission, startTracking } from '../../services/gpsService'
import Button from '../../components/Button'
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme'

export default function DashboardScreen({ user, onTripStart, onLogout }) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [route, setRoute] = useState(null)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [starting, setStarting] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/drivers/me/route')
      setRoute(data)

      if (data.activeTrip) {
        onTripStart(data.activeTrip, data.students)
        return
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Could not load your route.') })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [onTripStart])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    hasBackgroundPermission().then(setPermissionGranted)
  }, [])

  async function handleRequestPermission() {
    const result = await requestLocationPermissions()
    if (!result.background) {
      Toast.show({
        type: 'error',
        text1: 'Background location required',
        text2: 'Choose "Allow all the time" in the location permission prompt.',
      })
    }
    setPermissionGranted(result.background)
  }

  async function handleStartTrip() {
    if (!route?.bus) {
      Toast.show({ type: 'error', text1: 'No bus assigned to you. Contact your admin.' })
      return
    }
    if (!route.students?.length) {
      Toast.show({ type: 'error', text1: 'No active students on your route.' })
      return
    }
    setStarting(true)
    try {
      const { data } = await api.post('/trips/start', { busId: route.bus._id })
      await startTracking(data.trip._id)
      onTripStart(data.trip, route.students)
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Could not start trip.') })
    } finally {
      setStarting(false)
    }
  }

  async function handleLogout() {
    await clearAuth()
    onLogout()
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={Colors.gold} size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={Colors.gold} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]}</Text>
            <Text style={styles.date}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          </View>
          <Pressable onPress={handleLogout} hitSlop={10}>
            <LogOut size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIcon}><Bus size={20} color={Colors.gold} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>Assigned bus</Text>
            <Text style={styles.cardValue}>{route?.bus ? (route.bus.nickname || route.bus.registrationNumber) : 'No bus assigned'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIcon}><Users size={20} color={Colors.gold} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>Students on your route</Text>
            <Text style={styles.cardValue}>{route?.students?.length ?? 0} student(s)</Text>
          </View>
        </View>

        {!permissionGranted && (
          <Pressable style={styles.permCard} onPress={handleRequestPermission}>
            <ShieldAlert size={18} color={Colors.amber} />
            <View style={{ flex: 1 }}>
              <Text style={styles.permTitle}>Background location required</Text>
              <Text style={styles.permBody}>Tap to grant "Allow all the time" — required to start a trip.</Text>
            </View>
          </Pressable>
        )}

        <Button
          title={starting ? 'Starting trip…' : 'Start Trip'}
          onPress={handleStartTrip}
          loading={starting}
          disabled={!permissionGranted || !route?.bus || !route?.students?.length}
          style={{ marginTop: Spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  greeting: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  date: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.goldSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  cardLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  cardValue: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '700', marginTop: 2 },
  permCard: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.amberBg, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.sm,
  },
  permTitle: { color: Colors.amber, fontWeight: '700', fontSize: FontSize.sm },
  permBody: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2, lineHeight: 16 },
})
