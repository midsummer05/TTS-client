import { useMutation } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/api'
import { LoadingView } from '@/components/StateViews'
import { useRequireLogin } from '@/hooks/useRequireLogin'

export default function PayResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const isLoggedIn = useRequireLogin('/order/result')
  const pay = useMutation({ mutationFn: api.payOrder })

  useEffect(() => {
    if (id && isLoggedIn) {
      const timer = setTimeout(() => pay.mutate(id), 900)
      return () => clearTimeout(timer)
    }
  }, [id, isLoggedIn])

  if (!isLoggedIn) return <LoadingView />

  return (
    <SafeAreaView
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        padding: 20,
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: '800' }}>
        {pay.isPending || !pay.data ? '支付中...' : '支付成功'}
      </Text>
      <TouchableOpacity
        onPress={() => router.replace('/order')}
        style={{
          marginTop: 28,
          height: 48,
          paddingHorizontal: 24,
          borderRadius: 8,
          backgroundColor: '#111',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '800' }}>查看订单</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}
