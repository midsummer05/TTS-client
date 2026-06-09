import { Video, ResizeMode } from 'expo-av'
import { router } from 'expo-router'
import { Image, Platform, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { CommentSheet } from './CommentSheet'
import { FeedActionSidebar } from './FeedActionSidebar'
import { ShareSheet } from './ShareSheet'
import { api } from '@/api'
import { toMediaUrl } from '@/api/request'
import { useAuthPrompt } from '@/hooks/useAuthPrompt'
import { useUserStore } from '@/store/userStore'
import type { Product, VideoItem } from '@/types'
import { formatPrice } from '@/utils/formatPrice'

export function FeedItem({
  item,
  active,
  feedPlaying = true,
  onProductPress,
  onCartPress,
  onLivePress,
}: {
  item: VideoItem
  active: boolean
  feedPlaying?: boolean
  onProductPress: (product: Product) => void
  onCartPress: () => void
  onLivePress?: () => void
}) {
  const product = item.products[0]
  const token = useUserStore((state) => state.token)
  const requireLogin = useAuthPrompt('/feed')
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const videoRef = useRef<Video>(null)
  const [followed, setFollowed] = useState(false)
  const [liked, setLiked] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [likeCount, setLikeCount] = useState(item.likeCount)
  const [favoriteCount, setFavoriteCount] = useState(item.favoriteCount || 0)
  const [commentsVisible, setCommentsVisible] = useState(false)
  const [shareVisible, setShareVisible] = useState(false)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [positionMillis, setPositionMillis] = useState(0)
  const [durationMillis, setDurationMillis] = useState(0)
  const [videoAspect, setVideoAspect] = useState(9 / 16)

  useEffect(() => {
    const player = videoRef.current
    if (!player) return
    if (feedPlaying && active && !paused) {
      player.playAsync().catch(() => null)
    } else {
      player.pauseAsync().catch(() => null)
    }
  }, [active, feedPlaying, paused])

  useEffect(() => {
    if (!active) setPaused(false)
  }, [active])

  useEffect(() => {
    setLikeCount(item.likeCount)
    setFavoriteCount(item.favoriteCount || 0)
    setLiked(!!token && !!item.likedByMe)
    setFavorited(!!token && !!item.favoritedByMe)
  }, [item.favoriteCount, item.favoritedByMe, item.id, item.likeCount, item.likedByMe, token])

  async function togglePaused() {
    const next = !paused
    setPaused(next)
    if (next) await videoRef.current?.pauseAsync().catch(() => null)
    else await videoRef.current?.playAsync().catch(() => null)
  }

  const progress = durationMillis > 0 ? Math.min(positionMillis / durationMillis, 1) : 0
  const screenAspect = screenWidth / Math.max(screenHeight, 1)
  const videoWidth = screenAspect > videoAspect ? screenHeight * videoAspect : screenWidth
  const videoHeight = screenAspect > videoAspect ? screenHeight : screenWidth / videoAspect
  const shouldRenderVideo = Platform.OS === 'web' || active
  const videoBoxStyle = {
    position: 'absolute' as const,
    left: (screenWidth - videoWidth) / 2,
    top: (screenHeight - videoHeight) / 2,
    width: videoWidth,
    height: videoHeight,
    backgroundColor: '#000',
  }

  return (
    <View style={{ width: screenWidth, height: screenHeight, backgroundColor: '#000', overflow: 'hidden' }}>
      {shouldRenderVideo ? (
        <Video
          ref={videoRef}
          source={{ uri: toMediaUrl(item.videoUrl) }}
          posterSource={{ uri: toMediaUrl(item.coverUrl) }}
          usePoster
          shouldPlay={feedPlaying && active && !paused}
          isMuted={muted}
          isLooping
          resizeMode={ResizeMode.CONTAIN}
          onPlaybackStatusUpdate={(status) => {
            if (!status.isLoaded) return
            setPositionMillis(status.positionMillis || 0)
            setDurationMillis(status.durationMillis || 0)
          }}
          onReadyForDisplay={(event) => {
            const natural = event?.naturalSize || (event as unknown as { nativeEvent?: { naturalSize?: { width?: number; height?: number } } })?.nativeEvent?.naturalSize
            const naturalWidth = natural?.width
            const naturalHeight = natural?.height
            if (naturalWidth && naturalHeight && naturalWidth > 0 && naturalHeight > 0) {
              setVideoAspect(naturalWidth / naturalHeight)
            }
          }}
          style={videoBoxStyle}
          videoStyle={Platform.OS === 'web' ? ({ objectPosition: 'center center' } as never) : undefined}
        />
      ) : (
        <Image source={{ uri: toMediaUrl(item.coverUrl) }} style={{ position: 'absolute', inset: 0, width: screenWidth, height: screenHeight }} resizeMode="cover" />
      )}
      <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.26)' }} />
      <TouchableOpacity activeOpacity={1} onPress={togglePaused} style={{ position: 'absolute', inset: 0 }} />
      <FeedActionSidebar
        avatarUrl={item.authorAvatar}
        authorName={item.authorName}
        likeCount={likeCount}
        commentCount={item.commentCount}
        favoriteCount={favoriteCount}
        followed={followed}
        liked={liked}
        favorited={favorited}
        onFollowPress={() => setFollowed((value) => !value)}
        onLikePress={async () => {
          if (!requireLogin('like', '/feed')) return
          const result = await api.toggleVideoInteraction(item.id, 'LIKE')
          setLikeCount((value) => Math.max(0, value + (result.active ? 1 : -1)))
          setLiked(result.active)
        }}
        onCommentPress={() => {
          if (requireLogin('comment', '/feed')) setCommentsVisible(true)
        }}
        onFavoritePress={async () => {
          if (!requireLogin('favorite', '/feed')) return
          const result = await api.toggleVideoInteraction(item.id, 'FAVORITE')
          setFavoriteCount((value) => Math.max(0, value + (result.active ? 1 : -1)))
          setFavorited(result.active)
        }}
        onSharePress={() => setShareVisible(true)}
      />
      <View style={{ position: 'absolute', left: 16, right: 82, bottom: 78, gap: 10 }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' }}>
          <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: '#ff315f' }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={togglePaused} style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '900' }}>{paused ? '播放' : '暂停'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMuted((value) => !value)} style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '900' }}>{muted ? '取消静音' : '静音'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ position: 'absolute', left: 16, right: 82, bottom: 136 }}>
        <TouchableOpacity onPress={() => item.userId && router.push({ pathname: '/user/[id]', params: { id: item.userId } })} activeOpacity={0.85}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>@{item.authorName}</Text>
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 8 }}>{item.title}</Text>
        {product ? (
          <TouchableOpacity onPress={() => onProductPress(product)} style={{ marginTop: 14, flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 8, padding: 10 }}>
            <Image source={{ uri: toMediaUrl(product.coverUrl) }} style={{ width: 52, height: 52, borderRadius: 6 }} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: '#111', fontWeight: '700' }}>{product.title}</Text>
              <Text style={{ color: '#e43d33', fontWeight: '800', marginTop: 4 }}>{formatPrice(product.price)}</Text>
            </View>
          </TouchableOpacity>
        ) : null}
        {onLivePress ? (
          <TouchableOpacity onPress={onLivePress} style={{ marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#e43d33' }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>进入直播间</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => requireLogin('cart', '/cart') && onCartPress()} style={{ marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.92)' }}>
          <Text style={{ color: '#111', fontWeight: '800' }}>购物车</Text>
        </TouchableOpacity>
      </View>
      <CommentSheet visible={commentsVisible} count={item.commentCount} videoId={item.id} onClose={() => setCommentsVisible(false)} />
      <ShareSheet visible={shareVisible} onClose={() => setShareVisible(false)} />
    </View>
  )
}
