import { useQuery } from '@tanstack/react-query'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/api'
import { Avatar } from '@/components/Avatar'
import { BottomNav } from '@/components/BottomNav'
import { ErrorState, LoadingView } from '@/components/StateViews'
import { useRequireLogin } from '@/hooks/useRequireLogin'
import { useUserStore } from '@/store/userStore'

export default function MessagesScreen() {
  const session = useUserStore()
  const isLoggedIn = useRequireLogin('/messages', 'message')
  const query = useQuery({ queryKey: ['messages', session.user?.id], queryFn: api.messages, enabled: isLoggedIn })

  if (!isLoggedIn || query.isLoading) return <LoadingView />
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#101014' }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 96 }}>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>消息</Text>
        <Text style={{ color: '#9fa0ad', marginTop: 6 }}>评论、点赞、收藏和订单状态都会汇总在这里</Text>
        <View style={{ marginTop: 18, gap: 12 }}>
          {(query.data || []).map((message, index) => (
            <View key={message.id} style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 8, backgroundColor: '#1d1d25' }}>
              <Avatar uri={message.avatarUrl} name={message.type === 'order' ? '订单' : message.title || `消息${index}`} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '900' }}>{message.title}</Text>
                <Text style={{ color: '#c9c9d2', marginTop: 6, lineHeight: 20 }}>{message.content}</Text>
              </View>
            </View>
          ))}
          {!query.data?.length ? <Text style={{ color: '#9fa0ad' }}>暂无消息</Text> : null}
        </View>
      </ScrollView>
      <BottomNav active="messages" />
    </SafeAreaView>
  )
}
