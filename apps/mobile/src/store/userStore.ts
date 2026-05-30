import { create } from 'zustand'
import type { User } from '@/types'

type UserState = {
  token: string
  user?: User
  setSession: (session: { token: string; user: User }) => void
}

export const useUserStore = create<UserState>((set) => ({
  token: '',
  setSession: (session) => set(session),
}))
