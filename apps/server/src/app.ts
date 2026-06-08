import cors from 'cors'
import COS from 'cos-nodejs-sdk-v5'
import express from 'express'
import jwt from 'jsonwebtoken'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from './prisma.js'
import { auth, type AuthedRequest } from './middlewares/auth.js'
import { generateOrderNo } from './utils/order.js'
import { fail, ok } from './utils/response.js'

export const app = express()

app.use(cors())
app.use(express.json())

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
})

const materialRoot = process.cwd().endsWith(path.join('apps', 'server'))
  ? path.resolve(process.cwd(), '..', '..', 'video_material')
  : path.resolve(process.cwd(), 'video_material')
app.use('/media', express.static(materialRoot))

function param(req: express.Request, name: string) {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value
}

const phoneSchema = z.string().regex(/^1\d{10}$/, '请输入正确的手机号')

function signIn(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' })
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function passwordMatches(password: string, storedHash?: string | null) {
  if (!storedHash) return false
  const [salt, stored] = storedHash.split(':')
  if (!salt || !stored) return false
  const expected = Buffer.from(stored, 'hex')
  const actual = scryptSync(password, salt, 64)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function publicUser<T extends { passwordHash?: string | null }>(user: T) {
  const { passwordHash: _passwordHash, ...safeUser } = user
  return safeUser
}

function optionalUserId(req: express.Request) {
  const header = req.headers.authorization
  if (!header) return undefined
  try {
    const token = header.replace('Bearer ', '')
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as { userId: string }
    return payload.userId
  } catch {
    return undefined
  }
}

function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown, res: express.Response): z.infer<T> | undefined {
  const result = schema.safeParse(body)
  if (result.success) return result.data
  fail(res, result.error.issues[0]?.message || '请求参数错误', 40000, 400)
}

function envValue(name: string) {
  if (process.env[name]) return process.env[name]
  const envPath = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), 'apps', 'server', '.env')].find((item) => fs.existsSync(item))
  if (!envPath) return undefined
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((item) => item.trim().startsWith(`${name}=`))
  const value = line?.split('=').slice(1).join('=').trim()
  return value?.replace(/^"|"$/g, '')
}

function cosObjectUrl(bucket: string, region: string, key: string) {
  return `https://${bucket}.cos.${region}.myqcloud.com/${key.split('/').map(encodeURIComponent).join('/')}`
}

function sanitizeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-')
}

async function uploadToCos(file: Express.Multer.File) {
  const secretId = envValue('TENCENT_SECRET_ID')
  const secretKey = envValue('TENCENT_SECRET_KEY')
  const bucket = envValue('TENCENT_COS_BUCKET')
  const region = envValue('TENCENT_COS_REGION')
  const prefix = envValue('TENCENT_COS_PREFIX') || ''
  if (!secretId || !secretKey || !bucket || !region) throw new Error('COS 配置不完整，请检查 .env')

  const cos = new COS({ SecretId: secretId, SecretKey: secretKey })
  const key = `${prefix}${Date.now()}-${randomBytes(4).toString('hex')}-${sanitizeFileName(file.originalname)}`
  await new Promise((resolve, reject) => {
    cos.putObject(
      {
        Bucket: bucket,
        Region: region,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || 'video/mp4',
      },
      (error, data) => (error ? reject(error) : resolve(data)),
    )
  })
  return { key, url: cosObjectUrl(bucket, region, key) }
}

app.get('/api/health', (_req, res) => ok(res, { status: 'up' }))

app.post('/api/auth/register', async (req, res) => {
  const body = parseBody(z.object({
    phone: phoneSchema,
    nickname: z.string().trim().min(2, '昵称至少需要 2 个字').max(20, '昵称不能超过 20 个字'),
    password: z.string().min(6, '密码至少需要 6 位').max(32, '密码不能超过 32 位'),
  }), req.body, res)
  if (!body) return
  const exists = await prisma.user.findUnique({ where: { phone: body.phone } })
  if (exists) return fail(res, '该手机号已经注册，请直接登录', 40002, 400)
  const user = await prisma.user.create({
    data: {
      username: `mobile-${body.phone}`,
      nickname: body.nickname,
      phone: body.phone,
      passwordHash: hashPassword(body.password),
      avatarUrl: `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(body.phone)}`,
      bio: '正在逛直播好物，喜欢真实讲解和明确价格。',
      homepageTitle: '我的直播购物主页',
    },
  })
  ok(res, { token: signIn(user.id), user: publicUser(user) })
})

app.post('/api/auth/login', async (req, res) => {
  const body = parseBody(z.object({
    phone: phoneSchema,
    password: z.string().min(6, '请输入至少 6 位密码').max(32, '密码不能超过 32 位'),
  }), req.body, res)
  if (!body) return
  const user = await prisma.user.findUnique({ where: { phone: body.phone } })
  if (!user) return fail(res, '该手机号尚未注册', 40401, 404)
  if (!passwordMatches(body.password, user.passwordHash)) return fail(res, '手机号或密码错误', 40003, 400)
  ok(res, { token: signIn(user.id), user: publicUser(user) })
})

app.post('/api/auth/mock-login', async (req, res) => {
  const body = z.object({
    username: z.string().min(1).default('test'),
    nickname: z.string().min(1).default('测试用户'),
  }).parse(req.body)
  const username = body.username.replace(/\s+/g, '').toLowerCase() || 'test'
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
  const token = signIn(user.id)
  ok(res, { token, user: publicUser(user) })
})

app.get('/api/users/me', auth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  ok(res, user ? publicUser(user) : null)
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
    content: comment.video ? `评论了视频「${comment.video.title}」：${comment.content}` : `在直播间「${comment.liveRoom?.title || '直播间'}」说：${comment.content}`,
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
    content: interaction.targetType === 'VIDEO' ? '已记录到你的视频互动里' : '已记录到你的商品收藏里',
    avatarUrl: null,
    createdAt: interaction.createdAt,
  }))

  ok(res, [...commentMessages, ...orderMessages, ...interactionMessages].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 30))
})

app.get('/api/users/:id', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: param(req, 'id') },
    include: {
      videos: {
        where: { status: 'PUBLISHED' },
        include: { products: { include: { product: true }, orderBy: { sort: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      },
      liveRooms: { include: { products: { include: { product: true } } }, orderBy: { createdAt: 'desc' } },
      products: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!user) return fail(res, '用户不存在', 40401, 404)
  ok(res, {
    ...publicUser(user),
    videos: user.videos.map((item) => ({ ...item, products: item.products.map((link) => link.product) })),
    liveRooms: user.liveRooms.map((room) => ({ ...room, products: room.products.map((link) => link.product) })),
  })
})

app.get('/api/videos', async (req, res) => {
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 10)
  const userId = optionalUserId(req)
  const [items, total] = await Promise.all([
    prisma.video.findMany({
      where: { status: 'PUBLISHED' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { author: true, products: { include: { product: true }, orderBy: { sort: 'asc' } } },
    }),
    prisma.video.count({ where: { status: 'PUBLISHED' } }),
  ])
  const interactionRows = userId
    ? await prisma.interaction.findMany({
        where: { userId, targetType: 'VIDEO', targetId: { in: items.map((item) => item.id) } },
        select: { targetId: true, type: true },
      })
    : []
  const favoriteCounts = await prisma.interaction.groupBy({
    by: ['targetId'],
    where: { targetType: 'VIDEO', type: 'FAVORITE', targetId: { in: items.map((item) => item.id) } },
    _count: { _all: true },
  })
  const favoriteCountByVideoId = new Map(favoriteCounts.map((item) => [item.targetId, item._count._all]))
  const likedIds = new Set(interactionRows.filter((item) => item.type === 'LIKE').map((item) => item.targetId))
  const favoritedIds = new Set(interactionRows.filter((item) => item.type === 'FAVORITE').map((item) => item.targetId))
  ok(res, {
    items: items.map((item) => ({
      ...item,
      author: item.author ? publicUser(item.author) : null,
      products: item.products.map((link) => link.product),
      favoriteCount: favoriteCountByVideoId.get(item.id) || 0,
      likedByMe: likedIds.has(item.id),
      favoritedByMe: favoritedIds.has(item.id),
    })),
    total,
    page,
    pageSize,
  })
})

app.get('/api/videos/:id', async (req, res) => {
  const userId = optionalUserId(req)
  const video = await prisma.video.findUnique({
    where: { id: param(req, 'id') },
    include: { author: true, products: { include: { product: true }, orderBy: { sort: 'asc' } } },
  })
  if (!video) return fail(res, '视频不存在', 40401, 404)
  const interactions = userId
    ? await prisma.interaction.findMany({
        where: { userId, targetType: 'VIDEO', targetId: video.id },
        select: { type: true },
      })
    : []
  const favoriteCount = await prisma.interaction.count({ where: { targetType: 'VIDEO', targetId: video.id, type: 'FAVORITE' } })
  ok(res, {
    ...video,
    author: video.author ? publicUser(video.author) : null,
    products: video.products.map((link) => link.product),
    favoriteCount,
    likedByMe: interactions.some((item) => item.type === 'LIKE'),
    favoritedByMe: interactions.some((item) => item.type === 'FAVORITE'),
  })
})

app.post('/api/videos/:id/like', async (req, res) => {
  const video = await prisma.video.update({
    where: { id: param(req, 'id') },
    data: { likeCount: { increment: 1 } },
  })
  ok(res, video)
})

async function toggleInteraction(req: AuthedRequest, targetType: string, targetId: string, type: string) {
  const where = { userId_targetType_targetId_type: { userId: req.userId!, targetType, targetId, type } }
  const existing = await prisma.interaction.findUnique({ where })
  if (existing) {
    await prisma.interaction.delete({ where: { id: existing.id } })
    return { active: false }
  }
  await prisma.interaction.create({ data: { userId: req.userId!, targetType, targetId, type } })
  return { active: true }
}

app.post('/api/videos/:id/interactions/:type', auth, async (req: AuthedRequest, res) => {
  const type = param(req, 'type')
  if (!['LIKE', 'FAVORITE'].includes(type)) return fail(res, '不支持的互动类型')
  const videoId = param(req, 'id')
  const result = await toggleInteraction(req, 'VIDEO', videoId, type)
  if (type === 'LIKE') {
    await prisma.video.update({ where: { id: videoId }, data: { likeCount: { increment: result.active ? 1 : -1 } } }).catch(() => null)
  }
  ok(res, result)
})

app.post('/api/products/:id/interactions/:type', auth, async (req: AuthedRequest, res) => {
  const type = param(req, 'type')
  if (!['LIKE', 'FAVORITE'].includes(type)) return fail(res, '不支持的互动类型')
  ok(res, await toggleInteraction(req, 'PRODUCT', param(req, 'id'), type))
})

app.get('/api/videos/:id/products', async (req, res) => {
  const links = await prisma.videoProduct.findMany({
    where: { videoId: param(req, 'id') },
    include: { product: true },
    orderBy: { sort: 'asc' },
  })
  ok(res, links.map((item) => item.product))
})

app.get('/api/products', async (req, res) => {
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 20)
  const [items, total] = await Promise.all([
    prisma.product.findMany({ skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
    prisma.product.count(),
  ])
  ok(res, { items, total, page, pageSize })
})

app.get('/api/products/:id', async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: param(req, 'id') } })
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
  const body = z.object({ productId: z.string(), quantity: z.number().int().positive().default(1) }).parse(req.body)
  const product = await prisma.product.findUnique({ where: { id: body.productId } })
  if (!product || product.status !== 'ON_SALE') return fail(res, '商品不可购买')
  if (product.stock < body.quantity) return fail(res, '库存不足')
  const item = await prisma.cartItem.upsert({
    where: { userId_productId: { userId: req.userId!, productId: body.productId } },
    update: { quantity: { increment: body.quantity }, selected: true },
    create: { userId: req.userId!, productId: body.productId, quantity: body.quantity },
    include: { product: true },
  })
  ok(res, item)
})

app.patch('/api/cart/select-all', auth, async (req: AuthedRequest, res) => {
  const body = z.object({ selected: z.boolean() }).parse(req.body)
  await prisma.cartItem.updateMany({ where: { userId: req.userId }, data: { selected: body.selected } })
  ok(res, true)
})

app.patch('/api/cart/:cartItemId', auth, async (req: AuthedRequest, res) => {
  const body = z.object({ quantity: z.number().int().positive() }).parse(req.body)
  const existing = await prisma.cartItem.findFirst({ where: { id: param(req, 'cartItemId'), userId: req.userId } })
  if (!existing) return fail(res, '购物车商品不存在', 40401, 404)
  const item = await prisma.cartItem.update({
    where: { id: existing.id },
    data: { quantity: body.quantity },
    include: { product: true },
  })
  ok(res, item)
})

app.patch('/api/cart/:cartItemId/selected', auth, async (req: AuthedRequest, res) => {
  const body = z.object({ selected: z.boolean() }).parse(req.body)
  const existing = await prisma.cartItem.findFirst({ where: { id: param(req, 'cartItemId'), userId: req.userId } })
  if (!existing) return fail(res, '购物车商品不存在', 40401, 404)
  const item = await prisma.cartItem.update({
    where: { id: existing.id },
    data: { selected: body.selected },
    include: { product: true },
  })
  ok(res, item)
})

app.delete('/api/cart/:cartItemId', auth, async (req: AuthedRequest, res) => {
  const existing = await prisma.cartItem.findFirst({ where: { id: param(req, 'cartItemId'), userId: req.userId } })
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
          where: { userId: req.userId, id: { in: body.cartItemIds || [] }, selected: true },
          include: { product: true },
        })
      : []

  const products =
    body.source === 'buyNow' && body.productId
      ? [{ product: await prisma.product.findUnique({ where: { id: body.productId } }), quantity: body.quantity || 1 }]
      : cartItems.map((item) => ({ product: item.product, quantity: item.quantity }))

  if (!products.length || products.some((item) => !item.product)) return fail(res, '没有可结算商品')
  for (const item of products) {
    if (item.product!.status !== 'ON_SALE') return fail(res, `${item.product!.title} 已下架`)
    if (item.product!.stock < item.quantity) return fail(res, `${item.product!.title} 库存不足`)
  }

  const totalAmount = products.reduce((sum, item) => sum + item.product!.price * item.quantity, 0)
  const coupon = body.couponId ? await prisma.coupon.findUnique({ where: { id: body.couponId } }) : null
  const discountAmount = coupon && coupon.status === 'ACTIVE' && totalAmount >= coupon.minAmount ? coupon.amount : 0
  const payAmount = Math.max(totalAmount - discountAmount, 0)

  const order = await prisma.$transaction(async (tx) => {
    for (const item of products) {
      await tx.product.update({
        where: { id: item.product!.id },
        data: { stock: { decrement: item.quantity }, sales: { increment: item.quantity } },
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
      await tx.cartItem.deleteMany({ where: { userId: req.userId, id: { in: body.cartItemIds || [] } } })
    }
    return created
  })

  ok(res, order)
})

app.get('/api/orders', auth, async (req: AuthedRequest, res) => {
  const statusSchema = z.enum(['PENDING_PAYMENT', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED'])
  const parsedStatus = typeof req.query.status === 'string' ? statusSchema.safeParse(req.query.status) : null
  if (parsedStatus && !parsedStatus.success) return fail(res, '订单状态不正确')
  const status = parsedStatus?.success ? parsedStatus.data : undefined
  const orders = await prisma.order.findMany({
    where: { userId: req.userId, ...(status ? { status } : {}) },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  })
  ok(res, orders)
})

app.get('/api/orders/:id', auth, async (req: AuthedRequest, res) => {
  const order = await prisma.order.findFirst({ where: { id: param(req, 'id'), userId: req.userId }, include: { items: true } })
  if (!order) return fail(res, '订单不存在', 40401, 404)
  ok(res, order)
})

app.post('/api/orders/:id/pay', auth, async (req: AuthedRequest, res) => {
  const existing = await prisma.order.findFirst({ where: { id: param(req, 'id'), userId: req.userId } })
  if (!existing) return fail(res, '订单不存在', 40401, 404)
  const order = await prisma.order.update({
    where: { id: existing.id },
    data: { status: 'PAID' },
    include: { items: true },
  })
  ok(res, order)
})

app.post('/api/orders/:id/cancel', auth, async (req: AuthedRequest, res) => {
  const existing = await prisma.order.findFirst({ where: { id: param(req, 'id'), userId: req.userId } })
  if (!existing) return fail(res, '订单不存在', 40401, 404)
  const order = await prisma.order.update({
    where: { id: existing.id },
    data: { status: 'CANCELLED' },
    include: { items: true },
  })
  ok(res, order)
})

app.get('/api/live-rooms', async (_req, res) => {
  const rooms = await prisma.liveRoom.findMany({ include: { anchor: true, products: { include: { product: true } } } })
  ok(res, rooms.map((room) => ({ ...room, anchor: room.anchor ? publicUser(room.anchor) : null, products: room.products.map((item) => item.product) })))
})

app.get('/api/live-rooms/:id', async (req, res) => {
  const room = await prisma.liveRoom.findUnique({ where: { id: param(req, 'id') }, include: { anchor: true, products: { include: { product: true } } } })
  if (!room) return fail(res, '直播间不存在', 40401, 404)
  ok(res, { ...room, anchor: room.anchor ? publicUser(room.anchor) : null, products: room.products.map((item) => item.product) })
})

app.get('/api/live-rooms/:id/products', async (req, res) => {
  const links = await prisma.liveRoomProduct.findMany({ where: { liveRoomId: param(req, 'id') }, include: { product: true }, orderBy: { sort: 'asc' } })
  ok(res, links.map((item) => item.product))
})

app.get('/api/live-rooms/:id/comments', async (req, res) => {
  const comments = await prisma.comment.findMany({ where: { liveRoomId: param(req, 'id') }, include: { user: true }, orderBy: { createdAt: 'desc' }, take: 50 })
  ok(res, comments.reverse().map((comment) => ({ ...comment, user: publicUser(comment.user) })))
})

app.post('/api/live-rooms/:id/comments', auth, async (req: AuthedRequest, res) => {
  const body = z.object({ content: z.string().min(1) }).parse(req.body)
  const liveRoomId = param(req, 'id')
  const comment = await prisma.comment.create({ data: { liveRoomId, userId: req.userId!, content: body.content }, include: { user: true } })
  const safeComment = { ...comment, user: publicUser(comment.user) }
  req.app.get('liveIo')?.to(liveRoomId).emit('live:comment:new', safeComment)
  ok(res, safeComment)
})

app.get('/api/live-rooms/:id/audience', async (req, res) => {
  const room = await prisma.liveRoom.findUnique({ where: { id: param(req, 'id') }, include: { comments: { include: { user: true }, take: 20, orderBy: { createdAt: 'desc' } } } })
  if (!room) return fail(res, '直播间不存在', 40401, 404)
  const users = Array.from(new Map(room.comments.map((comment) => [comment.user.id, publicUser(comment.user)])).values())
  ok(res, users)
})

app.get('/api/videos/:id/comments', async (req, res) => {
  const comments = await prisma.comment.findMany({ where: { videoId: param(req, 'id') }, include: { user: true }, orderBy: { createdAt: 'desc' }, take: 50 })
  ok(res, comments.reverse().map((comment) => ({ ...comment, user: publicUser(comment.user) })))
})

app.post('/api/videos/:id/comments', auth, async (req: AuthedRequest, res) => {
  const body = z.object({ content: z.string().min(1) }).parse(req.body)
  const videoId = param(req, 'id')
  const comment = await prisma.comment.create({ data: { videoId, userId: req.userId!, content: body.content }, include: { user: true } })
  await prisma.video.update({ where: { id: videoId }, data: { commentCount: { increment: 1 } } })
  ok(res, { ...comment, user: publicUser(comment.user) })
})

app.use('/api/admin', auth)

app.get('/api/admin/dashboard/overview', async (_req, res) => {
  const [productCount, videoCount, liveRoomCount, orderCount, paidOrders] = await Promise.all([
    prisma.product.count(),
    prisma.video.count(),
    prisma.liveRoom.count(),
    prisma.order.count(),
    prisma.order.findMany({ where: { status: { in: ['PAID', 'SHIPPED', 'COMPLETED'] } } }),
  ])
  ok(res, { productCount, videoCount, liveRoomCount, orderCount, gmv: paidOrders.reduce((sum, order) => sum + order.payAmount, 0) })
})

app.get('/api/admin/products', async (_req, res) => ok(res, await prisma.product.findMany({ orderBy: { createdAt: 'desc' } })))
app.post('/api/admin/products', async (req, res) => ok(res, await prisma.product.create({ data: req.body })))
app.patch('/api/admin/products/:id', async (req, res) => ok(res, await prisma.product.update({ where: { id: req.params.id }, data: req.body })))
app.patch('/api/admin/products/:id/status', async (req, res) => ok(res, await prisma.product.update({ where: { id: req.params.id }, data: { status: req.body.status } })))

const adminVideoSchema = z.object({
  title: z.string().trim().min(2, '视频标题至少需要 2 个字'),
  videoUrl: z.string().trim().url('请先上传本地视频'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'OFFLINE']).default('DRAFT'),
  productIds: z.array(z.string()).default([]),
})
const defaultVideoCover = 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=900'

async function replaceVideoProducts(videoId: string, productIds: string[]) {
  await prisma.videoProduct.deleteMany({ where: { videoId } })
  if (productIds.length) {
    await prisma.videoProduct.createMany({ data: productIds.map((productId, sort) => ({ videoId, productId, sort })) })
  }
}

async function coverForVideo(productIds: string[], fallback?: string | null) {
  if (!productIds.length) return fallback || defaultVideoCover
  const product = await prisma.product.findUnique({ where: { id: productIds[0] }, select: { coverUrl: true } })
  return product?.coverUrl || fallback || defaultVideoCover
}

app.get('/api/admin/videos', async (_req, res) => ok(res, await prisma.video.findMany({ include: { products: { include: { product: true }, orderBy: { sort: 'asc' } } }, orderBy: { createdAt: 'desc' } })))
app.post('/api/admin/upload/video', upload.single('file'), async (req, res) => {
  if (!req.file) return fail(res, '请选择要上传的视频文件')
  if (!req.file.mimetype.startsWith('video/')) return fail(res, '只能上传视频文件')
  ok(res, await uploadToCos(req.file))
})
app.post('/api/admin/videos', async (req: AuthedRequest, res) => {
  const body = adminVideoSchema.parse(req.body)
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) return fail(res, '用户不存在', 40401, 404)
  const coverUrl = await coverForVideo(body.productIds)
  const video = await prisma.$transaction(async (tx) => {
    const created = await tx.video.create({
      data: {
        title: body.title,
        coverUrl,
        videoUrl: body.videoUrl,
        authorName: user.nickname,
        authorAvatar: user.avatarUrl || null,
        userId: user.id,
        status: body.status,
      },
    })
    if (body.productIds.length) {
      await tx.videoProduct.createMany({ data: body.productIds.map((productId, sort) => ({ videoId: created.id, productId, sort })) })
    }
    return created
  })
  ok(res, video)
})
app.patch('/api/admin/videos/:id', async (req: AuthedRequest, res) => {
  const body = adminVideoSchema.parse(req.body)
  const videoId = param(req, 'id')
  const [user, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.userId } }),
    prisma.video.findUnique({ where: { id: videoId } }),
  ])
  if (!user) return fail(res, '用户不存在', 40401, 404)
  if (!existing) return fail(res, '视频不存在', 40401, 404)
  const coverUrl = await coverForVideo(body.productIds, existing.coverUrl)
  const video = await prisma.$transaction(async (tx) => {
    const updated = await tx.video.update({
      where: { id: videoId },
      data: {
        title: body.title,
        coverUrl,
        videoUrl: body.videoUrl,
        authorName: user.nickname,
        authorAvatar: user.avatarUrl || null,
        userId: user.id,
        status: body.status,
      },
    })
    await tx.videoProduct.deleteMany({ where: { videoId } })
    if (body.productIds.length) {
      await tx.videoProduct.createMany({ data: body.productIds.map((productId, sort) => ({ videoId, productId, sort })) })
    }
    return updated
  })
  ok(res, video)
})
app.patch('/api/admin/videos/:id/status', async (req, res) => ok(res, await prisma.video.update({ where: { id: param(req, 'id') }, data: { status: req.body.status } })))
app.post('/api/admin/videos/:id/products', async (req, res) => {
  const body = z.object({ productIds: z.array(z.string()) }).parse(req.body)
  const videoId = param(req, 'id')
  await replaceVideoProducts(videoId, body.productIds)
  ok(res, true)
})

app.get('/api/admin/live-rooms', async (_req, res) => ok(res, await prisma.liveRoom.findMany({ include: { products: { include: { product: true } } }, orderBy: { createdAt: 'desc' } })))
app.post('/api/admin/live-rooms', async (req, res) => ok(res, await prisma.liveRoom.create({ data: req.body })))
app.patch('/api/admin/live-rooms/:id', async (req, res) => ok(res, await prisma.liveRoom.update({ where: { id: param(req, 'id') }, data: req.body })))
app.post('/api/admin/live-rooms/:id/products', async (req, res) => {
  const body = z.object({ productIds: z.array(z.string()) }).parse(req.body)
  const liveRoomId = param(req, 'id')
  await prisma.liveRoomProduct.deleteMany({ where: { liveRoomId } })
  await prisma.liveRoomProduct.createMany({ data: body.productIds.map((productId, sort) => ({ liveRoomId, productId, sort })) })
  ok(res, true)
})
app.patch('/api/admin/live-rooms/:id/current-product', async (req, res) => {
  const liveRoomId = param(req, 'id')
  const linked = await prisma.liveRoomProduct.findFirst({ where: { liveRoomId, productId: req.body.productId } })
  if (!linked) return fail(res, '请先将商品绑定到直播间')
  const room = await prisma.liveRoom.update({ where: { id: liveRoomId }, data: { currentProductId: req.body.productId } })
  const product = await prisma.product.findUnique({ where: { id: req.body.productId } })
  req.app.get('liveIo')?.to(liveRoomId).emit('live:current-product:update', { liveRoomId, product })
  ok(res, room)
})
app.post('/api/admin/live-rooms/:id/push-coupon', async (req, res) => {
  const coupon = await prisma.coupon.findFirst({ where: { status: 'ACTIVE' } })
  req.app.get('liveIo')?.to(param(req, 'id')).emit('live:coupon:push', { liveRoomId: param(req, 'id'), coupon })
  ok(res, coupon)
})

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof z.ZodError) return fail(res, err.issues[0]?.message || '请求参数错误', 40000, 400)
  const message = err instanceof Error ? err.message : '服务器异常'
  fail(res, message, 50001, 500)
})
