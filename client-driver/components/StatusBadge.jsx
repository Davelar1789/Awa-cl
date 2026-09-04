import { View, Text, StyleSheet } from 'react-native'
import { Colors, Radius, FontSize } from '../constants/theme'

const CONFIG = {
  pending: { color: Colors.textSecondary, bg: 'rgba(138,155,176,0.15)', label: 'Pending' },
  alerted: { color: Colors.gold, bg: Colors.goldSoft, label: 'Alert sent' },
  dropped: { color: Colors.green, bg: Colors.greenBg, label: 'Dropped off' },
  cancelled: { color: Colors.textMuted, bg: 'rgba(74,85,104,0.2)', label: 'Cancelled today' },
}

export default function StatusBadge({ status }) {
  const c = CONFIG[status] ?? CONFIG.pending
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.color }]}>{c.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  text: { fontSize: FontSize.xs, fontWeight: '700' },
})
