import { request } from './request'
import type { CartItem, Comment, LiveRoom, MarketingRule, MessageItem, Order, OrderStatus, Product, User, VideoItem } from '@/types'

export type BehaviorEventInput = {
  eventType: string
  targetType?: string
  targetId?: string
  videoId?: string
  liveRoomId?: string
  productId?: string
  source?: string
  category?: string | null
  price?: number | null
  quantity?: number
  metadata?: Record<string, unknown>
}

export const api = {
  login: (data: { phone: string; password: string }) => request.post('/auth/login', data) as Promise<{ token: string; user: User }>,
  register: (data: { phone: string; nickname: string; password: string }) => request.post('/auth/register', data) as Promise<{ token: string; user: User }>,
  mockLogin: (data: { username?: string; nickname?: string }) => request.post('/auth/mock-login', data) as Promise<{ token: string; user: User }>,
  updateMe: (data: { nickname?: string; avatarUrl?: string }) => request.patch('/users/me', data) as Promise<User>,
  uploadAvatar: (data: FormData) => request.post('/users/me/avatar', data, { headers: { 'Content-Type': 'multipart/form-data' } }) as Promise<{ user: User; upload: { key: string; url: string } }>,
  user: (id: string) => request.get(`/users/${id}`) as Promise<User & { videos: VideoItem[]; products: Product[]; liveRooms: LiveRoom[] }>,
  messages: () => request.get('/messages') as Promise<MessageItem[]>,
  videos: (page = 1) => request.get('/videos', { params: { page, pageSize: 10 } }) as Promise<{ items: VideoItem[]; total: number }>,
  product: (id: string) => request.get(`/products/${id}`) as Promise<Product>,
  toggleVideoInteraction: (id: string, type: 'LIKE' | 'FAVORITE') => request.post(`/videos/${id}/interactions/${type}`) as Promise<{ active: boolean }>,
  shareVideo: (id: string) => request.post(`/videos/${id}/share`) as Promise<{ shareCount: number }>,
  toggleProductInteraction: (id: string, type: 'LIKE' | 'FAVORITE') => request.post(`/products/${id}/interactions/${type}`) as Promise<{ active: boolean }>,
  videoComments: (id: string) => request.get(`/videos/${id}/comments`) as Promise<Comment[]>,
  sendVideoComment: (id: string, content: string) => request.post(`/videos/${id}/comments`, { content }) as Promise<Comment>,
  addCart: (productId: string, quantity = 1) => request.post('/cart', { productId, quantity }) as Promise<CartItem>,
  cart: () => request.get('/cart') as Promise<CartItem[]>,
  updateCart: (id: string, quantity: number) => request.patch(`/cart/${id}`, { quantity }) as Promise<CartItem>,
  selectCart: (id: string, selected: boolean) => request.patch(`/cart/${id}/selected`, { selected }) as Promise<CartItem>,
  deleteCart: (id: string) => request.delete(`/cart/${id}`) as Promise<boolean>,
  createOrder: (data: unknown) => request.post('/orders', data) as Promise<Order>,
  orders: (status?: OrderStatus) => request.get('/orders', { params: status ? { status } : undefined }) as Promise<Order[]>,
  order: (id: string) => request.get(`/orders/${id}`) as Promise<Order>,
  payOrder: (id: string) => request.post(`/orders/${id}/pay`) as Promise<Order>,
  liveRooms: () => request.get('/live-rooms') as Promise<LiveRoom[]>,
  liveRoom: (id: string) => request.get(`/live-rooms/${id}`) as Promise<LiveRoom>,
  liveComments: (id: string) => request.get(`/live-rooms/${id}/comments`) as Promise<Comment[]>,
  sendLiveComment: (id: string, content: string) => request.post(`/live-rooms/${id}/comments`, { content }) as Promise<Comment>,
  liveAudience: (id: string) => request.get(`/live-rooms/${id}/audience`) as Promise<User[]>,
  liveMarketingRules: (id: string) => request.get(`/live-rooms/${id}/marketing-rules`) as Promise<MarketingRule[]>,
  trackEvent: (data: BehaviorEventInput) => request.post('/events', data) as Promise<{ id: string }>,
}
