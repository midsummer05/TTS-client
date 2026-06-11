import { ResizeMode, Video } from 'expo-av'
import { router } from 'expo-router'
import { Image, Text, TouchableOpacity, View } from 'react-native'
import { toMediaUrl } from '@/api/request'
import { useMiniLiveStore } from '@/store/miniLiveStore'

export function MiniLivePlayer() {
  const room = useMiniLiveStore((state) => state.room)
  const clearRoom = useMiniLiveStore((state) => state.clearRoom)

  if (!room) return null

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 1000,
      }}
    >
      <View
        style={{
          position: 'absolute',
          right: 14,
          top: 84,
          width: 144,
          height: 212,
          borderRadius: 14,
          overflow: 'hidden',
          backgroundColor: '#111',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.18)',
        }}
      >
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => {
            clearRoom()
            router.push({ pathname: '/live/[id]', params: { id: room.id } })
          }}
          style={{ flex: 1 }}
        >
          <Video
            source={{ uri: toMediaUrl(room.videoUrl || room.coverUrl) }}
            posterSource={{ uri: toMediaUrl(room.coverUrl) }}
            usePoster
            shouldPlay
            isMuted
            isLooping
            resizeMode={ResizeMode.COVER}
            style={{ position: 'absolute', inset: 0 }}
          />
          <Image source={{ uri: toMediaUrl(room.coverUrl) }} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 52, opacity: 0.18 }} />
          <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8 }}>
            <Text numberOfLines={1} style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>{room.title}</Text>
            <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.76)', marginTop: 2, fontSize: 11 }}>{room.anchorName}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={clearRoom}
          style={{
            position: 'absolute',
            right: 6,
            top: 6,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: 'rgba(0,0,0,0.66)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 18, lineHeight: 20 }}>×</Text>
        </TouchableOpacity>
        <View style={{ position: 'absolute', left: 8, top: 8, borderRadius: 10, backgroundColor: '#ff315f', paddingHorizontal: 7, paddingVertical: 3 }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>小窗播放</Text>
        </View>
      </View>
    </View>
  )
}
