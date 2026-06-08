import { router } from 'expo-router'
import { useEffect } from 'react'
import { useUserStore } from '@/store/userStore'

export function useRequireLogin(redirect: string, reason = '继续操作') {
  const token = useUserStore((state) => state.token)

  useEffect(() => {
    if (!token) router.replace({ pathname: '/login', params: { redirect, reason } })
  }, [reason, redirect, token])

  return !!token
}
