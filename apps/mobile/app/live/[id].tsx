import { ResizeMode, Video } from 'expo-av'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Image, ImageBackground, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import { api } from '@/api'
import { API_BASE_URL, toMediaUrl } from '@/api/request'
import { ProductSheet } from '@/components/ProductSheet'
import { ErrorState, LoadingView } from '@/components/StateViews'
import { useUserStore } from '@/store/userStore'
import type { Comment, Product } from '@/types'
import { formatPrice } from '@/utils/formatPrice'

export default function LiveRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [currentProduct, setCurrentProduct] = useState<Product>()
  const [sheetVisible, setSheetVisible] = useState(false)
  const [content, setContent] = useState('')
  const [onlineCount, setOnlineCount] = useState(0)
  const [heat, setHeat] = useState(0)
  const user = useUserStore((state) => state.user)
  const queryClient = useQueryClient()
  const roomQuery = useQuery({
    queryKey: ['live-room', id],
    queryFn: async () => {
      const rooms = await api.liveRooms()
      const firstId = id === 'first' ? rooms[0]?.id : id
      return api.liveRoom(firstId)
    },
  })
  const roomId = roomQuery.data?.id
  const commentsQuery = useQuery({ queryKey: ['live-comments', roomId], queryFn: () => api.liveComments(roomId!), enabled: !!roomId })
  const audienceQuery = useQuery({ queryKey: ['live-audience', roomId], queryFn: () => api.liveAudience(roomId!), enabled: !!roomId })
  const socket = useMemo(() => io(`${API_BASE_URL}/live`, { autoConnect: false }), [])

  useEffect(() => {
    const room = roomQuery.data
    if (!room) return
    setOnlineCount(room.onlineCount)
    setHeat(room.heat)
    setCurrentProduct(room.products.find((item) => item.id === room.currentProductId) || room.products[0])
    socket.connect()
    socket.emit('live:join', { liveRoomId: room.id, userId: user?.id || 'guest' })
    socket.on('live:current-product:update', ({ product }) => setCurrentProduct(product))
    socket.on('live:online:update', (payload) => {
      setOnlineCount(payload.onlineCount)
      setHeat(payload.heat)
    })
    socket.on('live:comment:new', (comment: Comment) => {
      queryClient.setQueryData<Comment[]>(['live-comments', room.id], (old = []) => [...old.slice(-49), comment])
    })
    return () => {
      socket.emit('live:leave', { liveRoomId: room.id, userId: user?.id || 'guest' })
      socket.off('live:current-product:update')
      socket.off('live:online:update')
      socket.off('live:comment:new')
      socket.disconnect()
    }
  }, [roomQuery.data?.id, user?.id])

  async function sendComment() {
    const text = content.trim()
    if (!text || !roomQuery.data) return
    await api.sendLiveComment(roomQuery.data.id, text)
    setContent('')
  }

  if (roomQuery.isLoading) return <LoadingView />
  if (roomQuery.isError || !roomQuery.data) return <ErrorState message={(roomQuery.error as Error)?.message || '直播间不存在'} onRetry={() => roomQuery.refetch()} />

  const room = roomQuery.data
  const comments = commentsQuery.data || []
  const audience = audienceQuery.data || []

  return (
    <ImageBackground source={{ uri: toMediaUrl(room.coverUrl) }} style={{ flex: 1 }} blurRadius={Platform.OS === 'web' ? 10 : 4}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(18,18,22,0.82)' }}>
        <View style={{ flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column' }}>
          <View style={{ flex: 1.28, backgroundColor: '#111', position: 'relative', overflow: 'hidden' }}>
            <Video source={{ uri: toMediaUrl(room.videoUrl || room.coverUrl) }} posterSource={{ uri: toMediaUrl(room.coverUrl) }} usePoster shouldPlay isLooping resizeMode={ResizeMode.CONTAIN} style={{ position: 'absolute', inset: 0 }} />
            <View style={{ position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 28 }}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => room.anchorUserId && router.push({ pathname: '/user/[id]', params: { id: room.anchorUserId } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, paddingRight: 12, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.45)' }}>
                <Image source={{ uri: toMediaUrl(room.anchorAvatar) || 'https://api.dicebear.com/9.x/thumbs/png?seed=anchor' }} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#333' }} />
                <View>
                  <Text style={{ color: '#fff', fontWeight: '900' }}>{room.anchorName}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12 }}>{room.title}</Text>
                </View>
              </TouchableOpacity>
              <View style={{ marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.46)' }}>
                <Text style={{ color: '#fff', fontWeight: '900' }}>人气榜</Text>
                <Text style={{ color: '#fff', marginTop: 2 }}>{Math.max(Math.floor(heat / 100), 100)}+</Text>
              </View>
            </View>

            {currentProduct ? (
              <TouchableOpacity onPress={() => setSheetVisible(true)} style={{ position: 'absolute', right: 18, bottom: 92, width: 188, borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden' }}>
                <View style={{ position: 'absolute', zIndex: 2, left: 8, top: 8, borderRadius: 4, backgroundColor: '#ff315f', paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: '#fff', fontWeight: '900' }}>秒杀</Text>
                </View>
                <Image source={{ uri: toMediaUrl(currentProduct.coverUrl) }} style={{ width: '100%', height: 150 }} resizeMode="cover" />
                <View style={{ padding: 10 }}>
                  <Text numberOfLines={2} style={{ color: '#17171b', fontWeight: '800' }}>{currentProduct.title}</Text>
                  <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#ff315f', fontSize: 20, fontWeight: '900' }}>{formatPrice(currentProduct.price)}</Text>
                    <Text style={{ color: '#fff', backgroundColor: '#ff315f', borderRadius: 4, paddingHorizontal: 9, paddingVertical: 5, fontWeight: '900' }}>抢</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => socket.emit('live:like', { liveRoomId: room.id, userId: user?.id || 'guest' })} style={{ position: 'absolute', right: 18, bottom: 34, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 18, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '900' }}>全部商品 ›</Text>
            </TouchableOpacity>
          </View>

          <View style={{ width: Platform.OS === 'web' ? 360 : '100%', maxHeight: Platform.OS === 'web' ? undefined : 310, backgroundColor: '#252532', padding: 16 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>在线观众 · {onlineCount.toLocaleString()}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 14 }}>
              {audience.slice(0, 5).map((item) => (
                <Image key={item.id} source={{ uri: toMediaUrl(item.avatarUrl) || `https://api.dicebear.com/9.x/thumbs/png?seed=${item.id}` }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#444' }} />
              ))}
            </View>
            <View style={{ backgroundColor: '#303040', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: '#ffc142', lineHeight: 20 }}>在直播中以不当方式诱导消费，请谨慎辨别。切勿私下交易，以防人身财产损失。</Text>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12 }}>
              {comments.map((comment) => (
                <View key={comment.id} style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ color: '#7da6ff', fontWeight: '800' }}>{comment.user.nickname}：</Text>
                  <Text style={{ color: '#f3f5ff', flex: 1 }}>{comment.content}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, paddingTop: 12 }}>
              <TextInput value={content} onChangeText={setContent} placeholder="和主播互动..." placeholderTextColor="#a4a4b5" style={{ flex: 1, height: 42, borderRadius: 21, backgroundColor: '#1d1d27', color: '#fff', paddingHorizontal: 14 }} />
              <TouchableOpacity onPress={sendComment} style={{ width: 64, height: 42, borderRadius: 21, backgroundColor: '#ff315f', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '900' }}>发送</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <ProductSheet
          product={currentProduct}
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          onAddCart={async (product) => {
            await api.addCart(product.id)
            Alert.alert('已加入购物车')
          }}
          onBuyNow={(product) => {
            setSheetVisible(false)
            router.push({ pathname: '/order/confirm', params: { productId: product.id } })
          }}
        />
      </SafeAreaView>
    </ImageBackground>
  )
}
