import { useState } from 'react'
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Keyboard, TouchableWithoutFeedback,
} from 'react-native'
import Toast from 'react-native-toast-message'
import { login } from '../../services/auth'
import { apiErrorMessage } from '../../services/api'
import Button from '../../components/Button'
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme'

export default function LoginScreen({ onLogin }) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!phone.trim() || !password) {
      Toast.show({ type: 'error', text1: 'Enter your phone and password.' })
      return
    }
    setLoading(true)
    try {
      const user = await login(phone.trim(), password)
      onLogin(user)
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Invalid phone or password.') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <View style={styles.mark}><Text style={styles.markText}>A</Text></View>
            <Text style={styles.title}>AwaBus Driver</Text>
            <Text style={styles.subtitle}>Sign in to start your route</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              placeholder="+233201234567"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoComplete="tel"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSubmit}
            />
          </View>

          <Button title={loading ? 'Signing in…' : 'Sign in'} onPress={handleSubmit} loading={loading} style={{ marginTop: Spacing.sm }} />

          <Text style={styles.footNote}>Forgot your password? Ask your admin, or reset it from the Admin Portal.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.navy },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  logoWrap: { alignItems: 'center', marginBottom: Spacing.xxl },
  mark: {
    width: 56, height: 56, borderRadius: Radius.lg, backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  markText: { fontSize: 24, fontWeight: '800', color: Colors.navy },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  field: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8 },
  input: {
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
  },
  footNote: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl, lineHeight: 18 },
})
