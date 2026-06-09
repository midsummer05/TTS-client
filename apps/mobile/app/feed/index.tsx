import { useMutation, useQuery } from '@tanstack/react-query'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Alert, Dimensions, FlatList, Platform, ScrollView, ViewToken } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/api'
import { BottomNav } from '@/components/BottomNav'
import { FeedItem } from '@/components/FeedItem'
import { EmptyState, ErrorState, LoadingView } from '@/components/StateViews'
import { ProductSheet } from '@/components/ProductSheet'
import { useAuthPrompt } from '@/hooks/useAuthPrompt'
import { useUserStore } from '@/store/userStore'
import type { Product, VideoItem } from '@/types'

const height = Dimensions.get('window').height

export default function FeedScreen() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedProduct, setSelectedProduct] = useState<Product>()
  const [feedPlaying, setFeedPlaying] = useState(true)
  const token = useUserStore((state) => state.token)
  const requireLogin = useAuthPrompt('/feed')
  const query = useQuery({ queryKey: ['videos', token ? 'authed' : 'guest'], queryFn: () => api.videos() })
  const addCart = useMutation({ mutationFn: (productId: string) => api.addCart(productId) })

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 })
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveIndex(viewableItems[0].index)
  })

  useFocusEffect(
    useCallback(() => {
      setFeedPlaying(true)
      return () => setFeedPlaying(false)
    }, []),
  )

  async function handleAddCart(product: Product) {
    if (!requireLogin('cart', '/feed')) return
    await addCart.mutateAsync(product.id)
    Alert.alert('已加入购物车')
  }

  async function handleBuyNow(product: Product) {
    if (!requireLogin('buy', '/feed')) return
    router.push({ pathname: '/order/confirm', params: { productId: product.id } })
  }

  if (query.isLoading) return <LoadingView />
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
  if (!query.data?.items.length) return <EmptyState text="暂无内容" />

  function updateActiveFromOffset(offsetY: number, pageHeight: number) {
    const next = Math.round(offsetY / Math.max(pageHeight, 1))
    if (next !== activeIndex) setActiveIndex(next)
  }

  function liveRoomIdFor(item: VideoItem) {
    return item.liveRoomId
  }

  function openLiveRoom(id: string) {
    setFeedPlaying(false)
    setSelectedProduct(undefined)
    router.push({ pathname: '/live/[id]', params: { id } })
  }

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: '#000' }}>
      {Platform.OS === 'web' ? (
        <ScrollView
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onScroll={(event) => updateActiveFromOffset(event.nativeEvent.contentOffset.y, event.nativeEvent.layoutMeasurement.height || height)}
          onMomentumScrollEnd={(event) => updateActiveFromOffset(event.nativeEvent.contentOffset.y, event.nativeEvent.layoutMeasurement.height || height)}
          scrollEventThrottle={16}
        >
          {query.data.items.map((item, index) => (
            <FeedItem
              key={item.id}
              item={item}
              active={feedPlaying && index === activeIndex}
              feedPlaying={feedPlaying}
              onProductPress={setSelectedProduct}
              onCartPress={() => router.push('/cart')}
              onLivePress={liveRoomIdFor(item) ? () => openLiveRoom(liveRoomIdFor(item)!) : undefined}
            />
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={query.data.items}
          keyExtractor={(item) => item.id}
          pagingEnabled
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          windowSize={3}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          viewabilityConfig={viewabilityConfig.current}
          onViewableItemsChanged={onViewableItemsChanged.current}
          renderItem={({ item, index }: { item: VideoItem; index: number }) => (
            <FeedItem
              item={item}
              active={feedPlaying && index === activeIndex}
              feedPlaying={feedPlaying}
              onProductPress={setSelectedProduct}
              onCartPress={() => router.push('/cart')}
              onLivePress={liveRoomIdFor(item) ? () => openLiveRoom(liveRoomIdFor(item)!) : undefined}
            />
          )}
        />
      )}
      <ProductSheet
        product={selectedProduct}
        visible={!!selectedProduct}
        onClose={() => setSelectedProduct(undefined)}
        onAddCart={handleAddCart}
        onBuyNow={handleBuyNow}
      />
      <BottomNav active="feed" />
    </SafeAreaView>
  )
}
