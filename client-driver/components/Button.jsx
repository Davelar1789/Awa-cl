import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Colors, Radius, FontSize, Spacing } from '../constants/theme'

const VARIANTS = {
  primary: { bg: Colors.gold, text: Colors.navy },
  dark: { bg: Colors.navyLight, text: Colors.textPrimary },
  danger: { bg: Colors.red, text: '#fff' },
  ghost: { bg: 'transparent', text: Colors.textSecondary, border: Colors.navyBorder },
}

export default function Button({ title, onPress, variant = 'primary', disabled, loading, style, icon }) {
  const v = VARIANTS[variant] ?? VARIANTS.primary

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border ?? 'transparent', opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: v.text }]}>{title}</Text>
        </>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  text: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
})
