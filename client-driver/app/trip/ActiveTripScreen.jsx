import { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MessageSquareWarning, Square } from 'lucide-react-native'
import Toast from 'react-native-toast-message'
import api, { apiErrorMessage } from '../../services/api'
import { isTracking, stopTracking } from '../../services/gpsService'
import { queueSize } from '../../services/pingQueue'
import { getSocket, disconnectSocket } from '../../services/socket'
import StudentCard from '../../components/StudentCard'
import GPSStatusBar from '../../components/GPSStatusBar'
import Button from '../../components/Button'
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme'

const POLL_MS = 8000

function deriveStatus(ts) {
  if (ts.attending === false) return 'cancelled'
  if (ts.manuallyResolved) return 'dropped'
  if (ts.alertTriggered) return 'alerted'
  return 'pending'
}

export default function ActiveTripScreen({ trip, initialStudents, onTripEnd, onBroadcast }) {
  const [students, setStudents] = useState(
    initialStudents.map((s) => ({ studentId: s._id, studentName: s.name, status: 'pending' }))
  )
  const [gpsStatus, setGpsStatus] = useState('tracking')
  const [queued, setQueued] = useState(0)
  const [lastPing, setLastPing] = useState(null)
  const [ending, setEnding] = useState(false)
  const prevAlerted = useRef(new Set())

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get(`/trips/${trip._id}/students`)
      const mapped = data.students.map((ts) => ({
        studentId: ts.studentId,
        studentName: ts.studentName,
        status: deriveStatus(ts),
      }))

      // Toast once per newly-alerted student so the driver notices without
      // having to stare at the list.
      for (const ts of mapped) {
        if (ts.status === 'alerted' && !prevAlerted.current.has(ts.studentId)) {
          Toast.show({ type: 'info', text1: `Alert sent — approaching ${ts.studentName}` })
        }
      }
      prevAlerted.current = new Set(mapped.filter((m) => m.status === 'alerted').map((m) => m.studentId))

      setStudents(mapped)
    } catch {
      // Transient network hiccup — keep showing the last known state.
    }
  }, [trip._id])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    const gpsInterval = setInterval(async () => {
      const [tracking, q] = await Promise.all([isTracking(), queueSize()])
      setQueued(q)
      setGpsStatus(!tracking ? 'offline' : q > 0 ? 'queued' : 'tracking')
      if (tracking) setLastPing(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    }, 5000)
    return () => clearInterval(gpsInterval)
  }, [])

  // Live nudge when a parent cancels via IVR mid-trip.
  useEffect(() => {
    let socket
    getSocket().then((s) => {
      socket = s
      socket.on('attendance:cancelled', refresh)
    })
    return () => {
      socket?.off('attendance:cancelled', refresh)
    }
  }, [refresh])

  async function handleMarkDropped(student) {
    try {
      await api.patch(`/trips/${trip._id}/students/${student.studentId}/resolve`)
      setStudents((prev) => prev.map((s) => (s.studentId === student.studentId ? { ...s, status: 'dropped' } : s)))
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Could not update student.') })
    }
  }

  function confirmEndTrip() {
    Alert.alert('End trip?', 'This will stop GPS tracking and mark the trip complete.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End trip', style: 'destructive', onPress: handleEndTrip },
    ])
  }

  async function handleEndTrip() {
    setEnding(true)
    try {
      await api.post(`/trips/${trip._id}/end`)
      await stopTracking()
      disconnectSocket()
      onTripEnd()
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Could not end trip.') })
    } finally {
      setEnding(false)
    }
  }

  const pendingCount = students.filter((s) => s.status === 'pending').length

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Active Trip</Text>
        <Text style={styles.subtitle}>{pendingCount} of {students.length} pending</Text>
      </View>

      <View style={styles.gpsWrap}>
        <GPSStatusBar status={gpsStatus} lastPing={lastPing} queuedCount={queued} />
      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => item.studentId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <StudentCard student={item} onMarkDropped={handleMarkDropped} />}
        ListEmptyComponent={<Text style={styles.empty}>No students on this trip.</Text>}
      />

      <View style={styles.footer}>
        <Button title="Delay broadcast" variant="dark" icon={<MessageSquareWarning size={16} color={Colors.textPrimary} />} onPress={onBroadcast} style={styles.footerBtn} />
        <Button title={ending ? 'Ending…' : 'End trip'} variant="danger" icon={<Square size={14} color="#fff" />} onPress={confirmEndTrip} loading={ending} style={styles.footerBtn} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, marginBottom: Spacing.sm },
  gpsWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
  footer: {
    flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Colors.navyBorder, backgroundColor: Colors.bg,
  },
  footerBtn: { flex: 1 },
})
