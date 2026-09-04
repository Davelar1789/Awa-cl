import axios from 'axios'
import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'awabus_token'

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
})

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let unauthorizedHandler = null
/** Registered once by App.js so a 401 anywhere logs the driver out and returns to the login screen. */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && unauthorizedHandler) {
      unauthorizedHandler()
    }
    return Promise.reject(err)
  }
)

export function apiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return err?.response?.data?.message || (err?.message === 'Network Error' ? 'No connection — check your data or Wi-Fi.' : fallback)
}

export { TOKEN_KEY }
export default api
