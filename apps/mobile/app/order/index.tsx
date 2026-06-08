import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'
import { Image, ScrollView, Text, View } from 'react-native'
import { TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/api'
import { EmptyState, ErrorState, LoadingView } from '@/components/StateViews'
import { useRequireLogin } from '@/hooks/useRequireLogin'
import type { OrderStatus } from '@/types'
import { formatPrice } from '@/utils/formatPrice'

const orderTabs: Array<{ label: string; value?: OrderStatus }> = [
  { label: '全部' },
  { label: '待支付', value: 'PENDING_PAYMENT' },
  { label: '待发货', value: 'PAID' },
  { label: '待收货', value: 'SHIPPED' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' },
]

const orderStatusText: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '待支付',
  PAID: '待发货',
  SHIPPED: '待收货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

export default function OrderListScreen() {
  const isLoggedIn = useRequireLogin('/order', 'order')
  const [status, setStatus] = useState<OrderStatus | undefined>()
  const query = useQuery({ queryKey: ['orders', status || 'all'], queryFn: () => api.orders(status), enabled: isLoggedIn })
  if (!isLoggedIn || query.isLoading) return <LoadingView />
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f6f6' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: '800' }}>我的订单</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {orderTabs.map((tab) => {
            const active = status === tab.value
            return (
              <TouchableOpacity
                key={tab.value || 'all'}
                onPress={() => setStatus(tab.value)}
                style={{
                  paddingHorizontal: 14,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? '#111' : '#fff',
                  borderWidth: 1,
                  borderColor: active ? '#111' : '#eee',
                }}
              >
                <Text style={{ color: active ? '#fff' : '#333', fontWeight: active ? '800' : '600' }}>{tab.label}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
        {!query.data?.length ? <EmptyState text={status ? `暂无${orderStatusText[status]}订单` : '暂无订单'} /> : null}
        {query.data?.map((order) => (
          <TouchableOpacity key={order.id} onPress={() => router.push(`/order/${order.id}`)} style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontWeight: '700' }}>{order.orderNo}</Text>
              <Text style={{ color: '#e43d33', fontWeight: '800' }}>{orderStatusText[order.status] || order.status}</Text>
            </View>
            {order.items.map((item) => (
              <View key={item.id} style={{ marginTop: 10, flexDirection: 'row', gap: 10 }}>
                <Image source={{ uri: item.coverUrl }} style={{ width: 58, height: 58, borderRadius: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1}>{item.title}</Text>
                  <Text style={{ color: '#e43d33', marginTop: 5 }}>{formatPrice(item.price)} x {item.quantity}</Text>
                </View>
              </View>
            ))}
            <Text style={{ marginTop: 10, textAlign: 'right', fontWeight: '800' }}>实付 {formatPrice(order.payAmount)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}
