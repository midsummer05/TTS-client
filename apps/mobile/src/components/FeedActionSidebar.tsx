import { Text, TouchableOpacity, View } from 'react-native'
import { Avatar } from '@/components/Avatar'

type Props = {
  avatarUrl?: string | null
  authorName?: string | null
  likeCount: number
  commentCount: number
  favoriteCount?: number
  shareCount?: number
  followed: boolean
  liked: boolean
  favorited: boolean
  onFollowPress: () => void
  onLikePress: () => void
  onCommentPress: () => void
  onFavoritePress: () => void
  onSharePress: () => void
}

function formatCount(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  return String(value)
}

function CommentIcon() {
  return (
    <View
      style={{
        width: 42,
        height: 34,
        borderRadius: 18,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 4,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[0, 1, 2].map((item) => (
          <View key={item} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#111' }} />
        ))}
      </View>
      <View
        style={{
          position: 'absolute',
          left: 9,
          bottom: -5,
          width: 12,
          height: 12,
          borderRadius: 2,
          backgroundColor: '#fff',
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  )
}

function ActionButton({
  icon,
  inactiveIcon,
  count,
  active,
  onPress,
  variant = 'text',
}: {
  icon: string
  inactiveIcon?: string
  count?: number
  active?: boolean
  onPress: () => void
  variant?: 'text' | 'comment'
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{ width: 54, minHeight: 76, alignItems: 'center', justifyContent: 'center' }}
    >
      {variant === 'comment' ? (
        <CommentIcon />
      ) : (
        <Text
          style={{
            color: active ? '#ff3b5c' : '#fff',
            fontSize: 42,
            lineHeight: 46,
            fontWeight: '900',
            textShadowColor: 'rgba(0,0,0,0.3)',
            textShadowRadius: 4,
          }}
        >
          {active ? icon : inactiveIcon || icon}
        </Text>
      )}
      {typeof count === 'number' ? (
        <Text style={{ marginTop: 8, color: '#fff', fontSize: 18, fontWeight: '800' }}>{formatCount(count)}</Text>
      ) : null}
    </TouchableOpacity>
  )
}

export function FeedActionSidebar({
  avatarUrl,
  authorName,
  likeCount,
  commentCount,
  favoriteCount = 0,
  shareCount = 0,
  followed,
  liked,
  favorited,
  onFollowPress,
  onLikePress,
  onCommentPress,
  onFavoritePress,
  onSharePress,
}: Props) {
  return (
    <View style={{ position: 'absolute', right: 8, top: '20%', alignItems: 'center', gap: 16 }}>
      <View style={{ width: 64, height: 78, alignItems: 'center' }}>
        <Avatar uri={avatarUrl} name={authorName} size={60} borderWidth={2} borderColor="#fff" />
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onFollowPress}
          style={{
            position: 'absolute',
            bottom: 0,
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: followed ? '#fff' : '#ff2f5f',
          }}
        >
          <Text style={{ color: followed ? '#ff2f5f' : '#fff', fontSize: 24, lineHeight: 28, fontWeight: '900' }}>
            {followed ? '✓' : '+'}
          </Text>
        </TouchableOpacity>
      </View>

      <ActionButton icon="♥" inactiveIcon="♡" count={likeCount} active={liked} onPress={onLikePress} />
      <ActionButton icon="" variant="comment" count={commentCount} onPress={onCommentPress} />
      <ActionButton icon="★" inactiveIcon="☆" count={favoriteCount} active={favorited} onPress={onFavoritePress} />
      <ActionButton icon="↗" count={shareCount} onPress={onSharePress} />
    </View>
  )
}
