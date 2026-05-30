import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="feed/index" />
        <Stack.Screen name="messages/index" />
        <Stack.Screen name="me/index" />
        <Stack.Screen name="cart/index" />
        <Stack.Screen name="order/confirm" />
        <Stack.Screen name="order/result" />
        <Stack.Screen name="order/index" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="live/[id]" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="login" />
      </Stack>
    </QueryClientProvider>
  )
}
