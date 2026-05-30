import { useMutation, useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/api'
import { ErrorState, LoadingView } from '@/components/StateViews'
import { formatPrice } from '@/utils/formatPrice'

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useQuery({ queryKey: ['product', id], queryFn: () => api.product(id) })
  const addCart = useMutation({ mutationFn: (productId: string) => api.addCart(productId) })

  if (query.isLoading) return <LoadingView />
  if (query.isError || !query.data) return <ErrorState message={(query.error as Error)?.message || '商品不存在'} onRetry={() => query.refetch()} />

  const product = query.data

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <Image source={{ uri: product.coverUrl }} style={{ width: '100%', height: 360, backgroundColor: '#eee' }} resizeMode="cover" />
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#111' }}>{product.title}</Text>
          <Text style={{ marginTop: 12, fontSize: 28, fontWeight: '900', color: '#e43d33' }}>{formatPrice(product.price)}</Text>
          <Text style={{ marginTop: 8, color: '#777' }}>库存 {product.stock} · 已售 {product.sales}</Text>
          <Text style={{ marginTop: 18, lineHeight: 22, color: '#444' }}>{product.description}</Text>
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: '#fff', flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity
          onPress={async () => {
            await addCart.mutateAsync(product.id)
            Alert.alert('已加入购物车')
          }}
          style={{ flex: 1, height: 48, borderRadius: 8, backgroundColor: '#ffb020', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#111', fontWeight: '800' }}>加入购物车</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push({ pathname: '/order/confirm', params: { productId: product.id } })} style={{ flex: 1, height: 48, borderRadius: 8, backgroundColor: '#e43d33', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>立即购买</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
