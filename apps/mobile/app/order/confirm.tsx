import { useQuery } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/api'
import { LoadingView } from '@/components/StateViews'
import { useRequireLogin } from '@/hooks/useRequireLogin'
import type { MarketingRule } from '@/types'
import { formatPrice } from '@/utils/formatPrice'
import { trackEvent } from '@/utils/trackEvent'

function bestPercent(rules: MarketingRule[], productId: string) {
  const percents = rules
    .filter((rule) => ['DISCOUNT', 'SECKILL'].includes(rule.type) && (!rule.productId || rule.productId === productId) && rule.discountPercent)
    .map((rule) => Math.max(1, Math.min(100, rule.discountPercent || 100)))
  return percents.length ? Math.min(...percents) : 100
}

export default function OrderConfirmScreen() {
  const params = useLocalSearchParams<{ cartItemIds?: string; productId?: string; quantity?: string; liveRoomId?: string }>()
  const buyQuantity = Math.max(1, Number(params.quantity || 1) || 1)
  const redirect = params.productId
    ? `/order/confirm?productId=${params.productId}&quantity=${buyQuantity}${params.liveRoomId ? `&liveRoomId=${params.liveRoomId}` : ''}`
    : params.cartItemIds
      ? `/order/confirm?cartItemIds=${params.cartItemIds}${params.liveRoomId ? `&liveRoomId=${params.liveRoomId}` : ''}`
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
  const marketingQuery = useQuery({
    queryKey: ['confirm-marketing', params.liveRoomId],
    queryFn: () => api.liveMarketingRules(params.liveRoomId!),
    enabled: isLoggedIn && !!params.liveRoomId,
  })

  const cartIds = params.cartItemIds?.split(',').filter(Boolean) || []
  const items = params.productId
    ? productQuery.data
      ? [{ id: productQuery.data.id, title: productQuery.data.title, coverUrl: productQuery.data.coverUrl, price: productQuery.data.price, quantity: buyQuantity }]
      : []
    : (cartQuery.data || [])
        .filter((item) => cartIds.includes(item.id))
        .map((item) => ({ id: item.id, title: item.product.title, coverUrl: item.product.coverUrl, price: item.product.price, quantity: item.quantity }))
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const marketingRules = marketingQuery.data || []
  const discountedTotal = items.reduce((sum, item) => sum + Math.round(item.price * bestPercent(marketingRules, item.id) / 100) * item.quantity, 0)
  const priceDiscount = Math.max(total - discountedTotal, 0)
  const fullReduction = marketingRules
    .filter((rule) => rule.type === 'FULL_REDUCTION' && rule.amount && discountedTotal >= (rule.minAmount || 0))
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))[0]
  const coupon = marketingRules
    .filter((rule) => rule.type === 'COUPON' && rule.amount && discountedTotal >= (rule.minAmount || 0))
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))[0]
  const liveDiscount = Math.min(priceDiscount + (fullReduction?.amount || 0) + (coupon?.amount || 0), total)
  const payAmount = Math.max(total - liveDiscount, 0)

  async function submit() {
    try {
      const order = await create.mutateAsync(
        params.productId
          ? { source: 'buyNow', productId: params.productId, quantity: buyQuantity, address: '北京市朝阳区测试地址', liveRoomId: params.liveRoomId }
          : { source: 'cart', cartItemIds: params.cartItemIds?.split(',') || [], address: '北京市朝阳区测试地址', liveRoomId: params.liveRoomId },
      )
      trackEvent({
        eventType: 'order_create',
        targetType: 'ORDER',
        targetId: order.id,
        liveRoomId: params.liveRoomId,
        productId: items[0]?.id,
        price: total,
        quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        source: params.productId ? 'buy_now' : 'cart',
        metadata: {
          orderNo: order.orderNo,
          productIds: items.map((item) => item.id),
          totalAmount: total,
          discountAmount: order.discountAmount,
          payAmount: order.payAmount,
        },
      })
      router.replace({ pathname: '/order/result', params: { id: order.id } })
    } catch (error) {
      Alert.alert('下单失败', (error as Error).message)
    }
  }

  if (!isLoggedIn || productQuery.isLoading || cartQuery.isLoading || marketingQuery.isLoading) return <LoadingView />

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
          {priceDiscount > 0 ? <Text>折扣优惠：-{formatPrice(priceDiscount)}</Text> : null}
          {fullReduction ? <Text>满减优惠：-{formatPrice(fullReduction.amount || 0)}</Text> : null}
          {coupon ? <Text>优惠券：-{formatPrice(coupon.amount || 0)}</Text> : null}
          {liveDiscount > 0 ? <Text style={{ color: '#e43d33' }}>优惠合计：-{formatPrice(liveDiscount)}</Text> : null}
          <Text style={{ fontSize: 18, fontWeight: '800' }}>应付：{formatPrice(payAmount)}</Text>
        </View>
      </ScrollView>
      <TouchableOpacity disabled={create.isPending || items.length === 0} onPress={submit} style={{ position: 'absolute', left: 16, right: 16, bottom: 18, height: 52, borderRadius: 8, backgroundColor: items.length === 0 ? '#ccc' : '#e43d33', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '800' }}>{create.isPending ? '提交中' : '提交订单'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}
