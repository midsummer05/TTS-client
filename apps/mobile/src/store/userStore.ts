import { create } from 'zustand'
import { Platform } from 'react-native'
import type { User } from '@/types'

const SESSION_STORAGE_KEY = 'live-commerce-mobile-session'

type UserState = {
  token: string
  user?: User
  setSession: (session: { token: string; user: User }) => void
  updateUser: (user: User) => void
  clearSession: () => void
}

function readStoredSession() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return { token: '' }
  try {
    const raw = window.localStorage?.getItem(SESSION_STORAGE_KEY)
    if (!raw) return { token: '' }
    const session = JSON.parse(raw) as { token?: string; user?: User }
    return session.token ? { token: session.token, user: session.user } : { token: '' }
  } catch {
    return { token: '' }
  }
}

function writeStoredSession(session: { token: string; user: User }) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  window.localStorage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

function removeStoredSession() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  window.localStorage?.removeItem(SESSION_STORAGE_KEY)
}

export const useUserStore = create<UserState>((set) => ({
  ...readStoredSession(),
  setSession: (session) => {
    writeStoredSession(session)
    set(session)
  },
  updateUser: (user) => set((state) => {
    if (!state.token) return { user }
    writeStoredSession({ token: state.token, user })
    return { user }
  }),
  clearSession: () => {
    removeStoredSession()
    set({ token: '', user: undefined })
  },
}))
