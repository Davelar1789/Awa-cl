import { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, MessageSquareWarning } from 'lucide-react-native'
import Toast from 'react-native-toast-message'
import api, { apiErrorMessage } from '../../services/api'
import Button from '../../components/Button'
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme'

const PRESETS = [5, 10, 15, 20, 30]

export default function DelayBroadcastScreen({ trip, onBack }) {
  const [minutes, setMinutes] = useState(10)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(null)

  async function handleSend() {
    setSending(true)
    try {
      const { data } = await api.post(`/trips/${trip._id}/broadcast`, { delayMinutes: minutes })
      setSent(data.recipientCount)
      Toast.show({ type: 'success', text1: data.message })
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Could not send broadcast.') })
    } finally {
      setSending(false)
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Delay broadcast</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <MessageSquareWarning size={28} color={Colors.gold} />
        </View>
        <Text style={styles.heading}>Notify all parents on this route</Text>
        <Text style={styles.body1}>Every attending parent gets one SMS — parents with two children on your route only get it once.</Text>

        <Text style={styles.label}>Delay (minutes)</Text>
        <View style={styles.chips}>
          {PRESETS.map((m) => (
            <Pressable key={m} onPress={() => setMinutes(m)} style={[styles.chip, minutes === m && styles.chipActive]}>
              <Text style={[styles.chipText, minutes === m && styles.chipTextActive]}>{m}m</Text>
            </Pressable>
          ))}
        </View>

        {sent !== null ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>Sent to {sent} parent(s). ✅</Text>
            <Button title="Back to trip" variant="dark" onPress={onBack} style={{ marginTop: Spacing.md }} />
          </View>
        ) : (
          <Button
            title={sending ? 'Sending…' : `Send ${minutes}-minute delay notice`}
            onPress={handleSend}
            loading={sending}
            style={{ marginTop: Spacing.xl }}
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  body: { padding: Spacing.lg, alignItems: 'center' },
  iconWrap: {
    width: 56, height: 56, borderRadius: Radius.lg, backgroundColor: Colors.goldSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  heading: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  body1: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  label: { alignSelf: 'flex-start', fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  chips: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', width: '100%' },
  chip: {
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.navyBorder, backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  chipText: { color: Colors.textSecondary, fontWeight: '700', fontSize: FontSize.sm },
  chipTextActive: { color: Colors.navy },
  successBox: { width: '100%', alignItems: 'center', marginTop: Spacing.xl },
  successText: { color: Colors.green, fontWeight: '700', fontSize: FontSize.md },
})
