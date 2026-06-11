import { create } from 'zustand'
import type { LiveRoom } from '@/types'

type MiniLiveState = {
  room?: LiveRoom
  setRoom: (room: LiveRoom) => void
  clearRoom: () => void
}

export const useMiniLiveStore = create<MiniLiveState>((set) => ({
  room: undefined,
  setRoom: (room) => set({ room }),
  clearRoom: () => set({ room: undefined }),
}))
