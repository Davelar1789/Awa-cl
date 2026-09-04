import { View, Text, StyleSheet } from 'react-native'
import { Colors, Radius, FontSize, Spacing } from '../constants/theme'

/**
 * `status`: 'tracking' | 'queued' | 'offline'
 * `queuedCount`: number of pings waiting to replay once back online.
 */
export default function GPSStatusBar({ status, lastPing, queuedCount = 0 }) {
  const config = {
    tracking: { color: Colors.green, bg: Colors.greenBg, label: 'GPS live — streaming every 10s' },
    queued: { color: Colors.amber, bg: Colors.amberBg, label: `Offline — ${queuedCount} ping(s) queued` },
    offline: { color: Colors.red, bg: Colors.redBg, label: 'GPS unavailable' },
  }[status] ?? { color: Colors.textMuted, bg: 'transparent', label: 'GPS idle' }

  return (
    <View style={[styles.row, { backgroundColor: config.bg }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
        {lastPing && <Text style={styles.timestamp}>Last ping: {lastPing}</Text>}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: FontSize.sm, fontWeight: '700' },
  timestamp: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
})
