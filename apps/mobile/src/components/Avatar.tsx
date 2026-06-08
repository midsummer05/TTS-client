import { useState } from 'react'
import { Image, Text, View } from 'react-native'
import { toMediaUrl } from '@/api/request'

type Props = {
  uri?: string | null
  name?: string | null
  size?: number
  borderWidth?: number
  borderColor?: string
}

const colors = ['#ff315f', '#3a7bff', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#22c55e', '#06b6d4']

function colorFor(value?: string | null) {
  const text = value || '用户'
  let hash = 0
  for (let index = 0; index < text.length; index++) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }
  return colors[hash % colors.length]
}

function initialFor(value?: string | null) {
  const text = (value || '用户').trim()
  return Array.from(text)[0] || '用'
}

export function Avatar({ uri, name, size = 40, borderWidth = 0, borderColor = '#fff' }: Props) {
  const [failed, setFailed] = useState(false)
  const source = !failed ? toMediaUrl(uri) : ''
  const borderRadius = size / 2

  if (source) {
    return (
      <Image
        source={{ uri: source }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius, borderWidth, borderColor, backgroundColor: colorFor(name) }}
      />
    )
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        borderWidth,
        borderColor,
        backgroundColor: colorFor(name),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: Math.max(12, size * 0.42), fontWeight: '900' }}>{initialFor(name)}</Text>
    </View>
  )
}
