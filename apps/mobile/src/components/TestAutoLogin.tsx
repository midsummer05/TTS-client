import { useEffect, useRef } from 'react'
import { api } from '@/api'
import { useUserStore } from '@/store/userStore'

export function TestAutoLogin() {
  const token = useUserStore((state) => state.token)
  const setSession = useUserStore((state) => state.setSession)
  const loggingInRef = useRef(false)

  useEffect(() => {
    if (token || loggingInRef.current) return
    loggingInRef.current = true
    api
      .mockLogin({ username: 'test', nickname: '测试者' })
      .then(setSession)
      .catch((error) => {
        console.warn('test auto login failed', error)
      })
      .finally(() => {
        loggingInRef.current = false
      })
  }, [setSession, token])

  return null
}
