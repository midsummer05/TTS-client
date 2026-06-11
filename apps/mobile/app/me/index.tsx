import { useMutation, useQuery } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { Alert, Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'
import { api } from '@/api'
import { toMediaUrl } from '@/api/request'
import { Avatar } from '@/components/Avatar'
import { BottomNav } from '@/components/BottomNav'
import { ErrorState, LoadingView } from '@/components/StateViews'
import { useRequireLogin } from '@/hooks/useRequireLogin'
import { useUserStore } from '@/store/userStore'
import type { OrderStatus } from '@/types'
import { formatPrice } from '@/utils/formatPrice'

const orderStatusText: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '待支付',
  PAID: '待发货',
  SHIPPED: '待收货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

function SettingsIcon() {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#86a9b5', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={{ width: 22, height: 4, borderRadius: 2, backgroundColor: '#f6f7f8' }} />
      ))}
    </View>
  )
}

export default function MeScreen() {
  const session = useUserStore()
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [nickname, setNickname] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const isLoggedIn = useRequireLogin('/me', 'profile')
  const cart = useQuery({ queryKey: ['cart', session.user?.id], queryFn: api.cart, enabled: isLoggedIn })
  const orders = useQuery({ queryKey: ['orders', session.user?.id], queryFn: () => api.orders(), enabled: isLoggedIn })
  const updateProfile = useMutation({
    mutationFn: api.updateMe,
    onSuccess: (user) => {
      session.updateUser(user)
      setSettingsVisible(false)
      Alert.alert('保存成功', '昵称和头像已同步到运营端')
    },
    onError: (error) => Alert.alert('保存失败', (error as Error).message),
  })
  const uploadAvatar = useMutation({
    mutationFn: api.uploadAvatar,
    onSuccess: (payload) => {
      session.updateUser(payload.user)
      setAvatarUrl(payload.user.avatarUrl || payload.upload.url)
      Alert.alert('上传成功', '头像已保存到腾讯云 COS，并同步到运营端')
    },
    onError: (error) => Alert.alert('上传失败', (error as Error).message),
  })

  if (!isLoggedIn || cart.isLoading || orders.isLoading) return <LoadingView />
  if (cart.isError) return <ErrorState message={(cart.error as Error).message} onRetry={() => cart.refetch()} />
  if (orders.isError) return <ErrorState message={(orders.error as Error).message} onRetry={() => orders.refetch()} />

  const cartTotal = (cart.data || []).reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const paidTotal = (orders.data || []).filter((order) => ['PAID', 'SHIPPED', 'COMPLETED'].includes(order.status)).reduce((sum, order) => sum + order.payAmount, 0)

  function openSettings() {
    setNickname(session.user?.nickname || '')
    setAvatarUrl(session.user?.avatarUrl || '')
    setSettingsVisible(true)
  }

  function submitSettings() {
    const nextNickname = nickname.trim()
    const nextAvatar = avatarUrl.trim()
    if (nextNickname.length < 2) {
      Alert.alert('请完善信息', '昵称至少需要 2 个字')
      return
    }
    updateProfile.mutate({ nickname: nextNickname, avatarUrl: nextAvatar })
  }

  function useGeneratedAvatar() {
    const seed = encodeURIComponent(nickname.trim() || session.user?.username || session.user?.id || 'user')
    setAvatarUrl(`https://api.dicebear.com/9.x/thumbs/png?seed=${seed}`)
  }

  async function chooseAvatarFromAlbum() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('需要相册权限', '请允许访问相册后再选择头像')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.86,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const fileName = asset.fileName || `avatar-${Date.now()}.jpg`
    const mimeType = asset.mimeType || 'image/jpeg'
    const formData = new FormData()
    if (Platform.OS === 'web') {
      const blob = await fetch(asset.uri).then((response) => response.blob())
      formData.append('file', blob, fileName)
    } else {
      formData.append('file', {
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      } as unknown as Blob)
    }
    uploadAvatar.mutate(formData)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#101014' }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 96 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar uri={session.user?.avatarUrl} name={session.user?.nickname || session.user?.username} size={68} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>{session.user?.nickname || '移动端用户'}</Text>
            <Text style={{ color: '#9fa0ad', marginTop: 4 }}>购物信息与订单中心</Text>
          </View>
          <TouchableOpacity onPress={openSettings} activeOpacity={0.85}>
            <SettingsIcon />
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 22, flexDirection: 'row', gap: 10 }}>
          {[
            ['购物车', `${cart.data?.length || 0}`],
            ['订单', `${orders.data?.length || 0}`],
            ['已消费', formatPrice(paidTotal)],
          ].map(([label, value]) => (
            <View key={label} style={{ flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#1d1d25' }}>
              <Text style={{ color: '#9fa0ad' }}>{label}</Text>
              <Text style={{ color: '#fff', marginTop: 8, fontSize: 18, fontWeight: '900' }}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 22, flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={() => router.push('/cart')} style={{ flex: 1, height: 46, borderRadius: 8, backgroundColor: '#ff315f', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '900' }}>查看购物车</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/order')} style={{ flex: 1, height: 46, borderRadius: 8, backgroundColor: '#2d2d38', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '900' }}>全部订单</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => {
            session.clearSession()
            router.replace('/login')
          }}
          style={{ marginTop: 18, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#34343f', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#b9bac4', fontWeight: '800' }}>退出登录</Text>
        </TouchableOpacity>

        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 28 }}>购物车商品</Text>
        <View style={{ marginTop: 12, gap: 12 }}>
          {(cart.data || []).slice(0, 4).map((item) => (
            <View key={item.id} style={{ flexDirection: 'row', gap: 12, padding: 10, borderRadius: 8, backgroundColor: '#1d1d25' }}>
              <Image source={{ uri: toMediaUrl(item.product.coverUrl) }} style={{ width: 68, height: 68, borderRadius: 6, backgroundColor: '#333' }} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '900' }}>{item.product.title}</Text>
                <Text style={{ color: '#9fa0ad', marginTop: 6 }}>数量 x{item.quantity}</Text>
                <Text style={{ color: '#ff315f', marginTop: 6, fontWeight: '900' }}>{formatPrice(item.product.price * item.quantity)}</Text>
              </View>
            </View>
          ))}
          {!cart.data?.length ? <Text style={{ color: '#9fa0ad' }}>购物车还是空的，可以先去首页加购</Text> : null}
        </View>

        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 28 }}>最近订单</Text>
        <View style={{ marginTop: 12, gap: 12 }}>
          {(orders.data || []).slice(0, 4).map((order) => (
            <TouchableOpacity key={order.id} onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })} style={{ padding: 14, borderRadius: 8, backgroundColor: '#1d1d25' }}>
              <Text style={{ color: '#fff', fontWeight: '900' }}>{order.orderNo}</Text>
              <Text style={{ color: '#9fa0ad', marginTop: 6 }}>{order.items[0]?.title || '商品'} · {orderStatusText[order.status] || order.status}</Text>
              <Text style={{ color: '#ff315f', marginTop: 8, fontWeight: '900' }}>{formatPrice(order.payAmount)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.56)', justifyContent: 'center', padding: 22 }}>
          <View style={{ borderRadius: 18, backgroundColor: '#fff', padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#111', fontSize: 20, fontWeight: '900' }}>设置资料</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Text style={{ color: '#777', fontSize: 28 }}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 18, alignItems: 'center' }}>
              <Avatar uri={avatarUrl} name={nickname || session.user?.username} size={82} />
              <Text style={{ marginTop: 8, color: '#777' }}>修改后会同步到运营端作者/主播信息</Text>
            </View>

            <Text style={{ marginTop: 18, color: '#111', fontWeight: '800' }}>修改名称</Text>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              maxLength={20}
              placeholder="请输入昵称"
              style={{ marginTop: 8, height: 46, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 12, color: '#111' }}
            />

            <Text style={{ marginTop: 16, color: '#111', fontWeight: '800' }}>设置头像</Text>
            <TouchableOpacity
              disabled={uploadAvatar.isPending}
              onPress={chooseAvatarFromAlbum}
              style={{ marginTop: 8, height: 44, borderRadius: 10, backgroundColor: uploadAvatar.isPending ? '#b7c6cc' : '#86a9b5', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '900' }}>{uploadAvatar.isPending ? '上传中...' : '从本地相册上传头像'}</Text>
            </TouchableOpacity>
            <TextInput
              value={avatarUrl}
              onChangeText={setAvatarUrl}
              placeholder="请输入图片 HTTPS 地址"
              autoCapitalize="none"
              style={{ marginTop: 8, height: 46, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 12, color: '#111' }}
            />
            <TouchableOpacity onPress={useGeneratedAvatar} style={{ marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: '#eef6f8', justifyContent: 'center' }}>
              <Text style={{ color: '#315f6f', fontWeight: '900' }}>一键生成头像</Text>
            </TouchableOpacity>

            <View style={{ marginTop: 22, flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setSettingsVisible(false)} style={{ flex: 1, height: 46, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#333', fontWeight: '900' }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={updateProfile.isPending} onPress={submitSettings} style={{ flex: 1, height: 46, borderRadius: 10, backgroundColor: updateProfile.isPending ? '#aaa' : '#ff315f', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '900' }}>{updateProfile.isPending ? '保存中' : '保存'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <BottomNav active="me" />
    </SafeAreaView>
  )
}
