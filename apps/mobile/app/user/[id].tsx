import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/api'
import { toMediaUrl } from '@/api/request'
import { Avatar } from '@/components/Avatar'
import { ErrorState, LoadingView } from '@/components/StateViews'
import { formatPrice } from '@/utils/formatPrice'

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useQuery({ queryKey: ['user', id], queryFn: () => api.user(id) })

  if (query.isLoading) return <LoadingView />
  if (query.isError || !query.data) return <ErrorState message={(query.error as Error)?.message || '用户不存在'} onRetry={() => query.refetch()} />

  const user = query.data
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#101014' }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#24242c', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 26 }}>‹</Text>
        </TouchableOpacity>
        <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar uri={user.avatarUrl} name={user.nickname || user.username} size={78} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>{user.nickname}</Text>
            <Text style={{ color: '#9fa0ad', marginTop: 4 }}>@{user.username}</Text>
            <Text style={{ color: '#fff', marginTop: 8 }}>{user.followerCount} 粉丝 · {user.followingCount} 关注</Text>
          </View>
        </View>
        <Text style={{ color: '#d8d8df', marginTop: 16, lineHeight: 22 }}>{user.bio || '这个用户还没有填写简介'}</Text>

        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 26 }}>{user.homepageTitle || '主页作品'}</Text>
        <View style={{ marginTop: 12, gap: 12 }}>
          {user.videos.map((video) => (
            <TouchableOpacity key={video.id} onPress={() => router.push('/feed')} style={{ flexDirection: 'row', gap: 12, padding: 10, borderRadius: 8, backgroundColor: '#1d1d25' }}>
              <Image source={{ uri: toMediaUrl(video.coverUrl) }} style={{ width: 92, height: 122, borderRadius: 6, backgroundColor: '#333' }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '900' }}>{video.title}</Text>
                <Text style={{ color: '#9fa0ad', marginTop: 8 }}>点赞 {video.likeCount} · 评论 {video.commentCount}</Text>
                {video.products[0] ? <Text style={{ color: '#ff315f', fontWeight: '900', marginTop: 'auto' }}>{formatPrice(video.products[0].price)}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 26 }}>橱窗商品</Text>
        <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {user.products.map((product) => (
            <TouchableOpacity key={product.id} onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })} style={{ width: '48%', borderRadius: 8, overflow: 'hidden', backgroundColor: '#1d1d25' }}>
              <Image source={{ uri: toMediaUrl(product.coverUrl) }} style={{ width: '100%', height: 132, backgroundColor: '#333' }} />
              <View style={{ padding: 10 }}>
                <Text numberOfLines={2} style={{ color: '#fff', fontWeight: '800' }}>{product.title}</Text>
                <Text style={{ color: '#ff315f', fontWeight: '900', marginTop: 8 }}>{formatPrice(product.price)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
