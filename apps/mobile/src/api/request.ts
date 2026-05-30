import axios from 'axios'
import { Platform } from 'react-native'
import { useUserStore } from '@/store/userStore'

const webHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost'

const envApiUrl = process.env.EXPO_PUBLIC_API_URL as string | undefined

export const API_BASE_URL =
  envApiUrl
    ? envApiUrl
    : Platform.OS === 'web'
      ? `http://${webHost}:4000`
      : 'http://10.135.7.67:4000'

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

async function mockLogin() {
  const response = await axios.post(`${API_BASE_URL}/api/auth/mock-login`, {
    nickname: '移动端用户',
  })
  useUserStore.getState().setSession(response.data.data)
  return response.data.data.token as string
}

request.interceptors.response.use(
  (response) => {
    const payload = response.data
    if (payload.code !== 0) {
      throw new Error(payload.message || '请求失败')
    }
    return payload.data
  },
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status
    if (status === 401 && originalRequest && !originalRequest.__retried) {
      originalRequest.__retried = true
      const token = await mockLogin()
      originalRequest.headers = originalRequest.headers || {}
      originalRequest.headers.Authorization = `Bearer ${token}`
      return request(originalRequest)
    }
    throw new Error(error.response?.data?.message || error.message || '请求失败')
  },
)
