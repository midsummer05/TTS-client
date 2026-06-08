import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/api'
import { ErrorState, LoadingView } from '@/components/StateViews'
import { useRequireLogin } from '@/hooks/useRequireLogin'
import type { OrderStatus } from '@/types'
import { formatPrice } from '@/utils/formatPrice'

const orderStatusText: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '待支付',
  PAID: '待发货',
  SHIPPED: '待收货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const isLoggedIn = useRequireLogin(`/order/${id}`, 'order')
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['order', id], queryFn: () => api.order(id), enabled: isLoggedIn })
  const pay = useMutation({
    mutationFn: api.payOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  if (!isLoggedIn || query.isLoading) return <LoadingView />
  if (query.isError || !query.data) return <ErrorState message={(query.error as Error)?.message || '订单不存在'} onRetry={() => query.refetch()} />

  const order = query.data

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f6f6' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 96 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 14 }}>
          <Text style={{ fontSize: 20, fontWeight: '800' }}>{orderStatusText[order.status] || order.status}</Text>
          <Text style={{ color: '#777', marginTop: 6 }}>{order.orderNo}</Text>
          <Text style={{ color: '#444', marginTop: 10 }}>地址：{order.address}</Text>
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 14, gap: 12 }}>
          {order.items.map((item) => (
            <View key={item.id} style={{ flexDirection: 'row', gap: 10 }}>
              <Image source={{ uri: item.coverUrl }} style={{ width: 72, height: 72, borderRadius: 8 }} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={{ fontWeight: '700' }}>{item.title}</Text>
                <Text style={{ marginTop: 8, color: '#e43d33' }}>{formatPrice(item.price)} x {item.quantity}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 14, gap: 8 }}>
          <Text>商品金额：{formatPrice(order.totalAmount)}</Text>
          <Text>优惠金额：-{formatPrice(order.discountAmount)}</Text>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>实付：{formatPrice(order.payAmount)}</Text>
        </View>
      </ScrollView>
      {order.status === 'PENDING_PAYMENT' ? (
        <TouchableOpacity onPress={() => pay.mutate(order.id)} style={{ position: 'absolute', left: 16, right: 16, bottom: 18, height: 50, borderRadius: 8, backgroundColor: '#e43d33', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{pay.isPending ? '支付中' : '立即支付'}</Text>
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  )
}
