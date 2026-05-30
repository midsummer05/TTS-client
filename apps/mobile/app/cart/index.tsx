import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/api'
import { EmptyState, ErrorState, LoadingView } from '@/components/StateViews'
import { formatPrice } from '@/utils/formatPrice'

export default function CartScreen() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['cart'], queryFn: api.cart })
  const update = useMutation({ mutationFn: ({ id, quantity }: { id: string; quantity: number }) => api.updateCart(id, quantity), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }) })
  const select = useMutation({ mutationFn: ({ id, selected }: { id: string; selected: boolean }) => api.selectCart(id, selected), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }) })
  const remove = useMutation({ mutationFn: api.deleteCart, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }) })

  if (query.isLoading) return <LoadingView />
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
  if (!query.data?.length) return <EmptyState text="购物车空空的" />

  const selectedItems = query.data.filter((item) => item.selected)
  const total = selectedItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f6f6' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
        <Text style={{ fontSize: 24, fontWeight: '800' }}>购物车</Text>
        {query.data.map((item) => (
          <View key={item.id} style={{ flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 8, padding: 12 }}>
            <TouchableOpacity onPress={() => select.mutate({ id: item.id, selected: !item.selected })} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: item.selected ? '#111' : '#ddd', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff' }}>✓</Text>
            </TouchableOpacity>
            <Image source={{ uri: item.product.coverUrl }} style={{ width: 76, height: 76, borderRadius: 8 }} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={{ fontWeight: '700', color: '#111' }}>{item.product.title}</Text>
              <Text style={{ color: '#e43d33', fontWeight: '800', marginTop: 6 }}>{formatPrice(item.product.price)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <TouchableOpacity onPress={() => update.mutate({ id: item.id, quantity: Math.max(1, item.quantity - 1) })}><Text style={{ fontSize: 20 }}>-</Text></TouchableOpacity>
                <Text>{item.quantity}</Text>
                <TouchableOpacity onPress={() => update.mutate({ id: item.id, quantity: item.quantity + 1 })}><Text style={{ fontSize: 20 }}>+</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => remove.mutate(item.id)} style={{ marginLeft: 'auto' }}><Text style={{ color: '#777' }}>删除</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800' }}>合计 {formatPrice(total)}</Text>
        <TouchableOpacity
          onPress={() => selectedItems.length ? router.push({ pathname: '/order/confirm', params: { cartItemIds: selectedItems.map((item) => item.id).join(',') } }) : Alert.alert('请选择商品')}
          style={{ backgroundColor: '#e43d33', paddingHorizontal: 24, height: 48, borderRadius: 8, justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>结算</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
