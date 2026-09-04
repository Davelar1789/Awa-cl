import * as SecureStore from 'expo-secure-store'
import api, { TOKEN_KEY } from './api'

const USER_KEY = 'awabus_user'

export async function login(phone, password) {
  const { data } = await api.post('/auth/login', { phone, password })
  if (data.user.role !== 'driver') {
    throw Object.assign(new Error('This app is for drivers only.'), { code: 'NOT_A_DRIVER' })
  }
  await SecureStore.setItemAsync(TOKEN_KEY, data.token)
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user))
  return data.user
}

export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
  await SecureStore.deleteItemAsync(USER_KEY)
}

export async function getStoredUser() {
  const raw = await SecureStore.getItemAsync(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY)
}
