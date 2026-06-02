import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Image, ScrollView, Text, View } from 'react-native'
import { TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/api'
import { EmptyState, ErrorState, LoadingView } from '@/components/StateViews'
import { formatPrice } from '@/utils/formatPrice'

export default function OrderListScreen() {
  const query = useQuery({ queryKey: ['orders'], queryFn: api.orders })
  if (query.isLoading) return <LoadingView />
  if (query.isError)
    return (
      <ErrorState
        message={(query.error as Error).message}
        onRetry={() => query.refetch()}
      />
    )
  if (!query.data?.length) return <EmptyState text="暂无订单" />

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f6f6' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: '800' }}>我的订单</Text>
        {query.data.map((order) => (
          <TouchableOpacity
            key={order.id}
            onPress={() => router.push(`/order/${order.id}`)}
            style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8 }}
          >
            <Text style={{ fontWeight: '700' }}>
              {order.orderNo} · {order.status}
            </Text>
            {order.items.map((item) => (
              <View
                key={item.id}
                style={{ marginTop: 10, flexDirection: 'row', gap: 10 }}
              >
                <Image
                  source={{ uri: item.coverUrl }}
                  style={{ width: 58, height: 58, borderRadius: 6 }}
                />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1}>{item.title}</Text>
                  <Text style={{ color: '#e43d33', marginTop: 5 }}>
                    {formatPrice(item.price)} x {item.quantity}
                  </Text>
                </View>
              </View>
            ))}
            <Text
              style={{ marginTop: 10, textAlign: 'right', fontWeight: '800' }}
            >
              实付 {formatPrice(order.payAmount)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}
