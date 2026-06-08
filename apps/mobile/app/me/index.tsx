import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/api'
import { toMediaUrl } from '@/api/request'
import { Avatar } from '@/components/Avatar'
import { BottomNav } from '@/components/BottomNav'
import { ErrorState, LoadingView } from '@/components/StateViews'
import { useRequireLogin } from '@/hooks/useRequireLogin'
import { useUserStore } from '@/store/userStore'
import type { OrderStatus } from '@/types'
import { formatPrice } from '@/utils/formatPrice'

const orderStatusText: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '待支付',
  PAID: '待发货',
  SHIPPED: '待收货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

export default function MeScreen() {
  const session = useUserStore()
  const isLoggedIn = useRequireLogin('/me', 'profile')
  const cart = useQuery({ queryKey: ['cart', session.user?.id], queryFn: api.cart, enabled: isLoggedIn })
  const orders = useQuery({ queryKey: ['orders', session.user?.id], queryFn: () => api.orders(), enabled: isLoggedIn })

  if (!isLoggedIn || cart.isLoading || orders.isLoading) return <LoadingView />
  if (cart.isError) return <ErrorState message={(cart.error as Error).message} onRetry={() => cart.refetch()} />
  if (orders.isError) return <ErrorState message={(orders.error as Error).message} onRetry={() => orders.refetch()} />

  const cartTotal = (cart.data || []).reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const paidTotal = (orders.data || []).filter((order) => ['PAID', 'SHIPPED', 'COMPLETED'].includes(order.status)).reduce((sum, order) => sum + order.payAmount, 0)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#101014' }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 96 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar uri={session.user?.avatarUrl} name={session.user?.nickname || session.user?.username} size={68} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>{session.user?.nickname || '移动端用户'}</Text>
            <Text style={{ color: '#9fa0ad', marginTop: 4 }}>购物信息与订单中心</Text>
          </View>
        </View>

        <View style={{ marginTop: 22, flexDirection: 'row', gap: 10 }}>
          {[
            ['购物车', `${cart.data?.length || 0}`],
            ['订单', `${orders.data?.length || 0}`],
            ['已消费', formatPrice(paidTotal)],
          ].map(([label, value]) => (
            <View key={label} style={{ flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#1d1d25' }}>
              <Text style={{ color: '#9fa0ad' }}>{label}</Text>
              <Text style={{ color: '#fff', marginTop: 8, fontSize: 18, fontWeight: '900' }}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 22, flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={() => router.push('/cart')} style={{ flex: 1, height: 46, borderRadius: 8, backgroundColor: '#ff315f', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '900' }}>查看购物车</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/order')} style={{ flex: 1, height: 46, borderRadius: 8, backgroundColor: '#2d2d38', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '900' }}>全部订单</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => {
            session.clearSession()
            router.replace('/login')
          }}
          style={{ marginTop: 18, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#34343f', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#b9bac4', fontWeight: '800' }}>退出登录</Text>
        </TouchableOpacity>

        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 28 }}>购物车商品</Text>
        <View style={{ marginTop: 12, gap: 12 }}>
          {(cart.data || []).slice(0, 4).map((item) => (
            <View key={item.id} style={{ flexDirection: 'row', gap: 12, padding: 10, borderRadius: 8, backgroundColor: '#1d1d25' }}>
              <Image source={{ uri: toMediaUrl(item.product.coverUrl) }} style={{ width: 68, height: 68, borderRadius: 6, backgroundColor: '#333' }} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '900' }}>{item.product.title}</Text>
                <Text style={{ color: '#9fa0ad', marginTop: 6 }}>数量 x{item.quantity}</Text>
                <Text style={{ color: '#ff315f', marginTop: 6, fontWeight: '900' }}>{formatPrice(item.product.price * item.quantity)}</Text>
              </View>
            </View>
          ))}
          {!cart.data?.length ? <Text style={{ color: '#9fa0ad' }}>购物车还是空的，可以先去首页加购</Text> : null}
        </View>

        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 28 }}>最近订单</Text>
        <View style={{ marginTop: 12, gap: 12 }}>
          {(orders.data || []).slice(0, 4).map((order) => (
            <TouchableOpacity key={order.id} onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })} style={{ padding: 14, borderRadius: 8, backgroundColor: '#1d1d25' }}>
              <Text style={{ color: '#fff', fontWeight: '900' }}>{order.orderNo}</Text>
              <Text style={{ color: '#9fa0ad', marginTop: 6 }}>{order.items[0]?.title || '商品'} · {orderStatusText[order.status] || order.status}</Text>
              <Text style={{ color: '#ff315f', marginTop: 8, fontWeight: '900' }}>{formatPrice(order.payAmount)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <BottomNav active="me" />
    </SafeAreaView>
  )
}
