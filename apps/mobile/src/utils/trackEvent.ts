import { api, type BehaviorEventInput } from '@/api'

export function trackEvent(data: BehaviorEventInput) {
  api.trackEvent(data).catch(() => null)
}
