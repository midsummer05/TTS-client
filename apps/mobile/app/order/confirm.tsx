import { useQuery } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/api'
import { LoadingView } from '@/components/StateViews'
import { useRequireLogin } from '@/hooks/useRequireLogin'
import { formatPrice } from '@/utils/formatPrice'

export default function OrderConfirmScreen() {
  const params = useLocalSearchParams<{ cartItemIds?: string; productId?: string }>()
  const redirect = params.productId
    ? `/order/confirm?productId=${params.productId}`
    : params.cartItemIds
      ? `/order/confirm?cartItemIds=${params.cartItemIds}`
      : '/order/confirm'
  const isLoggedIn = useRequireLogin(redirect, 'buy')
  const create = useMutation({ mutationFn: api.createOrder })
  const productQuery = useQuery({
    queryKey: ['confirm-product', params.productId],
    queryFn: () => api.product(params.productId!),
    enabled: isLoggedIn && !!params.productId,
  })
  const cartQuery = useQuery({
    queryKey: ['confirm-cart', params.cartItemIds],
    queryFn: api.cart,
    enabled: isLoggedIn && !params.productId,
  })

  const cartIds = params.cartItemIds?.split(',').filter(Boolean) || []
  const items = params.productId
    ? productQuery.data
      ? [{ id: productQuery.data.id, title: productQuery.data.title, coverUrl: productQuery.data.coverUrl, price: productQuery.data.price, quantity: 1 }]
      : []
    : (cartQuery.data || [])
        .filter((item) => cartIds.includes(item.id))
        .map((item) => ({ id: item.id, title: item.product.title, coverUrl: item.product.coverUrl, price: item.product.price, quantity: item.quantity }))
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  async function submit() {
    try {
      const order = await create.mutateAsync(
        params.productId
          ? { source: 'buyNow', productId: params.productId, quantity: 1, address: '北京市朝阳区测试地址' }
          : { source: 'cart', cartItemIds: params.cartItemIds?.split(',') || [], address: '北京市朝阳区测试地址' },
      )
      router.replace({ pathname: '/order/result', params: { id: order.id } })
    } catch (error) {
      Alert.alert('下单失败', (error as Error).message)
    }
  }

  if (!isLoggedIn || productQuery.isLoading || cartQuery.isLoading) return <LoadingView />

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
        <Text style={{ fontSize: 24, fontWeight: '800' }}>确认订单</Text>
        <View style={{ marginTop: 20 }}>
          <Text style={{ color: '#666', marginBottom: 8 }}>收货地址</Text>
          <TextInput value="北京市朝阳区测试地址" editable={false} style={{ height: 48, borderRadius: 8, backgroundColor: '#f3f3f3', paddingHorizontal: 12 }} />
        </View>
        <View style={{ marginTop: 16, gap: 12 }}>
          {items.map((item) => (
            <View key={item.id} style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 8, backgroundColor: '#f7f7f7' }}>
              <Image source={{ uri: item.coverUrl }} style={{ width: 64, height: 64, borderRadius: 8 }} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={{ fontWeight: '700' }}>{item.title}</Text>
                <Text style={{ marginTop: 8, color: '#e43d33', fontWeight: '800' }}>{formatPrice(item.price)} x {item.quantity}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 18, padding: 14, borderRadius: 8, backgroundColor: '#fff7ed' }}>
          <Text style={{ color: '#9a3412' }}>后端会在提交时重新校验价格、库存和商品状态。</Text>
        </View>
        <View style={{ marginTop: 18, gap: 8 }}>
          <Text>商品金额：{formatPrice(total)}</Text>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>应付：{formatPrice(total)}</Text>
        </View>
      </ScrollView>
      <TouchableOpacity disabled={create.isPending || items.length === 0} onPress={submit} style={{ position: 'absolute', left: 16, right: 16, bottom: 18, height: 52, borderRadius: 8, backgroundColor: items.length === 0 ? '#ccc' : '#e43d33', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '800' }}>{create.isPending ? '提交中' : '提交订单'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}
