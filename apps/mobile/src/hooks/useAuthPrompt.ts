import { router } from 'expo-router'
import { useUserStore } from '@/store/userStore'

type LoginReason = 'like' | 'comment' | 'favorite' | 'cart' | 'buy' | 'message' | 'profile' | 'order'

const reasonText: Record<LoginReason, string> = {
  like: '点赞',
  comment: '评论',
  favorite: '收藏',
  cart: '使用购物车',
  buy: '购买商品',
  message: '查看消息',
  profile: '查看个人中心',
  order: '查看订单',
}

export function loginReasonText(reason?: string) {
  return reason && reason in reasonText ? reasonText[reason as LoginReason] : '继续操作'
}

export function useAuthPrompt(defaultRedirect = '/feed') {
  const token = useUserStore((state) => state.token)

  return (reason: LoginReason, redirect = defaultRedirect) => {
    if (token) return true
    router.push({ pathname: '/login', params: { redirect, reason } })
    return false
  }
}
