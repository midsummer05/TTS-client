import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/api'
import { EmptyState, ErrorState, LoadingView } from '@/components/StateViews'
import { useRequireLogin } from '@/hooks/useRequireLogin'
import { toMediaUrl } from '@/api/request'
import { formatPrice } from '@/utils/formatPrice'
import { trackEvent } from '@/utils/trackEvent'

export default function CartScreen() {
  const params = useLocalSearchParams<{ liveRoomId?: string; liveProductIds?: string }>()
  const isLiveCart = !!params.liveRoomId
  const redirect = isLiveCart ? `/cart?liveRoomId=${params.liveRoomId}&liveProductIds=${params.liveProductIds || ''}` : '/cart'
  const isLoggedIn = useRequireLogin(redirect, 'cart')
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['cart'], queryFn: api.cart, enabled: isLoggedIn })
  const update = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => api.updateCart(id, quantity),
    onSuccess: (item) => {
      trackEvent({
        eventType: 'cart_update',
        targetType: 'PRODUCT',
        targetId: item.product.id,
        liveRoomId: params.liveRoomId,
        productId: item.product.id,
        category: item.product.category,
        price: item.product.price,
        quantity: item.quantity,
        source: isLiveCart ? 'live_cart' : 'cart',
      })
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
  const select = useMutation({ mutationFn: ({ id, selected }: { id: string; selected: boolean }) => api.selectCart(id, selected), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }) })
  const remove = useMutation({ mutationFn: api.deleteCart, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }) })

  if (!isLoggedIn || query.isLoading) return <LoadingView />
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
  const liveProductIds = new Set((params.liveProductIds || '').split(',').filter(Boolean))
  const displayItems = isLiveCart ? (query.data || []).filter((item) => liveProductIds.has(item.product.id)) : (query.data || [])

  if (!displayItems.length) return <EmptyState text={isLiveCart ? '直播间购物车空空的，先去加购商品吧' : '购物车空空的'} />

  const selectedItems = displayItems.filter((item) => item.selected)
  const total = selectedItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f6f6' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
        <Text style={{ fontSize: 24, fontWeight: '800' }}>{isLiveCart ? '直播间购物车' : '购物车'}</Text>
        {isLiveCart ? <Text style={{ color: '#777', marginTop: -4 }}>当前结算会自动享受本直播间优惠。</Text> : null}
        {displayItems.map((item) => (
          <View key={item.id} style={{ flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 8, padding: 12 }}>
            <TouchableOpacity onPress={() => select.mutate({ id: item.id, selected: !item.selected })} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: item.selected ? '#111' : '#ddd', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff' }}>✓</Text>
            </TouchableOpacity>
            <Image source={{ uri: toMediaUrl(item.product.coverUrl) }} style={{ width: 76, height: 76, borderRadius: 8 }} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={{ fontWeight: '700', color: '#111' }}>{item.product.title}</Text>
              <Text style={{ color: '#e43d33', fontWeight: '800', marginTop: 6 }}>{formatPrice(item.product.price)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <TouchableOpacity onPress={() => update.mutate({ id: item.id, quantity: Math.max(1, item.quantity - 1) })}><Text style={{ fontSize: 20 }}>-</Text></TouchableOpacity>
                <Text>{item.quantity}</Text>
                <TouchableOpacity onPress={() => update.mutate({ id: item.id, quantity: item.quantity + 1 })}><Text style={{ fontSize: 20 }}>+</Text></TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    trackEvent({
                      eventType: 'cart_remove',
                      targetType: 'PRODUCT',
                      targetId: item.product.id,
                      liveRoomId: params.liveRoomId,
                      productId: item.product.id,
                      category: item.product.category,
                      price: item.product.price,
                      quantity: item.quantity,
                      source: isLiveCart ? 'live_cart' : 'cart',
                    })
                    remove.mutate(item.id)
                  }}
                  style={{ marginLeft: 'auto' }}
                ><Text style={{ color: '#777' }}>删除</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800' }}>合计 {formatPrice(total)}</Text>
        <TouchableOpacity
          onPress={() => {
            if (!selectedItems.length) {
              Alert.alert('请选择商品')
              return
            }
            trackEvent({
              eventType: 'checkout_start',
              targetType: 'CART',
              targetId: selectedItems.map((item) => item.id).join(','),
              liveRoomId: params.liveRoomId,
              source: isLiveCart ? 'live_cart' : 'cart',
              metadata: {
                productIds: selectedItems.map((item) => item.product.id),
                total,
              },
            })
            router.push({ pathname: '/order/confirm', params: { cartItemIds: selectedItems.map((item) => item.id).join(','), liveRoomId: params.liveRoomId } })
          }}
          style={{ backgroundColor: '#e43d33', paddingHorizontal: 24, height: 48, borderRadius: 8, justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>结算</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
