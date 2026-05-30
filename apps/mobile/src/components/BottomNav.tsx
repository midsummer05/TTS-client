import { router } from 'expo-router'
import { Text, TouchableOpacity, View } from 'react-native'

const tabs = [
  { key: 'feed', label: '首页', href: '/feed' },
  { key: 'messages', label: '消息', href: '/messages' },
  { key: 'me', label: '我', href: '/me' },
] as const

export function BottomNav({ active }: { active: 'feed' | 'messages' | 'me' }) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 72, paddingTop: 8, paddingBottom: 10, backgroundColor: 'rgba(12,12,16,0.92)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', flexDirection: 'row' }}>
      {tabs.map((tab) => (
        <TouchableOpacity key={tab.key} onPress={() => router.push(tab.href)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: active === tab.key ? '#ff315f' : '#aeb0bd', fontSize: 22, fontWeight: '900' }}>
            {tab.key === 'feed' ? '⌂' : tab.key === 'messages' ? '✉' : '●'}
          </Text>
          <Text style={{ color: active === tab.key ? '#fff' : '#aeb0bd', marginTop: 2, fontSize: 12, fontWeight: '800' }}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}
