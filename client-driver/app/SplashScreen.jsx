import { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { Colors, FontSize, Radius } from '../constants/theme'

export default function AnimatedSplash({ onFinish }) {
  const scale = useRef(new Animated.Value(0.85)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 40 }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start()

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(onFinish)
    }, 1300)

    return () => clearTimeout(timer)
  }, [onFinish, opacity, scale])

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.markWrap, { transform: [{ scale }], opacity }]}>
        <View style={styles.mark}>
          <Text style={styles.markText}>A</Text>
        </View>
        <Text style={styles.title}>AwaBus</Text>
        <Text style={styles.subtitle}>Driver</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },
  markWrap: { alignItems: 'center', gap: 10 },
  mark: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  markText: { fontSize: 32, fontWeight: '800', color: Colors.navy },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
})
