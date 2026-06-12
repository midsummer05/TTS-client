import { ResizeMode, Video } from 'expo-av'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Animated, BackHandler, Easing, Image, ImageBackground, PanResponder, Platform, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import { api } from '@/api'
import { API_BASE_URL, toMediaUrl } from '@/api/request'
import { Avatar } from '@/components/Avatar'
import { ProductSheet } from '@/components/ProductSheet'
import { ErrorState, LoadingView } from '@/components/StateViews'
import { useAuthPrompt } from '@/hooks/useAuthPrompt'
import { useUserStore } from '@/store/userStore'
import { useMiniLiveStore } from '@/store/miniLiveStore'
import type { Comment, MarketingRule, Product } from '@/types'
import { formatPrice } from '@/utils/formatPrice'
import { trackEvent } from '@/utils/trackEvent'

function bestMarketingPercent(rules: MarketingRule[], productId: string) {
  const percents = rules
    .filter((rule) => ['DISCOUNT', 'SECKILL'].includes(rule.type) && (!rule.productId || rule.productId === productId) && rule.discountPercent)
    .map((rule) => Math.max(1, Math.min(100, rule.discountPercent || 100)))
  return percents.length ? Math.min(...percents) : 100
}

function marketingPrice(product: Product, rules: MarketingRule[]) {
  const percent = bestMarketingPercent(rules, product.id)
  return Math.round(product.price * percent / 100)
}

function ruleApplies(rule: MarketingRule, productId?: string) {
  return !rule.productId || !productId || rule.productId === productId
}

function secondsLeft(rule?: MarketingRule, now = Date.now()) {
  if (rule?.countdownSeconds) {
    const startedAt = rule.createdAt ? new Date(rule.createdAt).getTime() : now
    return Math.max(0, rule.countdownSeconds - Math.floor((now - startedAt) / 1000))
  }
  if (!rule?.endsAt) return null
  return Math.max(0, Math.ceil((new Date(rule.endsAt).getTime() - now) / 1000))
}

function formatCountdown(value: number | null) {
  if (value == null) return ''
  const minutes = Math.floor(value / 60).toString().padStart(2, '0')
  const seconds = Math.floor(value % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

const PRODUCT_CARD_WIDTH = 156
const PRODUCT_CARD_HEIGHT = 188
const PRODUCT_CARD_RIGHT = 16
const PRODUCT_CARD_BOTTOM = 188

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function DanmakuItem({ comment, index, screenWidth, laneCount, topOffset }: { comment: Comment; index: number; screenWidth: number; laneCount: number; topOffset: number }) {
  const translateX = useRef(new Animated.Value(screenWidth)).current
  const lane = index % Math.max(laneCount, 1)

  useEffect(() => {
    translateX.setValue(screenWidth)
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 650),
        Animated.timing(translateX, {
          toValue: -screenWidth,
          duration: 8500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [comment.id, index, screenWidth, translateX])

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: topOffset + lane * 34,
        maxWidth: screenWidth * 0.78,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.48)',
        transform: [{ translateX }],
      }}
    >
      <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '700' }}>
        <Text style={{ color: '#8bb3ff' }}>{comment.user.nickname}：</Text>
        {comment.content}
      </Text>
    </Animated.View>
  )
}

export default function LiveRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [currentProduct, setCurrentProduct] = useState<Product>()
  const [sheetProduct, setSheetProduct] = useState<Product>()
  const [sheetVisible, setSheetVisible] = useState(false)
  const [content, setContent] = useState('')
  const [onlineCount, setOnlineCount] = useState(0)
  const [heat, setHeat] = useState(0)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [danmakuEnabled, setDanmakuEnabled] = useState(true)
  const [marketingRules, setMarketingRules] = useState<MarketingRule[]>([])
  const [nowTick, setNowTick] = useState(Date.now())
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const user = useUserStore((state) => state.user)
  const setMiniLiveRoom = useMiniLiveStore((state) => state.setRoom)
  const clearMiniLiveRoom = useMiniLiveStore((state) => state.clearRoom)
  const requireLogin = useAuthPrompt(`/live/${id}`)
  const queryClient = useQueryClient()
  const trackedRoomRef = useRef<string>()
  const productCardPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const productCardOffsetRef = useRef({ x: 0, y: 0 })
  const productCardDraggedRef = useRef(false)
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
  const marketingQuery = useQuery({ queryKey: ['live-marketing', roomId], queryFn: () => api.liveMarketingRules(roomId!), enabled: !!roomId })
  const socket = useMemo(() => io(`${API_BASE_URL}/live`, { autoConnect: false }), [])
  const productCardPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
    onPanResponderGrant: () => {
      productCardDraggedRef.current = false
      productCardPan.setOffset(productCardOffsetRef.current)
      productCardPan.setValue({ x: 0, y: 0 })
    },
    onPanResponderMove: (_, gesture) => {
      productCardDraggedRef.current = true
      productCardPan.setValue({ x: gesture.dx, y: gesture.dy })
    },
    onPanResponderRelease: (_, gesture) => {
      const baseLeft = screenWidth - PRODUCT_CARD_RIGHT - PRODUCT_CARD_WIDTH
      const baseTop = screenHeight - PRODUCT_CARD_BOTTOM - PRODUCT_CARD_HEIGHT
      const next = {
        x: clamp(productCardOffsetRef.current.x + gesture.dx, -baseLeft + 8, 8),
        y: clamp(productCardOffsetRef.current.y + gesture.dy, -baseTop + 88, PRODUCT_CARD_BOTTOM - 86),
      }
      productCardOffsetRef.current = next
      productCardPan.setOffset({ x: 0, y: 0 })
      productCardPan.setValue(next)
      setTimeout(() => {
        productCardDraggedRef.current = false
      }, 80)
    },
    onPanResponderTerminate: () => {
      productCardPan.setOffset({ x: 0, y: 0 })
      productCardPan.setValue(productCardOffsetRef.current)
      productCardDraggedRef.current = false
    },
  }), [productCardPan, screenHeight, screenWidth])

  const exitLiveRoom = useCallback(() => {
    const room = roomQuery.data
    if (!room) {
      router.back()
      return
    }
    Alert.alert('退出直播间', '是否需要开启小窗播放该直播？', [
      { text: '取消', style: 'cancel' },
      {
        text: '不开启',
        style: 'destructive',
        onPress: () => router.back(),
      },
      {
        text: '开启小窗',
        onPress: () => {
          setMiniLiveRoom(room)
          router.back()
        },
      },
    ])
  }, [roomQuery.data?.id, setMiniLiveRoom])

  useEffect(() => {
    const room = roomQuery.data
    if (!room) return
    clearMiniLiveRoom()
    setOnlineCount(room.onlineCount)
    setHeat(room.heat)
    setCurrentProduct(room.products.find((item) => item.id === room.currentProductId) || room.products[0])
    setMarketingRules(room.marketingRules || [])
    socket.connect()
    socket.emit('live:join', { liveRoomId: room.id, userId: user?.id || 'guest' })
    socket.on('live:current-product:update', ({ product }) => setCurrentProduct(product))
    socket.on('live:marketing:update', ({ rules }) => setMarketingRules(rules || []))
    socket.on('live:coupon:push', ({ coupon }) => {
      if (!coupon) return
      setMarketingRules((old) => old.some((item) => item.id === coupon.id) ? old : [...old, coupon])
    })
    socket.on('live:online:update', (payload) => {
      setOnlineCount(payload.onlineCount)
      setHeat(payload.heat)
    })
    socket.on('live:comment:new', (comment: Comment) => {
      queryClient.setQueryData<Comment[]>(['live-comments', room.id], (old = []) => {
        if (old.some((item) => item.id === comment.id)) return old
        return [...old.slice(-49), comment]
      })
    })
    return () => {
      socket.emit('live:leave', { liveRoomId: room.id, userId: user?.id || 'guest' })
      socket.off('live:current-product:update')
      socket.off('live:marketing:update')
      socket.off('live:coupon:push')
      socket.off('live:online:update')
      socket.off('live:comment:new')
      socket.disconnect()
    }
  }, [roomQuery.data?.id, user?.id])

  useEffect(() => {
    const room = roomQuery.data
    if (!room || trackedRoomRef.current === room.id) return
    trackedRoomRef.current = room.id
    const product = room.products.find((item) => item.id === room.currentProductId) || room.products[0]
    trackEvent({
      eventType: 'live_enter',
      targetType: 'LIVE_ROOM',
      targetId: room.id,
      liveRoomId: room.id,
      productId: product?.id,
      category: product?.category,
      price: product?.price,
      source: 'live_room',
    })
  }, [roomQuery.data?.id])

  useEffect(() => {
    if (marketingQuery.data) setMarketingRules(marketingQuery.data)
  }, [marketingQuery.data])

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web') return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      exitLiveRoom()
      return true
    })
    return () => subscription.remove()
  }, [exitLiveRoom]))

  async function sendComment() {
    const text = content.trim()
    if (!text || !roomQuery.data) return
    if (!requireLogin('comment', `/live/${id}`)) return
    const created = await api.sendLiveComment(roomQuery.data.id, text)
    queryClient.setQueryData<Comment[]>(['live-comments', roomQuery.data.id], (old = []) => {
      if (old.some((comment) => comment.id === created.id)) return old
      return [...old.slice(-49), created]
    })
    setContent('')
  }

  if (roomQuery.isLoading) return <LoadingView />
  if (roomQuery.isError || !roomQuery.data) return <ErrorState message={(roomQuery.error as Error)?.message || '直播间不存在'} onRetry={() => roomQuery.refetch()} />

  const room = roomQuery.data
  const comments = commentsQuery.data || []
  const recentComments = comments.slice(-5)
  const danmakuHeight = Math.max(92, screenHeight * 0.3)
  const danmakuTopOffset = 84
  const danmakuLaneCount = Math.max(1, Math.floor(Math.max(34, danmakuHeight - danmakuTopOffset) / 34))
  const danmakuComments = comments.slice(-Math.min(10, danmakuLaneCount * 2))
  const audience = audienceQuery.data || []
  const isWeb = Platform.OS === 'web'
  const couponRule = marketingRules.find((rule) => rule.type === 'COUPON')
  const fullReductionRule = marketingRules.find((rule) => rule.type === 'FULL_REDUCTION')
  const seckillRule = marketingRules.find((rule) => rule.type === 'SECKILL' && ruleApplies(rule, currentProduct?.id))
  const productPrice = currentProduct ? marketingPrice(currentProduct, marketingRules) : 0
  const hasProductDiscount = currentProduct ? productPrice < currentProduct.price : false
  const seckillLeft = secondsLeft(seckillRule, nowTick)

  return (
    <ImageBackground source={{ uri: toMediaUrl(room.coverUrl) }} style={{ flex: 1 }} blurRadius={isWeb ? 10 : 4}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(18,18,22,0.82)' }}>
        <View style={{ flex: 1, flexDirection: isWeb ? 'row' : 'column' }}>
          <View style={{ flex: 1.28, backgroundColor: '#111', position: 'relative', overflow: 'hidden' }}>
            <Video source={{ uri: toMediaUrl(room.videoUrl || room.coverUrl) }} posterSource={{ uri: toMediaUrl(room.coverUrl) }} usePoster shouldPlay={!paused} isMuted={muted} isLooping resizeMode={ResizeMode.CONTAIN} style={{ position: 'absolute', inset: 0 }} />
            <View style={{ position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity onPress={exitLiveRoom} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 28 }}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => room.anchorUserId && router.push({ pathname: '/user/[id]', params: { id: room.anchorUserId } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, paddingRight: 12, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.45)' }}>
                <Avatar uri={room.anchorAvatar} name={room.anchorName} size={38} />
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

            {danmakuEnabled ? (
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: danmakuHeight, overflow: 'hidden' }}>
                {danmakuComments.map((comment, index) => (
                  <DanmakuItem key={`${comment.id}-danmaku-${index}`} comment={comment} index={index} screenWidth={screenWidth} laneCount={danmakuLaneCount} topOffset={danmakuTopOffset} />
                ))}
              </View>
            ) : null}

            {currentProduct ? (
              <Animated.View
                {...productCardPanResponder.panHandlers}
                style={{
                  position: 'absolute',
                  right: PRODUCT_CARD_RIGHT,
                  bottom: PRODUCT_CARD_BOTTOM,
                  width: PRODUCT_CARD_WIDTH,
                  transform: productCardPan.getTranslateTransform(),
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => {
                    if (productCardDraggedRef.current) return
                    trackEvent({
                      eventType: 'product_click',
                      targetType: 'PRODUCT',
                      targetId: currentProduct.id,
                      liveRoomId: room.id,
                      productId: currentProduct.id,
                      category: currentProduct.category,
                      price: currentProduct.price,
                      source: 'live_current_product',
                    })
                    setSheetProduct(currentProduct)
                    setSheetVisible(true)
                  }}
                  style={{ borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden' }}
                >
                  <View style={{ position: 'absolute', zIndex: 2, left: 8, top: 8, borderRadius: 4, backgroundColor: '#ff315f', paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: '#fff', fontWeight: '900' }}>{seckillRule ? `秒杀 ${formatCountdown(seckillLeft)}` : hasProductDiscount ? '限时折扣' : '讲解中'}</Text>
                  </View>
                  <Image source={{ uri: toMediaUrl(currentProduct.coverUrl) }} style={{ width: '100%', height: 112 }} resizeMode="cover" />
                  <View style={{ padding: 8 }}>
                    <Text numberOfLines={2} style={{ color: '#17171b', fontWeight: '800', fontSize: 13 }}>{currentProduct.title}</Text>
                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View>
                        <Text style={{ color: '#ff315f', fontSize: 17, fontWeight: '900' }}>{formatPrice(productPrice)}</Text>
                        {hasProductDiscount ? <Text style={{ color: '#999', textDecorationLine: 'line-through', fontSize: 12 }}>{formatPrice(currentProduct.price)}</Text> : null}
                      </View>
                      <Text style={{ color: '#fff', backgroundColor: '#ff315f', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, fontWeight: '900' }}>抢</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ) : null}
            {couponRule || fullReductionRule ? (
              <View style={{ position: 'absolute', left: 14, right: 14, top: 86, gap: 8 }}>
                {couponRule ? (
                  <TouchableOpacity
                    onPress={() => {
                      trackEvent({
                        eventType: 'coupon_claim',
                        targetType: 'MARKETING_RULE',
                        targetId: couponRule.id,
                        liveRoomId: room.id,
                        productId: couponRule.productId || currentProduct?.id,
                        source: 'live_room',
                        metadata: { amount: couponRule.amount, minAmount: couponRule.minAmount },
                      })
                      Alert.alert('领取成功', `${couponRule.title} 已领取，下单时自动抵扣`)
                    }}
                    style={{ alignSelf: 'flex-start', borderRadius: 12, backgroundColor: 'rgba(255,49,95,0.9)', paddingHorizontal: 12, paddingVertical: 8 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '900' }}>{couponRule.title} · 满{formatPrice(couponRule.minAmount || 0)}减{formatPrice(couponRule.amount || 0)}  领取</Text>
                  </TouchableOpacity>
                ) : null}
                {fullReductionRule ? (
                  <View style={{ alignSelf: 'flex-start', borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>{fullReductionRule.title} · 满{formatPrice(fullReductionRule.minAmount || 0)}减{formatPrice(fullReductionRule.amount || 0)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            <TouchableOpacity
              onPress={() => {
                const product = currentProduct || room.products[0]
                if (product) {
                  trackEvent({
                    eventType: 'product_list_open',
                    targetType: 'LIVE_ROOM',
                    targetId: room.id,
                    liveRoomId: room.id,
                    productId: product.id,
                    category: product.category,
                    price: product.price,
                    source: 'live_room',
                  })
                }
                setSheetProduct(product)
                setSheetVisible(true)
              }}
              style={{ position: 'absolute', right: 18, bottom: 132, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 18, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '900' }}>全部商品 ›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (!requireLogin('cart', `/live/${id}`)) return
                trackEvent({
                  eventType: 'cart_open',
                  targetType: 'LIVE_ROOM',
                  targetId: room.id,
                  liveRoomId: room.id,
                  source: 'live_room',
                })
                router.push({ pathname: '/cart', params: { liveRoomId: room.id, liveProductIds: room.products.map((item) => item.id).join(',') } })
              }}
              style={{ position: 'absolute', right: 18, bottom: 76, borderRadius: 24, backgroundColor: 'rgba(255,49,95,0.88)', paddingHorizontal: 18, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '900' }}>购物车</Text>
            </TouchableOpacity>
            <View style={{ position: 'absolute', left: 14, bottom: isWeb ? 18 : 70, flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => setPaused((value) => !value)} style={{ height: 38, paddingHorizontal: 13, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '900' }}>{paused ? '播放' : '暂停'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMuted((value) => !value)} style={{ height: 38, paddingHorizontal: 13, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '900' }}>{muted ? '取消静音' : '静音'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setDanmakuEnabled((value) => !value)} style={{ height: 38, paddingHorizontal: 13, borderRadius: 19, backgroundColor: danmakuEnabled ? 'rgba(255,49,95,0.82)' : 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '900' }}>{danmakuEnabled ? '弹幕开' : '弹幕关'}</Text>
              </TouchableOpacity>
            </View>
            {!isWeb ? (
              <>
                <ScrollView
                  bounces
                  decelerationRate="fast"
                  nestedScrollEnabled
                  overScrollMode="always"
                  scrollEventThrottle={16}
                  style={{ position: 'absolute', left: 14, right: 132, bottom: 116, maxHeight: 172 }}
                  contentContainerStyle={{ gap: 8, justifyContent: 'flex-end' }}
                  showsVerticalScrollIndicator={false}
                >
                  {(recentComments.length ? comments : []).map((comment, index) => (
                    <View key={`${comment.id}-overlay-${index}`} style={{ alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.42)' }}>
                      <Text numberOfLines={2} style={{ color: '#fff', lineHeight: 19 }}>
                        <Text style={{ color: '#8bb3ff', fontWeight: '900' }}>{comment.user.nickname}：</Text>
                        {comment.content}
                      </Text>
                    </View>
                  ))}
                  {!recentComments.length ? (
                    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.38)' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.82)' }}>还没有评论，来和主播互动</Text>
                    </View>
                  ) : null}
                </ScrollView>
                <View style={{ position: 'absolute', left: 14, right: 14, bottom: 18, flexDirection: 'row', gap: 8 }}>
                  <TextInput value={content} onChangeText={setContent} placeholder="和主播互动..." placeholderTextColor="rgba(255,255,255,0.72)" style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff', paddingHorizontal: 16 }} />
                  <TouchableOpacity onPress={sendComment} style={{ width: 64, height: 44, borderRadius: 22, backgroundColor: '#ff315f', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '900' }}>发送</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>

          <View style={{ width: isWeb ? 360 : '100%', display: isWeb ? 'flex' : 'none', backgroundColor: '#252532', padding: 16 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>在线观众 · {onlineCount.toLocaleString()}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 14 }}>
              {audience.slice(0, 5).map((item) => (
                <Avatar key={item.id} uri={item.avatarUrl} name={item.nickname} size={34} />
              ))}
            </View>
            <View style={{ backgroundColor: '#303040', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: '#ffc142', lineHeight: 20 }}>在直播中以不当方式诱导消费，请谨慎辨别。切勿私下交易，以防人身财产损失。</Text>
            </View>
            <ScrollView
              bounces
              decelerationRate="fast"
              nestedScrollEnabled
              overScrollMode="always"
              scrollEventThrottle={16}
              style={{ maxHeight: 210 }}
              contentContainerStyle={{ gap: 12 }}
              showsVerticalScrollIndicator={comments.length > 5}
            >
              {comments.map((comment, index) => (
                <View key={`${comment.id}-${index}`} style={{ flexDirection: 'row', gap: 8 }}>
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
          product={sheetProduct || currentProduct}
          products={room.products}
          visible={sheetVisible}
          onClose={() => { setSheetVisible(false); setSheetProduct(undefined) }}
          onAddCart={async (product, quantity) => {
            if (!requireLogin('cart', `/live/${id}`)) return
            await api.addCart(product.id, quantity)
            trackEvent({
              eventType: 'cart_add',
              targetType: 'PRODUCT',
              targetId: product.id,
              liveRoomId: room.id,
              productId: product.id,
              category: product.category,
              price: product.price,
              quantity,
              source: 'live_product_sheet',
            })
            Alert.alert('已加入购物车')
          }}
          onBuyNow={(product, quantity) => {
            if (!requireLogin('buy', `/live/${id}`)) return
            setSheetVisible(false)
            trackEvent({
              eventType: 'buy_now_click',
              targetType: 'PRODUCT',
              targetId: product.id,
              liveRoomId: room.id,
              productId: product.id,
              category: product.category,
              price: product.price,
              quantity,
              source: 'live_product_sheet',
            })
            router.push({ pathname: '/order/confirm', params: { productId: product.id, quantity: String(quantity), liveRoomId: room.id } })
          }}
        />
      </SafeAreaView>
    </ImageBackground>
  )
}
