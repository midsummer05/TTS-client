import axios from 'axios'
import { Platform } from 'react-native'
import { useUserStore } from '@/store/userStore'

const webHost =
  Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname
    ? window.location.hostname
    : 'localhost'
const envApiUrl = process.env.EXPO_PUBLIC_API_URL as string | undefined

function nativeApiBaseUrl() {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000'
  }

  return 'http://localhost:4000'
}

export const API_BASE_URL =
  envApiUrl
    ? envApiUrl
    : Platform.OS === 'web'
      ? `http://${webHost}:4000`
      : nativeApiBaseUrl()

export function toMediaUrl(url?: string | null) {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`
}

export const request = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
})

request.interceptors.request.use((config) => {
  const token = useUserStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (response) => {
    const payload = response.data
    if (payload.code !== 0) {
      throw new Error(payload.message || '请求失败')
    }
    return payload.data
  },
  async (error) => {
    const status = error.response?.status
    if (status === 401) useUserStore.getState().clearSession()
    throw new Error(error.response?.data?.message || error.message || '请求失败')
  },
)
