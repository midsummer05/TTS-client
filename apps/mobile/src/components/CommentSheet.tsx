import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { api } from '@/api'
import { Avatar } from '@/components/Avatar'
import type { Comment } from '@/types'

type Props = {
  visible: boolean
  count: number
  videoId: string
  onClose: () => void
  onCommentSent?: () => void
}

export function CommentSheet({ visible, count, videoId, onClose, onCommentSent }: Props) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['video-comments', videoId], queryFn: () => api.videoComments(videoId), enabled: visible })

  async function send() {
    const text = content.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const comment = await api.sendVideoComment(videoId, text)
      setContent('')
      queryClient.setQueryData<Comment[]>(['video-comments', videoId], (old) => [...(old || []), comment])
      onCommentSent?.()
    } catch (error) {
      Alert.alert('评论失败', error instanceof Error ? error.message : '请稍后再试')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable onPress={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
          <View style={{ height: '70%', minHeight: 380, backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 16, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
              <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111' }}>评论 {count}</Text>
              <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24, color: '#555' }}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              bounces
              decelerationRate="fast"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              overScrollMode="always"
              scrollEventThrottle={16}
              showsVerticalScrollIndicator
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 14 }}
              style={{ flex: 1 }}
            >
              {query.isLoading ? <ActivityIndicator color="#111" style={{ marginTop: 20 }} /> : null}
              {(query.data || []).map((comment) => (
                <View key={comment.id} style={{ flexDirection: 'row', gap: 10 }}>
                  <Avatar uri={comment.user.avatarUrl} name={comment.user.nickname} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#777', fontSize: 12 }}>{comment.user.nickname}</Text>
                    <Text style={{ color: '#222', marginTop: 4 }}>{comment.content}</Text>
                  </View>
                </View>
              ))}
              {!query.isLoading && !query.data?.length ? <Text style={{ color: '#777' }}>还没有评论，来抢第一条</Text> : null}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' }}>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="说点什么..."
                returnKeyType="send"
                onSubmitEditing={send}
                style={{ flex: 1, minHeight: 42, maxHeight: 88, borderRadius: 21, backgroundColor: '#f2f2f2', paddingHorizontal: 16, paddingVertical: 10 }}
                multiline
              />
              <TouchableOpacity
                disabled={!content.trim() || sending}
                onPress={send}
                style={{
                  width: 68,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: content.trim() && !sending ? '#111' : '#bbb',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {sending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>发送</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
