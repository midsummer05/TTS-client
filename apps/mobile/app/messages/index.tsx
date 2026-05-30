import { useMutation, useQuery } from '@tanstack/react-query'
import { Image, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useEffect } from 'react'
import { api } from '@/api'
import { toMediaUrl } from '@/api/request'
import { BottomNav } from '@/components/BottomNav'
import { ErrorState, LoadingView } from '@/components/StateViews'
import { useUserStore } from '@/store/userStore'

export default function MessagesScreen() {
  const session = useUserStore()
  const login = useMutation({ mutationFn: () => api.login('移动端用户'), onSuccess: session.setSession })
  const query = useQuery({ queryKey: ['messages', session.user?.id], queryFn: api.messages, enabled: !!session.token })

  useEffect(() => {
    if (!session.token && !login.isPending) login.mutate()
  }, [session.token])

  if (!session.token || query.isLoading) return <LoadingView />
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#101014' }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 96 }}>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>消息</Text>
        <Text style={{ color: '#9fa0ad', marginTop: 6 }}>评论、点赞、收藏和订单状态都会汇总在这里</Text>
        <View style={{ marginTop: 18, gap: 12 }}>
          {(query.data || []).map((message, index) => (
            <View key={message.id} style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 8, backgroundColor: '#1d1d25' }}>
              {message.avatarUrl ? (
                <Image source={{ uri: toMediaUrl(message.avatarUrl) }} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#333' }} />
              ) : (
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: index % 2 === 0 ? '#ff315f' : '#3a7bff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '900' }}>{message.type === 'order' ? '单' : '互'}</Text>
                </View>
              )}
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
