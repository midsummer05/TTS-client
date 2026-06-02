import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'
import path from 'node:path'
import { z } from 'zod'
import { prisma } from './prisma.js'
import { auth, type AuthedRequest } from './middlewares/auth.js'
import { generateOrderNo } from './utils/order.js'
import { fail, ok } from './utils/response.js'
import { registerAiRoutes } from './ai/router.js'

export const app = express()

app.use(cors())
app.use(express.json())

const materialRoot = process.cwd().endsWith(path.join('apps', 'server'))
  ? path.resolve(process.cwd(), '..', '..', 'video_material')
  : path.resolve(process.cwd(), 'video_material')
app.use('/media', express.static(materialRoot))

registerAiRoutes(app)

function param(req: express.Request, name: string) {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value
}

app.get('/api/health', (_req, res) => ok(res, { status: 'up' }))

app.post('/api/auth/mock-login', async (req, res) => {
  const body = z
    .object({ nickname: z.string().min(1).default('测试用户') })
    .parse(req.body)
  const username =
    body.nickname.replace(/\s+/g, '').toLowerCase() || 'mobile-user'
  const user = await prisma.user.upsert({
    where: { username },
    update: { nickname: body.nickname },
    create: {
      username,
      nickname: body.nickname,
      avatarUrl: `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(username)}`,
      bio: '正在逛直播好物，喜欢真实讲解和明确价格。',
      homepageTitle: '我的直播购物主页',
    },
  })
  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET || 'dev-secret',
  )
  ok(res, { token, user })
})

app.get('/api/users/me', auth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  ok(res, user)
})

app.get('/api/messages', auth, async (req: AuthedRequest, res) => {
  const [comments, orders, interactions] = await Promise.all([
    prisma.comment.findMany({
      where: { userId: { not: req.userId } },
      include: { user: true, video: true, liveRoom: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.order.findMany({
      where: { userId: req.userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.interaction.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ])

  const commentMessages = comments.map((comment) => ({
    id: `comment-${comment.id}`,
    type: 'comment',
    title: `${comment.user.nickname} 参与了互动`,
    content: comment.video
      ? `评论了视频「${comment.video.title}」：${comment.content}`
      : `在直播间「${comment.liveRoom?.title || '直播间'}」说：${comment.content}`,
    avatarUrl: comment.user.avatarUrl,
    createdAt: comment.createdAt,
  }))
  const orderMessages = orders.map((order) => ({
    id: `order-${order.id}`,
    type: 'order',
    title: `订单 ${order.orderNo}`,
    content: `${order.items[0]?.title || '商品'} ${order.status === 'PAID' ? '已支付' : order.status === 'PENDING_PAYMENT' ? '待支付' : '状态已更新'}`,
    avatarUrl: null,
    createdAt: order.createdAt,
  }))
  const interactionMessages = interactions.map((interaction) => ({
    id: `interaction-${interaction.id}`,
    type: 'interaction',
    title: interaction.type === 'LIKE' ? '你点赞了内容' : '你收藏了内容',
    content:
      interaction.targetType === 'VIDEO'
        ? '已记录到你的视频互动里'
        : '已记录到你的商品收藏里',
    avatarUrl: null,
    createdAt: interaction.createdAt,
  }))

  ok(
    res,
    [...commentMessages, ...orderMessages, ...interactionMessages]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 30),
  )
})

app.get('/api/users/:id', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: param(req, 'id') },
    include: {
      videos: {
        where: { status: 'PUBLISHED' },
        include: {
          products: { include: { product: true }, orderBy: { sort: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      },
      liveRooms: {
        include: { products: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
      },
      products: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!user) return fail(res, '用户不存在', 40401, 404)
  ok(res, {
    ...user,
    videos: user.videos.map((item) => ({
      ...item,
      products: item.products.map((link) => link.product),
    })),
    liveRooms: user.liveRooms.map((room) => ({
      ...room,
      products: room.products.map((link) => link.product),
    })),
  })
})

app.get('/api/videos', async (req, res) => {
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 10)
  const [items, total] = await Promise.all([
    prisma.video.findMany({
      where: { status: 'PUBLISHED' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        author: true,
        products: { include: { product: true }, orderBy: { sort: 'asc' } },
      },
    }),
    prisma.video.count({ where: { status: 'PUBLISHED' } }),
  ])
  ok(res, {
    items: items.map((item) => ({
      ...item,
      products: item.products.map((link) => link.product),
    })),
    total,
    page,
    pageSize,
  })
})

app.get('/api/videos/:id', async (req, res) => {
  const video = await prisma.video.findUnique({
    where: { id: param(req, 'id') },
    include: {
      author: true,
      products: { include: { product: true }, orderBy: { sort: 'asc' } },
    },
  })
  if (!video) return fail(res, '视频不存在', 40401, 404)
  ok(res, { ...video, products: video.products.map((link) => link.product) })
})

app.post('/api/videos/:id/like', async (req, res) => {
  const video = await prisma.video.update({
    where: { id: param(req, 'id') },
    data: { likeCount: { increment: 1 } },
  })
  ok(res, video)
})

async function toggleInteraction(
  req: AuthedRequest,
  targetType: string,
  targetId: string,
  type: string,
) {
  const where = {
    userId_targetType_targetId_type: {
      userId: req.userId!,
      targetType,
      targetId,
      type,
    },
  }
  const existing = await prisma.interaction.findUnique({ where })
  if (existing) {
    await prisma.interaction.delete({ where: { id: existing.id } })
    return { active: false }
  }
  await prisma.interaction.create({
    data: { userId: req.userId!, targetType, targetId, type },
  })
  return { active: true }
}

app.post(
  '/api/videos/:id/interactions/:type',
  auth,
  async (req: AuthedRequest, res) => {
    const type = param(req, 'type')
    if (!['LIKE', 'FAVORITE'].includes(type))
      return fail(res, '不支持的互动类型')
    const videoId = param(req, 'id')
    const result = await toggleInteraction(req, 'VIDEO', videoId, type)
    if (type === 'LIKE') {
      await prisma.video
        .update({
          where: { id: videoId },
          data: { likeCount: { increment: result.active ? 1 : -1 } },
        })
        .catch(() => null)
    }
    ok(res, result)
  },
)

app.post(
  '/api/products/:id/interactions/:type',
  auth,
  async (req: AuthedRequest, res) => {
    const type = param(req, 'type')
    if (!['LIKE', 'FAVORITE'].includes(type))
      return fail(res, '不支持的互动类型')
    ok(res, await toggleInteraction(req, 'PRODUCT', param(req, 'id'), type))
  },
)

app.get('/api/videos/:id/products', async (req, res) => {
  const links = await prisma.videoProduct.findMany({
    where: { videoId: param(req, 'id') },
    include: { product: true },
    orderBy: { sort: 'asc' },
  })
  ok(
    res,
    links.map((item) => item.product),
  )
})

app.get('/api/products', async (req, res) => {
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 20)
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count(),
  ])
  ok(res, { items, total, page, pageSize })
})

app.get('/api/products/:id', async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: param(req, 'id') },
  })
  if (!product) return fail(res, '商品不存在', 40401, 404)
  ok(res, product)
})

app.get('/api/cart', auth, async (req: AuthedRequest, res) => {
  const items = await prisma.cartItem.findMany({
    where: { userId: req.userId },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
  })
  ok(res, items)
})

app.post('/api/cart', auth, async (req: AuthedRequest, res) => {
  const body = z
    .object({
      productId: z.string(),
      quantity: z.number().int().positive().default(1),
    })
    .parse(req.body)
  const product = await prisma.product.findUnique({
    where: { id: body.productId },
  })
  if (!product || product.status !== 'ON_SALE') return fail(res, '商品不可购买')
  if (product.stock < body.quantity) return fail(res, '库存不足')
  const item = await prisma.cartItem.upsert({
    where: {
      userId_productId: { userId: req.userId!, productId: body.productId },
    },
    update: { quantity: { increment: body.quantity }, selected: true },
    create: {
      userId: req.userId!,
      productId: body.productId,
      quantity: body.quantity,
    },
    include: { product: true },
  })
  ok(res, item)
})

app.patch('/api/cart/select-all', auth, async (req: AuthedRequest, res) => {
  const body = z.object({ selected: z.boolean() }).parse(req.body)
  await prisma.cartItem.updateMany({
    where: { userId: req.userId },
    data: { selected: body.selected },
  })
  ok(res, true)
})

app.patch('/api/cart/:cartItemId', auth, async (req: AuthedRequest, res) => {
  const body = z
    .object({ quantity: z.number().int().positive() })
    .parse(req.body)
  const existing = await prisma.cartItem.findFirst({
    where: { id: param(req, 'cartItemId'), userId: req.userId },
  })
  if (!existing) return fail(res, '购物车商品不存在', 40401, 404)
  const item = await prisma.cartItem.update({
    where: { id: existing.id },
    data: { quantity: body.quantity },
    include: { product: true },
  })
  ok(res, item)
})

app.patch(
  '/api/cart/:cartItemId/selected',
  auth,
  async (req: AuthedRequest, res) => {
    const body = z.object({ selected: z.boolean() }).parse(req.body)
    const existing = await prisma.cartItem.findFirst({
      where: { id: param(req, 'cartItemId'), userId: req.userId },
    })
    if (!existing) return fail(res, '购物车商品不存在', 40401, 404)
    const item = await prisma.cartItem.update({
      where: { id: existing.id },
      data: { selected: body.selected },
      include: { product: true },
    })
    ok(res, item)
  },
)

app.delete('/api/cart/:cartItemId', auth, async (req: AuthedRequest, res) => {
  const existing = await prisma.cartItem.findFirst({
    where: { id: param(req, 'cartItemId'), userId: req.userId },
  })
  if (!existing) return fail(res, '购物车商品不存在', 40401, 404)
  await prisma.cartItem.delete({ where: { id: existing.id } })
  ok(res, true)
})

app.post('/api/orders', auth, async (req: AuthedRequest, res) => {
  const body = z
    .object({
      source: z.enum(['cart', 'buyNow']),
      cartItemIds: z.array(z.string()).optional(),
      productId: z.string().optional(),
      quantity: z.number().int().positive().optional(),
      address: z.string().min(3),
      couponId: z.string().optional(),
    })
    .parse(req.body)

  const cartItems =
    body.source === 'cart'
      ? await prisma.cartItem.findMany({
          where: {
            userId: req.userId,
            id: { in: body.cartItemIds || [] },
            selected: true,
          },
          include: { product: true },
        })
      : []

  const products =
    body.source === 'buyNow' && body.productId
      ? [
          {
            product: await prisma.product.findUnique({
              where: { id: body.productId },
            }),
            quantity: body.quantity || 1,
          },
        ]
      : cartItems.map((item) => ({
          product: item.product,
          quantity: item.quantity,
        }))

  if (!products.length || products.some((item) => !item.product))
    return fail(res, '没有可结算商品')
  for (const item of products) {
    if (item.product!.status !== 'ON_SALE')
      return fail(res, `${item.product!.title} 已下架`)
    if (item.product!.stock < item.quantity)
      return fail(res, `${item.product!.title} 库存不足`)
  }

  const totalAmount = products.reduce(
    (sum, item) => sum + item.product!.price * item.quantity,
    0,
  )
  const coupon = body.couponId
    ? await prisma.coupon.findUnique({ where: { id: body.couponId } })
    : null
  const discountAmount =
    coupon && coupon.status === 'ACTIVE' && totalAmount >= coupon.minAmount
      ? coupon.amount
      : 0
  const payAmount = Math.max(totalAmount - discountAmount, 0)

  const order = await prisma.$transaction(async (tx) => {
    for (const item of products) {
      await tx.product.update({
        where: { id: item.product!.id },
        data: {
          stock: { decrement: item.quantity },
          sales: { increment: item.quantity },
        },
      })
    }
    const created = await tx.order.create({
      data: {
        orderNo: generateOrderNo(),
        userId: req.userId!,
        totalAmount,
        discountAmount,
        payAmount,
        address: body.address,
        items: {
          create: products.map((item) => ({
            productId: item.product!.id,
            title: item.product!.title,
            coverUrl: item.product!.coverUrl,
            price: item.product!.price,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    })
    if (body.source === 'cart') {
      await tx.cartItem.deleteMany({
        where: { userId: req.userId, id: { in: body.cartItemIds || [] } },
      })
    }
    return created
  })

  ok(res, order)
})

app.get('/api/orders', auth, async (req: AuthedRequest, res) => {
  const status =
    typeof req.query.status === 'string' ? req.query.status : undefined
  const orders = await prisma.order.findMany({
    where: { userId: req.userId, status: status as never },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  })
  ok(res, orders)
})

app.get('/api/orders/:id', auth, async (req: AuthedRequest, res) => {
  const order = await prisma.order.findFirst({
    where: { id: param(req, 'id'), userId: req.userId },
    include: { items: true },
  })
  if (!order) return fail(res, '订单不存在', 40401, 404)
  ok(res, order)
})

app.post('/api/orders/:id/pay', auth, async (req: AuthedRequest, res) => {
  const existing = await prisma.order.findFirst({
    where: { id: param(req, 'id'), userId: req.userId },
  })
  if (!existing) return fail(res, '订单不存在', 40401, 404)
  const order = await prisma.order.update({
    where: { id: existing.id },
    data: { status: 'PAID' },
    include: { items: true },
  })
  ok(res, order)
})

app.post('/api/orders/:id/cancel', auth, async (req: AuthedRequest, res) => {
  const existing = await prisma.order.findFirst({
    where: { id: param(req, 'id'), userId: req.userId },
  })
  if (!existing) return fail(res, '订单不存在', 40401, 404)
  const order = await prisma.order.update({
    where: { id: existing.id },
    data: { status: 'CANCELLED' },
    include: { items: true },
  })
  ok(res, order)
})

app.get('/api/live-rooms', async (_req, res) => {
  const rooms = await prisma.liveRoom.findMany({
    include: { anchor: true, products: { include: { product: true } } },
  })
  ok(
    res,
    rooms.map((room) => ({
      ...room,
      products: room.products.map((item) => item.product),
    })),
  )
})

app.get('/api/live-rooms/:id', async (req, res) => {
  const room = await prisma.liveRoom.findUnique({
    where: { id: param(req, 'id') },
    include: { anchor: true, products: { include: { product: true } } },
  })
  if (!room) return fail(res, '直播间不存在', 40401, 404)
  ok(res, { ...room, products: room.products.map((item) => item.product) })
})

app.get('/api/live-rooms/:id/products', async (req, res) => {
  const links = await prisma.liveRoomProduct.findMany({
    where: { liveRoomId: param(req, 'id') },
    include: { product: true },
    orderBy: { sort: 'asc' },
  })
  ok(
    res,
    links.map((item) => item.product),
  )
})

app.get('/api/live-rooms/:id/comments', async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { liveRoomId: param(req, 'id') },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  ok(res, comments.reverse())
})

app.post(
  '/api/live-rooms/:id/comments',
  auth,
  async (req: AuthedRequest, res) => {
    const body = z.object({ content: z.string().min(1) }).parse(req.body)
    const liveRoomId = param(req, 'id')
    const comment = await prisma.comment.create({
      data: { liveRoomId, userId: req.userId!, content: body.content },
      include: { user: true },
    })
    req.app.get('liveIo')?.to(liveRoomId).emit('live:comment:new', comment)
    ok(res, comment)
  },
)

app.get('/api/live-rooms/:id/audience', async (req, res) => {
  const room = await prisma.liveRoom.findUnique({
    where: { id: param(req, 'id') },
    include: {
      comments: {
        include: { user: true },
        take: 20,
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!room) return fail(res, '直播间不存在', 40401, 404)
  const users = Array.from(
    new Map(
      room.comments.map((comment) => [comment.user.id, comment.user]),
    ).values(),
  )
  ok(res, users)
})

app.get('/api/videos/:id/comments', async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { videoId: param(req, 'id') },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  ok(res, comments.reverse())
})

app.post('/api/videos/:id/comments', auth, async (req: AuthedRequest, res) => {
  const body = z.object({ content: z.string().min(1) }).parse(req.body)
  const videoId = param(req, 'id')
  const comment = await prisma.comment.create({
    data: { videoId, userId: req.userId!, content: body.content },
    include: { user: true },
  })
  await prisma.video.update({
    where: { id: videoId },
    data: { commentCount: { increment: 1 } },
  })
  ok(res, comment)
})

app.get('/api/admin/dashboard/overview', async (_req, res) => {
  const [productCount, videoCount, liveRoomCount, orderCount, paidOrders] =
    await Promise.all([
      prisma.product.count(),
      prisma.video.count(),
      prisma.liveRoom.count(),
      prisma.order.count(),
      prisma.order.findMany({
        where: { status: { in: ['PAID', 'SHIPPED', 'COMPLETED'] } },
      }),
    ])
  ok(res, {
    productCount,
    videoCount,
    liveRoomCount,
    orderCount,
    gmv: paidOrders.reduce((sum, order) => sum + order.payAmount, 0),
  })
})

app.get('/api/admin/products', async (_req, res) =>
  ok(res, await prisma.product.findMany({ orderBy: { createdAt: 'desc' } })),
)
app.post('/api/admin/products', async (req, res) =>
  ok(res, await prisma.product.create({ data: req.body })),
)
app.patch('/api/admin/products/:id', async (req, res) =>
  ok(
    res,
    await prisma.product.update({
      where: { id: req.params.id },
      data: req.body,
    }),
  ),
)
app.patch('/api/admin/products/:id/status', async (req, res) =>
  ok(
    res,
    await prisma.product.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
    }),
  ),
)

app.get('/api/admin/videos', async (_req, res) =>
  ok(
    res,
    await prisma.video.findMany({
      include: { products: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ),
)
app.post('/api/admin/videos', async (req, res) =>
  ok(res, await prisma.video.create({ data: req.body })),
)
app.patch('/api/admin/videos/:id', async (req, res) =>
  ok(
    res,
    await prisma.video.update({ where: { id: req.params.id }, data: req.body }),
  ),
)
app.patch('/api/admin/videos/:id/status', async (req, res) =>
  ok(
    res,
    await prisma.video.update({
      where: { id: param(req, 'id') },
      data: { status: req.body.status },
    }),
  ),
)
app.post('/api/admin/videos/:id/products', async (req, res) => {
  const body = z.object({ productIds: z.array(z.string()) }).parse(req.body)
  const videoId = param(req, 'id')
  await prisma.videoProduct.deleteMany({ where: { videoId } })
  await prisma.videoProduct.createMany({
    data: body.productIds.map((productId, sort) => ({
      videoId,
      productId,
      sort,
    })),
  })
  ok(res, true)
})

app.get('/api/admin/live-rooms', async (_req, res) =>
  ok(
    res,
    await prisma.liveRoom.findMany({
      include: { products: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ),
)
app.post('/api/admin/live-rooms', async (req, res) =>
  ok(res, await prisma.liveRoom.create({ data: req.body })),
)
app.patch('/api/admin/live-rooms/:id', async (req, res) =>
  ok(
    res,
    await prisma.liveRoom.update({
      where: { id: param(req, 'id') },
      data: req.body,
    }),
  ),
)
app.post('/api/admin/live-rooms/:id/products', async (req, res) => {
  const body = z.object({ productIds: z.array(z.string()) }).parse(req.body)
  const liveRoomId = param(req, 'id')
  await prisma.liveRoomProduct.deleteMany({ where: { liveRoomId } })
  await prisma.liveRoomProduct.createMany({
    data: body.productIds.map((productId, sort) => ({
      liveRoomId,
      productId,
      sort,
    })),
  })
  ok(res, true)
})
app.patch('/api/admin/live-rooms/:id/current-product', async (req, res) => {
  const liveRoomId = param(req, 'id')
  const linked = await prisma.liveRoomProduct.findFirst({
    where: { liveRoomId, productId: req.body.productId },
  })
  if (!linked) return fail(res, '请先将商品绑定到直播间')
  const room = await prisma.liveRoom.update({
    where: { id: liveRoomId },
    data: { currentProductId: req.body.productId },
  })
  const product = await prisma.product.findUnique({
    where: { id: req.body.productId },
  })
  req.app
    .get('liveIo')
    ?.to(liveRoomId)
    .emit('live:current-product:update', { liveRoomId, product })
  ok(res, room)
})
app.post('/api/admin/live-rooms/:id/push-coupon', async (req, res) => {
  const coupon = await prisma.coupon.findFirst({ where: { status: 'ACTIVE' } })
  req.app
    .get('liveIo')
    ?.to(param(req, 'id'))
    .emit('live:coupon:push', { liveRoomId: param(req, 'id'), coupon })
  ok(res, coupon)
})

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = err instanceof Error ? err.message : '服务器异常'
    fail(res, message, 50001, 500)
  },
)
