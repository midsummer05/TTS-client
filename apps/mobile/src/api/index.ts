import { request } from './request'
import type {
  CartItem,
  Comment,
  LiveRoom,
  MessageItem,
  Order,
  Product,
  User,
  VideoItem,
} from '@/types'

export const api = {
  login: (nickname: string) =>
    request.post('/auth/mock-login', { nickname }) as Promise<{
      token: string
      user: User
    }>,
  user: (id: string) =>
    request.get(`/users/${id}`) as Promise<
      User & { videos: VideoItem[]; products: Product[]; liveRooms: LiveRoom[] }
    >,
  messages: () => request.get('/messages') as Promise<MessageItem[]>,
  videos: (page = 1) =>
    request.get('/videos', { params: { page, pageSize: 10 } }) as Promise<{
      items: VideoItem[]
      total: number
    }>,
  product: (id: string) => request.get(`/products/${id}`) as Promise<Product>,
  toggleVideoInteraction: (id: string, type: 'LIKE' | 'FAVORITE') =>
    request.post(`/videos/${id}/interactions/${type}`) as Promise<{
      active: boolean
    }>,
  toggleProductInteraction: (id: string, type: 'LIKE' | 'FAVORITE') =>
    request.post(`/products/${id}/interactions/${type}`) as Promise<{
      active: boolean
    }>,
  videoComments: (id: string) =>
    request.get(`/videos/${id}/comments`) as Promise<Comment[]>,
  sendVideoComment: (id: string, content: string) =>
    request.post(`/videos/${id}/comments`, { content }) as Promise<Comment>,
  addCart: (productId: string, quantity = 1) =>
    request.post('/cart', { productId, quantity }) as Promise<CartItem>,
  cart: () => request.get('/cart') as Promise<CartItem[]>,
  updateCart: (id: string, quantity: number) =>
    request.patch(`/cart/${id}`, { quantity }) as Promise<CartItem>,
  selectCart: (id: string, selected: boolean) =>
    request.patch(`/cart/${id}/selected`, { selected }) as Promise<CartItem>,
  deleteCart: (id: string) => request.delete(`/cart/${id}`) as Promise<boolean>,
  createOrder: (data: unknown) =>
    request.post('/orders', data) as Promise<Order>,
  orders: () => request.get('/orders') as Promise<Order[]>,
  order: (id: string) => request.get(`/orders/${id}`) as Promise<Order>,
  payOrder: (id: string) => request.post(`/orders/${id}/pay`) as Promise<Order>,
  liveRooms: () => request.get('/live-rooms') as Promise<LiveRoom[]>,
  liveRoom: (id: string) =>
    request.get(`/live-rooms/${id}`) as Promise<LiveRoom>,
  liveComments: (id: string) =>
    request.get(`/live-rooms/${id}/comments`) as Promise<Comment[]>,
  sendLiveComment: (id: string, content: string) =>
    request.post(`/live-rooms/${id}/comments`, { content }) as Promise<Comment>,
  liveAudience: (id: string) =>
    request.get(`/live-rooms/${id}/audience`) as Promise<User[]>,
}
