import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Image, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { api } from '@/api'
import { toMediaUrl } from '@/api/request'

type Props = {
  visible: boolean
  count: number
  videoId: string
  onClose: () => void
}

export function CommentSheet({ visible, count, videoId, onClose }: Props) {
  const [content, setContent] = useState('')
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['video-comments', videoId], queryFn: () => api.videoComments(videoId), enabled: visible })

  async function send() {
    const text = content.trim()
    if (!text) return
    await api.sendVideoComment(videoId, text)
    setContent('')
    queryClient.invalidateQueries({ queryKey: ['video-comments', videoId] })
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} style={{ minHeight: 360, maxHeight: '70%', backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111' }}>评论 {count}</Text>
            <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24, color: '#555' }}>×</Text>
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 8, gap: 14 }}>
            {(query.data || []).map((comment, index) => (
              <View key={comment.id} style={{ flexDirection: 'row', gap: 10 }}>
                <Image source={{ uri: toMediaUrl(comment.user.avatarUrl) || `https://api.dicebear.com/9.x/thumbs/png?seed=${index}` }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#eee' }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#777', fontSize: 12 }}>{comment.user.nickname}</Text>
                  <Text style={{ color: '#222', marginTop: 4 }}>{comment.content}</Text>
                </View>
              </View>
            ))}
            {!query.data?.length ? <Text style={{ color: '#777' }}>还没有评论，来抢第一条</Text> : null}
          </View>
          <View style={{ marginTop: 'auto', flexDirection: 'row', gap: 10, paddingTop: 14 }}>
            <TextInput value={content} onChangeText={setContent} placeholder="说点什么..." style={{ flex: 1, height: 42, borderRadius: 21, backgroundColor: '#f2f2f2', paddingHorizontal: 16 }} />
            <TouchableOpacity onPress={send} style={{ width: 68, height: 42, borderRadius: 21, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>发送</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}
