import { useMutation, useQuery } from '@tanstack/react-query'
import { router, useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { useRef, useState } from 'react'
import {
  Alert,
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  ViewToken,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/api'
import { BottomNav } from '@/components/BottomNav'
import { FeedItem } from '@/components/FeedItem'
import { EmptyState, ErrorState, LoadingView } from '@/components/StateViews'
import { ProductSheet } from '@/components/ProductSheet'
import { useUserStore } from '@/store/userStore'
import type { Product, VideoItem } from '@/types'

const height = Dimensions.get('window').height

export default function FeedScreen() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedProduct, setSelectedProduct] = useState<Product>()
  const [muted, setMuted] = useState(false)
  const [screenFocused, setScreenFocused] = useState(true)

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true)
      return () => setScreenFocused(false)
    }, [])
  )
  const session = useUserStore()
  const query = useQuery({ queryKey: ['videos'], queryFn: () => api.videos() })
  const liveRooms = useQuery({
    queryKey: ['live-rooms'],
    queryFn: () => api.liveRooms(),
  })
  const login = useMutation({
    mutationFn: () => api.login('移动端用户'),
    onSuccess: session.setSession,
  })
  const addCart = useMutation({
    mutationFn: (productId: string) => api.addCart(productId),
  })

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 })
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null)
        setActiveIndex(viewableItems[0].index)
    },
  )

  async function ensureLogin() {
    if (!session.token) await login.mutateAsync()
  }

  async function handleAddCart(product: Product) {
    await ensureLogin()
    await addCart.mutateAsync(product.id)
    Alert.alert('已加入购物车')
  }

  async function handleBuyNow(product: Product) {
    await ensureLogin()
    router.push({
      pathname: '/order/confirm',
      params: { productId: product.id },
    })
  }

  if (query.isLoading) return <LoadingView />
  if (query.isError)
    return (
      <ErrorState
        message={(query.error as Error).message}
        onRetry={() => query.refetch()}
      />
    )
  if (!query.data?.items.length) return <EmptyState text="暂无内容" />

  function updateActiveFromOffset(offsetY: number, pageHeight: number) {
    const next = Math.round(offsetY / Math.max(pageHeight, 1))
    if (next !== activeIndex) setActiveIndex(next)
  }

  function liveRoomIdFor(item: VideoItem) {
    return liveRooms.data?.find(
      (room) =>
        room.anchorUserId === item.userId ||
        room.anchorName === item.authorName,
    )?.id
  }

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: '#000' }}>
      {Platform.OS === 'web' ? (
        <ScrollView
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onScroll={(event) =>
            updateActiveFromOffset(
              event.nativeEvent.contentOffset.y,
              event.nativeEvent.layoutMeasurement.height || height,
            )
          }
          onMomentumScrollEnd={(event) =>
            updateActiveFromOffset(
              event.nativeEvent.contentOffset.y,
              event.nativeEvent.layoutMeasurement.height || height,
            )
          }
          scrollEventThrottle={16}
        >
          {query.data.items.map((item, index) => (
            <FeedItem
              key={item.id}
              item={item}
              active={index === activeIndex}
              screenFocused={screenFocused}
              muted={muted}
              onToggleMute={() => setMuted((v) => !v)}
              onProductPress={setSelectedProduct}
              onCartPress={() => router.push('/cart')}
              onLivePress={
                liveRoomIdFor(item)
                  ? () =>
                      router.push({
                        pathname: '/live/[id]',
                        params: { id: liveRoomIdFor(item)! },
                      })
                  : undefined
              }
            />
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={query.data.items}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({
            length: height,
            offset: height * index,
            index,
          })}
          viewabilityConfig={viewabilityConfig.current}
          onViewableItemsChanged={onViewableItemsChanged.current}
          renderItem={({ item, index }: { item: VideoItem; index: number }) => (
            <FeedItem
              item={item}
              active={index === activeIndex}
              screenFocused={screenFocused}
              muted={muted}
              onToggleMute={() => setMuted((v) => !v)}
              onProductPress={setSelectedProduct}
              onCartPress={() => router.push('/cart')}
              onLivePress={
                liveRoomIdFor(item)
                  ? () =>
                      router.push({
                        pathname: '/live/[id]',
                        params: { id: liveRoomIdFor(item)! },
                      })
                  : undefined
              }
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
