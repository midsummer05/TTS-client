export type ApiResponse<T> = {
  code: number
  message: string
  data: T
}

export type Money = number

export type ProductStatus = 'ON_SALE' | 'OFF_SALE'
export type VideoStatus = 'DRAFT' | 'PUBLISHED' | 'OFFLINE'
export type LiveRoomStatus = 'NOT_STARTED' | 'LIVING' | 'ENDED'
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'CANCELLED'

export type ProductDTO = {
  id: string
  title: string
  coverUrl: string
  price: Money
  originPrice?: Money | null
  stock: number
  sales: number
  status: ProductStatus
  category?: string | null
  description?: string | null
}

export type VideoDTO = {
  id: string
  title: string
  coverUrl: string
  videoUrl: string
  authorName: string
  authorAvatar?: string | null
  likeCount: number
  commentCount: number
  products?: ProductDTO[]
}
