import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Check } from 'lucide-react-native'
import { Colors, Radius, FontSize, Spacing } from '../constants/theme'
import StatusBadge from './StatusBadge'

/**
 * `student`: { studentId, studentName/name, status: 'pending'|'alerted'|'dropped'|'cancelled' }
 * `onMarkDropped`: called when the driver taps the checkmark on an alerted student.
 */
export default function StudentCard({ student, onMarkDropped }) {
  const name = student.studentName ?? student.name
  const canResolve = student.status === 'alerted' && onMarkDropped

  return (
    <View style={styles.card}>
      <View style={styles.initials}>
        <Text style={styles.initialsText}>{name?.[0]?.toUpperCase() ?? '?'}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <StatusBadge status={student.status} />
      </View>

      {canResolve && (
        <Pressable style={styles.resolveBtn} onPress={() => onMarkDropped(student)} hitSlop={8}>
          <Check size={16} color={Colors.navy} strokeWidth={3} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  initials: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: { color: Colors.gold, fontWeight: '800', fontSize: FontSize.md },
  info: { flex: 1, gap: 6 },
  name: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '600' },
  resolveBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
