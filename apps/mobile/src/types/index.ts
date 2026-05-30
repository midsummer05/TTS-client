export type Product = {
  id: string
  title: string
  coverUrl: string
  price: number
  originPrice?: number | null
  stock: number
  sales: number
  status: 'ON_SALE' | 'OFF_SALE'
  category?: string | null
  description?: string | null
  sellerId?: string | null
}

export type User = {
  id: string
  username: string
  nickname: string
  avatarUrl?: string | null
  bio?: string | null
  homepageTitle?: string | null
  followerCount: number
  followingCount: number
}

export type VideoItem = {
  id: string
  title: string
  coverUrl: string
  videoUrl: string
  authorName: string
  authorAvatar?: string | null
  userId?: string | null
  author?: User | null
  likeCount: number
  commentCount: number
  products: Product[]
}

export type Comment = {
  id: string
  content: string
  createdAt: string
  user: User
}

export type LiveRoom = {
  id: string
  title: string
  coverUrl: string
  videoUrl?: string | null
  anchorName: string
  anchorAvatar?: string | null
  anchorUserId?: string | null
  anchor?: User | null
  onlineCount: number
  heat: number
  products: Product[]
  currentProductId?: string | null
}

export type MessageItem = {
  id: string
  type: 'comment' | 'order' | 'interaction'
  title: string
  content: string
  avatarUrl?: string | null
  createdAt: string
}

export type CartItem = {
  id: string
  quantity: number
  selected: boolean
  product: Product
}

export type Order = {
  id: string
  orderNo: string
  status: string
  totalAmount: number
  discountAmount: number
  payAmount: number
  address: string
  items: Array<{ id: string; title: string; coverUrl: string; price: number; quantity: number }>
}
