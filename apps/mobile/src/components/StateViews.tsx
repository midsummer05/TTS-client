import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'

export function LoadingView() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }}>
      <ActivityIndicator color="#fff" />
      <Text style={{ color: '#fff', marginTop: 12 }}>加载中</Text>
    </View>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 16, color: '#333', marginBottom: 16 }}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} style={{ backgroundColor: '#111', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 }}>
          <Text style={{ color: '#fff' }}>重试</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: '#777' }}>{text}</Text>
    </View>
  )
}
