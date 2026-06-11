import cors from 'cors'
import COS from 'cos-nodejs-sdk-v5'
import express from 'express'
import jwt from 'jsonwebtoken'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from './prisma.js'
import { auth, type AuthedRequest } from './middlewares/auth.js'
import { registerAiRoutes } from './ai/router.js'
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

function optionalUserIdFromHeader(req: express.Request) {
  return optionalUserId(req)
}

function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown, res: express.Response): z.infer<T> | undefined {
  const result = schema.safeParse(body)
  if (result.success) return result.data
  fail(res, result.error.issues[0]?.message || '请求参数错误', 40000, 400)
}

const behaviorEventSchema = z.object({
  eventType: z.string().min(1).max(60),
  targetType: z.string().max(40).optional().nullable(),
  targetId: z.string().max(120).optional().nullable(),
  videoId: z.string().max(120).optional().nullable(),
  liveRoomId: z.string().max(120).optional().nullable(),
  productId: z.string().max(120).optional().nullable(),
  source: z.string().max(80).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  price: z.number().int().nonnegative().optional().nullable(),
  quantity: z.number().int().positive().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
})

app.post('/api/events', async (req, res) => {
  const body = parseBody(behaviorEventSchema, req.body, res)
  if (!body) return
  const product = body.productId
    ? await prisma.product.findUnique({
        where: { id: body.productId },
        select: { category: true, price: true },
      }).catch(() => null)
    : null
  const event = await prisma.behaviorEvent.create({
    data: {
      userId: optionalUserIdFromHeader(req),
      eventType: body.eventType,
      targetType: body.targetType || undefined,
      targetId: body.targetId || undefined,
      videoId: body.videoId || undefined,
      liveRoomId: body.liveRoomId || undefined,
      productId: body.productId || undefined,
      source: body.source || undefined,
      category: body.category || product?.category || undefined,
      price: body.price ?? product?.price ?? undefined,
      quantity: body.quantity || undefined,
      metadata: body.metadata ? JSON.stringify(body.metadata) : undefined,
    },
  })
  ok(res, { id: event.id })
})

type MarketingRuleInput = {
  type: string
  title: string
  status?: string
  productId?: string | null
  amount?: number | null
  minAmount?: number | null
  discountPercent?: number | null
  countdownSeconds?: number | null
  startsAt?: Date | string | null
  endsAt?: Date | string | null
}

function activeMarketingRuleWhere(liveRoomId: string) {
  return {
    liveRoomId,
    status: 'ACTIVE',
  }
}

function marketingRuleDto(rule: {
  id: string
  liveRoomId: string
  type: string
  title: string
  status: string
  productId: string | null
  amount: number | null
  minAmount: number | null
  discountPercent: number | null
  countdownSeconds: number | null
  startsAt: Date | null
  endsAt: Date | null
  createdAt: Date
}) {
  return {
    ...rule,
    startsAt: rule.startsAt?.toISOString() || null,
    endsAt: rule.endsAt?.toISOString() || null,
    createdAt: rule.createdAt.toISOString(),
  }
}

async function marketingRulesForRoom(liveRoomId: string) {
  const rules = await prisma.marketingRule.findMany({ where: { liveRoomId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } })
  return rules.map(marketingRuleDto)
}

function bestPercentForProduct(rules: MarketingRuleInput[], productId: string) {
  const percents = rules
    .filter((rule) => ['DISCOUNT', 'SECKILL'].includes(rule.type) && (!rule.productId || rule.productId === productId) && rule.discountPercent)
    .map((rule) => Math.max(1, Math.min(100, Number(rule.discountPercent))))
  return percents.length ? Math.min(...percents) : 100
}

function calculateMarketingDiscount(products: Array<{ product: { id: string; price: number }; quantity: number }>, rules: MarketingRuleInput[]) {
  const totalAmount = products.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const discountedAmount = products.reduce((sum, item) => {
    const percent = bestPercentForProduct(rules, item.product.id)
    return sum + Math.round(item.product.price * percent / 100) * item.quantity
  }, 0)
  const priceDiscountAmount = Math.max(totalAmount - discountedAmount, 0)
  const fullReduction = rules
    .filter((rule) => rule.type === 'FULL_REDUCTION' && rule.amount && discountedAmount >= (rule.minAmount || 0))
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))[0]
  const fullReductionAmount = fullReduction ? Number(fullReduction.amount) : 0
  const coupon = rules
    .filter((rule) => rule.type === 'COUPON' && rule.amount && discountedAmount >= (rule.minAmount || 0))
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))[0]
  const couponAmount = coupon ? Number(coupon.amount) : 0
  const discountAmount = Math.min(priceDiscountAmount + fullReductionAmount + couponAmount, totalAmount)
  return {
    totalAmount,
    discountedAmount,
    priceDiscountAmount,
    fullReductionAmount,
    couponAmount,
    discountAmount,
    payAmount: Math.max(totalAmount - discountAmount, 0),
  }
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

function fileExtension(file: Express.Multer.File) {
  const fromName = path.extname(file.originalname || '').replace(/[^\w.]/g, '').toLowerCase()
  if (fromName) return fromName
  const fromMime = file.mimetype.split('/')[1]?.split(';')[0]
  return fromMime ? `.${fromMime.replace(/[^\w]/g, '')}` : ''
}

async function uploadToCos(file: Express.Multer.File, prefixName = 'TENCENT_COS_PREFIX') {
  const secretId = envValue('TENCENT_SECRET_ID')
  const secretKey = envValue('TENCENT_SECRET_KEY')
  const bucket = envValue('TENCENT_COS_BUCKET')
  const region = envValue('TENCENT_COS_REGION')
  const prefix = envValue(prefixName) || envValue('TENCENT_COS_PREFIX') || ''
  if (!secretId || !secretKey || !bucket || !region) throw new Error('COS 配置不完整，请检查 .env')

  const cos = new COS({ SecretId: secretId, SecretKey: secretKey })
  const key = `${prefix}${Date.now()}-${randomBytes(8).toString('hex')}${fileExtension(file)}`
  await new Promise((resolve, reject) => {
    cos.putObject(
      {
        Bucket: bucket,
        Region: region,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || 'video/mp4',
        ACL: 'public-read',
      },
      (error, data) => (error ? reject(error) : resolve(data)),
    )
  })
  return { key, url: cosObjectUrl(bucket, region, key) }
}

app.get('/api/health', (_req, res) => ok(res, { status: 'up' }))

app.get('/api/media-proxy', async (req, res) => {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url : ''
  if (!rawUrl) return fail(res, '缺少媒体地址')
  let mediaUrl: URL
  try {
    mediaUrl = new URL(rawUrl)
  } catch {
    return fail(res, '媒体地址格式不正确')
  }
  const allowedHosts = ['myqcloud.com', 'unsplash.com']
  if (!allowedHosts.some((host) => mediaUrl.hostname === host || mediaUrl.hostname.endsWith(`.${host}`))) {
    return fail(res, '不允许代理该媒体地址')
  }

  const upstream = await fetch(mediaUrl, {
    headers: req.headers.range ? { Range: req.headers.range } : undefined,
  })
  if (!upstream.ok && upstream.status !== 206) {
    return fail(res, `媒体资源访问失败：${upstream.status}`, 50002, upstream.status)
  }
  res.status(upstream.status)
  for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control']) {
    const value = upstream.headers.get(header)
    if (value) res.setHeader(header, value)
  }
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (!upstream.body) return res.end()
  Readable.fromWeb(upstream.body as never).pipe(res)
})

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
    update: {},
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

app.patch('/api/users/me', auth, async (req: AuthedRequest, res) => {
  const body = z.object({
    nickname: z.string().trim().min(2, '昵称至少需要 2 个字').max(20, '昵称不能超过 20 个字').optional(),
    avatarUrl: z.string().trim().url('请输入正确的头像地址').or(z.literal('')).optional(),
  }).parse(req.body)

  const data: { nickname?: string; avatarUrl?: string | null } = {}
  if (body.nickname !== undefined) data.nickname = body.nickname
  if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl || null
  if (!Object.keys(data).length) return fail(res, '没有可更新的资料')

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: req.userId! },
      data,
    })
    const syncData = {
      ...(data.nickname ? { authorName: data.nickname } : {}),
      ...(body.avatarUrl !== undefined ? { authorAvatar: data.avatarUrl } : {}),
    }
    if (Object.keys(syncData).length) {
      await tx.video.updateMany({ where: { userId: req.userId }, data: syncData })
    }
    const liveSyncData = {
      ...(data.nickname ? { anchorName: data.nickname } : {}),
      ...(body.avatarUrl !== undefined ? { anchorAvatar: data.avatarUrl } : {}),
    }
    if (Object.keys(liveSyncData).length) {
      await tx.liveRoom.updateMany({ where: { anchorUserId: req.userId }, data: liveSyncData })
    }
    return updated
  })

  ok(res, publicUser(user))
})

app.post('/api/users/me/avatar', auth, upload.single('file'), async (req: AuthedRequest, res) => {
  if (!req.file) return fail(res, '请上传头像图片')
  if (!req.file.mimetype.startsWith('image/')) return fail(res, '只能上传图片文件')
  const result = await uploadToCos(req.file, 'TENCENT_COS_IMAGE_PREFIX')
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: req.userId! },
      data: { avatarUrl: result.url },
    })
    await tx.video.updateMany({
      where: { userId: req.userId },
      data: { authorAvatar: result.url },
    })
    await tx.liveRoom.updateMany({
      where: { anchorUserId: req.userId },
      data: { anchorAvatar: result.url },
    })
    return updated
  })
  ok(res, { user: publicUser(user), upload: result })
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
  const liveRooms = await prisma.liveRoom.findMany({
    where: {
      status: { in: ['LIVE', 'LIVING'] },
      OR: [
        { videoId: { in: items.map((item) => item.id) } },
        { videoUrl: { in: items.map((item) => item.videoUrl) } },
      ],
    },
    select: { id: true, videoId: true, videoUrl: true },
  })
  const liveRoomIdByVideoId = new Map(liveRooms.filter((room) => room.videoId).map((room) => [room.videoId, room.id]))
  const liveRoomIdByVideoUrl = new Map(liveRooms.map((room) => [room.videoUrl, room.id]))
  ok(res, {
    items: items.map((item) => ({
      ...item,
      author: item.author ? publicUser(item.author) : null,
      products: item.products.map((link) => link.product),
      liveRoomId: liveRoomIdByVideoId.get(item.id) || liveRoomIdByVideoUrl.get(item.videoUrl) || null,
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
  const liveRoom = await prisma.liveRoom.findFirst({
    where: { OR: [{ videoId: video.id }, { videoUrl: video.videoUrl }], status: { in: ['LIVE', 'LIVING'] } },
    select: { id: true },
  })
  ok(res, {
    ...video,
    author: video.author ? publicUser(video.author) : null,
    products: video.products.map((link) => link.product),
    liveRoomId: liveRoom?.id || null,
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

app.post('/api/videos/:id/share', async (req, res) => {
  const video = await prisma.video.update({
    where: { id: param(req, 'id') },
    data: { shareCount: { increment: 1 } },
    select: { shareCount: true },
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
      liveRoomId: z.string().optional(),
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
  const marketingRules = body.liveRoomId ? await prisma.marketingRule.findMany({ where: activeMarketingRuleWhere(body.liveRoomId) }) : []
  const marketing = calculateMarketingDiscount(products.map((item) => ({ product: { id: item.product!.id, price: item.product!.price }, quantity: item.quantity })), marketingRules)
  const couponDiscountAmount = coupon && coupon.status === 'ACTIVE' && marketing.payAmount >= coupon.minAmount ? coupon.amount : 0
  const discountAmount = Math.min(marketing.discountAmount + couponDiscountAmount, totalAmount)
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
  const rooms = await prisma.liveRoom.findMany({ include: { anchor: true, products: { include: { product: true } }, marketingRules: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } } } })
  ok(res, rooms.map((room) => ({ ...room, anchor: room.anchor ? publicUser(room.anchor) : null, products: room.products.map((item) => item.product), marketingRules: room.marketingRules.map(marketingRuleDto) })))
})

app.get('/api/live-rooms/:id', async (req, res) => {
  const room = await prisma.liveRoom.findUnique({ where: { id: param(req, 'id') }, include: { anchor: true, products: { include: { product: true } }, marketingRules: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } } } })
  if (!room) return fail(res, '直播间不存在', 40401, 404)
  ok(res, { ...room, anchor: room.anchor ? publicUser(room.anchor) : null, products: room.products.map((item) => item.product), marketingRules: room.marketingRules.map(marketingRuleDto) })
})

app.get('/api/live-rooms/:id/marketing-rules', async (req, res) => {
  ok(res, await marketingRulesForRoom(param(req, 'id')))
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
registerAiRoutes(app)

async function adminOwnerUser() {
  return prisma.user.upsert({
    where: { username: 'test' },
    update: { nickname: '测试者' },
    create: {
      username: 'test',
      nickname: '测试者',
      avatarUrl: 'https://api.dicebear.com/9.x/thumbs/png?seed=test',
      bio: '测试阶段统一使用的商家身份。',
      homepageTitle: '测试者的运营主页',
    },
  })
}

async function attachLiveRoomToVideos<T extends { id: string; videoUrl: string }>(videos: T[]) {
  const rooms = await prisma.liveRoom.findMany({
    where: {
      OR: [
        { videoId: { in: videos.map((item) => item.id) } },
        { videoUrl: { in: videos.map((item) => item.videoUrl) } },
      ],
    },
    include: { products: { include: { product: true }, orderBy: { sort: 'asc' } } },
  })
  const roomByVideoId = new Map(rooms.filter((room) => room.videoId).map((room) => [room.videoId, room]))
  const roomByVideoUrl = new Map(rooms.map((room) => [room.videoUrl, room]))
  return videos.map((video) => {
    const liveRoom = roomByVideoId.get(video.id) || roomByVideoUrl.get(video.videoUrl)
    return {
      ...video,
      liveRoom: liveRoom ? { ...liveRoom, products: liveRoom.products } : null,
      liveRoomId: liveRoom?.id || null,
    }
  })
}

async function syncLiveRoomForVideo(input: {
  videoId: string
  oldVideoUrl?: string | null
  title: string
  coverUrl: string
  videoUrl: string
  ownerId: string
  ownerName: string
  ownerAvatar?: string | null
  productIds: string[]
  liveTitle?: string | null
  liveStatus?: string
  currentProductId?: string | null
}) {
  const productIds = uniqueIds(input.productIds)
  const existing = await prisma.liveRoom.findFirst({
    where: {
      OR: [
        { videoId: input.videoId },
        { videoUrl: input.videoUrl },
        ...(input.oldVideoUrl && input.oldVideoUrl !== input.videoUrl ? [{ videoUrl: input.oldVideoUrl }] : []),
      ],
    },
  })
  const liveRoom = await prisma.liveRoom.upsert({
    where: { id: existing?.id || '__new_live_room__' },
    update: {
      title: input.liveTitle || input.title,
      videoId: input.videoId,
      coverUrl: input.coverUrl,
      videoUrl: input.videoUrl,
      anchorName: input.ownerName,
      anchorAvatar: input.ownerAvatar || null,
      anchorUserId: input.ownerId,
      status: input.liveStatus || 'LIVE',
      currentProductId: currentProductForRoom(productIds, input.currentProductId),
    },
    create: {
      title: input.liveTitle || input.title,
      videoId: input.videoId,
      coverUrl: input.coverUrl,
      videoUrl: input.videoUrl,
      anchorName: input.ownerName,
      anchorAvatar: input.ownerAvatar || null,
      anchorUserId: input.ownerId,
      status: input.liveStatus || 'LIVE',
      currentProductId: currentProductForRoom(productIds, input.currentProductId),
    },
  })
  await prisma.liveRoomProduct.deleteMany({ where: { liveRoomId: liveRoom.id } })
  if (productIds.length) {
    await prisma.liveRoomProduct.createMany({ data: productIds.map((productId, sort) => ({ liveRoomId: liveRoom.id, productId, sort })) })
  }
  const product = liveRoom.currentProductId ? await prisma.product.findUnique({ where: { id: liveRoom.currentProductId } }) : null
  app.get('liveIo')?.to(liveRoom.id).emit('live:current-product:update', { liveRoomId: liveRoom.id, product })
  return liveRoom
}

app.get('/api/admin/dashboard/overview', async (_req, res) => {
  const owner = await adminOwnerUser()
  const [productCount, videoCount, liveRoomCount, orderCount, paidOrders] = await Promise.all([
    prisma.product.count({ where: { sellerId: owner.id } }),
    prisma.video.count({ where: { userId: owner.id } }),
    prisma.liveRoom.count({ where: { anchorUserId: owner.id } }),
    prisma.order.count(),
    prisma.order.findMany({ where: { status: { in: ['PAID', 'SHIPPED', 'COMPLETED'] } } }),
  ])
  ok(res, { productCount, videoCount, liveRoomCount, orderCount, gmv: paidOrders.reduce((sum, order) => sum + order.payAmount, 0) })
})

const productStatusSchema = z.enum(['ON_SALE', 'OFF_SALE'])
const liveRoomStatusSchema = z.preprocess((value) => value === 'LIVING' ? 'LIVE' : value, z.enum(['NOT_STARTED', 'LIVE', 'ENDED']))
const adminProductSchema = z.object({
  title: z.string().trim().min(2, '商品名称至少需要 2 个字'),
  coverUrl: z.string().trim().url('请先上传商品图片'),
  price: z.number().int().nonnegative('价格不能小于 0'),
  originPrice: z.number().int().nonnegative().optional().nullable(),
  stock: z.number().int().nonnegative('库存不能小于 0'),
  status: productStatusSchema.default('ON_SALE'),
  category: z.string().trim().optional().nullable(),
  tags: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  videoIds: z.array(z.string()).default([]),
  liveRoomIds: z.array(z.string()).default([]),
})

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)))
}

async function replaceProductBindings(productId: string, videoIds: string[], liveRoomIds: string[]) {
  const nextVideoIds = uniqueIds(videoIds)
  const nextLiveRoomIds = uniqueIds(liveRoomIds)
  await prisma.videoProduct.deleteMany({ where: { productId } })
  await prisma.liveRoomProduct.deleteMany({ where: { productId } })
  if (nextVideoIds.length) {
    await prisma.videoProduct.createMany({ data: nextVideoIds.map((videoId, sort) => ({ videoId, productId, sort })) })
  }
  if (nextLiveRoomIds.length) {
    await prisma.liveRoomProduct.createMany({ data: nextLiveRoomIds.map((liveRoomId, sort) => ({ liveRoomId, productId, sort })) })
  }
}

app.get('/api/admin/products', async (_req, res) => {
  const owner = await adminOwnerUser()
  ok(res, await prisma.product.findMany({
    where: { sellerId: owner.id },
  include: {
    videoLinks: { include: { video: { select: { id: true, title: true } } }, orderBy: { sort: 'asc' } },
    liveLinks: { include: { liveRoom: { select: { id: true, title: true } } }, orderBy: { sort: 'asc' } },
  },
  orderBy: { createdAt: 'desc' },
  }))
})
app.post('/api/admin/upload/image', upload.single('file'), async (req, res) => {
  if (!req.file) return fail(res, '请选择要上传的商品图片')
  if (!req.file.mimetype.startsWith('image/')) return fail(res, '只能上传图片文件')
  ok(res, await uploadToCos(req.file, 'TENCENT_COS_IMAGE_PREFIX'))
})
app.post('/api/admin/products', async (req: AuthedRequest, res) => {
  const owner = await adminOwnerUser()
  const body = adminProductSchema.parse(req.body)
  const { videoIds, liveRoomIds, ...productData } = body
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({ data: { ...productData, originPrice: productData.originPrice || null, sellerId: owner.id } })
    const nextVideoIds = uniqueIds(videoIds)
    const nextLiveRoomIds = uniqueIds(liveRoomIds)
    if (nextVideoIds.length) await tx.videoProduct.createMany({ data: nextVideoIds.map((videoId, sort) => ({ videoId, productId: created.id, sort })) })
    if (nextLiveRoomIds.length) await tx.liveRoomProduct.createMany({ data: nextLiveRoomIds.map((liveRoomId, sort) => ({ liveRoomId, productId: created.id, sort })) })
    return created
  })
  ok(res, product)
})
app.patch('/api/admin/products/:id', async (req: AuthedRequest, res) => {
  const owner = await adminOwnerUser()
  const body = adminProductSchema.parse(req.body)
  const productId = param(req, 'id')
  const existing = await prisma.product.findFirst({ where: { id: productId, sellerId: owner.id } })
  if (!existing) return fail(res, '商品不存在', 40401, 404)
  const { videoIds, liveRoomIds, ...productData } = body
  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id: productId }, data: { ...productData, originPrice: productData.originPrice || null, sellerId: owner.id } })
    await tx.videoProduct.deleteMany({ where: { productId } })
    await tx.liveRoomProduct.deleteMany({ where: { productId } })
    const nextVideoIds = uniqueIds(videoIds)
    const nextLiveRoomIds = uniqueIds(liveRoomIds)
    if (nextVideoIds.length) await tx.videoProduct.createMany({ data: nextVideoIds.map((videoId, sort) => ({ videoId, productId, sort })) })
    if (nextLiveRoomIds.length) await tx.liveRoomProduct.createMany({ data: nextLiveRoomIds.map((liveRoomId, sort) => ({ liveRoomId, productId, sort })) })
    return updated
  })
  ok(res, product)
})
app.patch('/api/admin/products/:id/status', async (req, res) => {
  const owner = await adminOwnerUser()
  const body = z.object({ status: productStatusSchema }).parse(req.body)
  const existing = await prisma.product.findFirst({ where: { id: param(req, 'id'), sellerId: owner.id } })
  if (!existing) return fail(res, '商品不存在', 40401, 404)
  ok(res, await prisma.product.update({ where: { id: param(req, 'id') }, data: { status: body.status } }))
})

const adminVideoSchema = z.object({
  title: z.string().trim().min(2, '视频标题至少需要 2 个字'),
  videoUrl: z.string().trim().url('请先上传本地视频'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'OFFLINE']).default('DRAFT'),
  productIds: z.array(z.string()).default([]),
  liveTitle: z.string().trim().optional().nullable(),
  liveStatus: liveRoomStatusSchema.default('LIVE'),
  currentProductId: z.string().optional().nullable(),
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

app.get('/api/admin/videos', async (_req, res) => {
  const owner = await adminOwnerUser()
  const videos = await prisma.video.findMany({
    where: { userId: owner.id },
    include: { products: { include: { product: true }, orderBy: { sort: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  ok(res, await attachLiveRoomToVideos(videos))
})
app.post('/api/admin/upload/video', upload.single('file'), async (req, res) => {
  if (!req.file) return fail(res, '请选择要上传的视频文件')
  if (!req.file.mimetype.startsWith('video/')) return fail(res, '只能上传视频文件')
  ok(res, await uploadToCos(req.file))
})
app.post('/api/admin/videos', async (req: AuthedRequest, res) => {
  const body = adminVideoSchema.parse(req.body)
  const user = await adminOwnerUser()
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
  const liveRoom = await syncLiveRoomForVideo({
    videoId: video.id,
    title: video.title,
    coverUrl: video.coverUrl,
    videoUrl: video.videoUrl,
    ownerId: user.id,
    ownerName: user.nickname,
    ownerAvatar: user.avatarUrl,
    productIds: body.productIds,
    liveTitle: body.liveTitle || video.title,
    liveStatus: body.liveStatus,
    currentProductId: body.currentProductId,
  })
  ok(res, { ...video, liveRoom, liveRoomId: liveRoom.id })
})
app.patch('/api/admin/videos/:id', async (req: AuthedRequest, res) => {
  const body = adminVideoSchema.parse(req.body)
  const videoId = param(req, 'id')
  const [user, existing] = await Promise.all([
    adminOwnerUser(),
    prisma.video.findUnique({ where: { id: videoId } }),
  ])
  if (!user) return fail(res, '用户不存在', 40401, 404)
  if (!existing || existing.userId !== user.id) return fail(res, '视频不存在', 40401, 404)
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
  const liveRoom = await syncLiveRoomForVideo({
    videoId: video.id,
    oldVideoUrl: existing.videoUrl,
    title: video.title,
    coverUrl: video.coverUrl,
    videoUrl: video.videoUrl,
    ownerId: user.id,
    ownerName: user.nickname,
    ownerAvatar: user.avatarUrl,
    productIds: body.productIds,
    liveTitle: body.liveTitle || video.title,
    liveStatus: body.liveStatus,
    currentProductId: body.currentProductId,
  })
  ok(res, { ...video, liveRoom, liveRoomId: liveRoom.id })
})
app.patch('/api/admin/videos/:id/status', async (req, res) => {
  const owner = await adminOwnerUser()
  const body = z.object({ status: z.enum(['DRAFT', 'PUBLISHED', 'OFFLINE']) }).parse(req.body)
  const existing = await prisma.video.findFirst({ where: { id: param(req, 'id'), userId: owner.id } })
  if (!existing) return fail(res, '视频不存在', 40401, 404)
  ok(res, await prisma.video.update({ where: { id: existing.id }, data: { status: body.status } }))
})
app.post('/api/admin/videos/:id/products', async (req, res) => {
  const owner = await adminOwnerUser()
  const body = z.object({ productIds: z.array(z.string()) }).parse(req.body)
  const videoId = param(req, 'id')
  const video = await prisma.video.findFirst({ where: { id: videoId, userId: owner.id } })
  if (!video) return fail(res, '视频不存在', 40401, 404)
  await replaceVideoProducts(videoId, body.productIds)
  const room = await prisma.liveRoom.findFirst({ where: { OR: [{ videoId: video.id }, { videoUrl: video.videoUrl }] } })
  if (room) {
    await prisma.liveRoomProduct.deleteMany({ where: { liveRoomId: room.id } })
    const productIds = uniqueIds(body.productIds)
    if (productIds.length) {
      await prisma.liveRoomProduct.createMany({ data: productIds.map((productId, sort) => ({ liveRoomId: room.id, productId, sort })) })
    }
    const currentProductId = currentProductForRoom(productIds, room.currentProductId)
    await prisma.liveRoom.update({ where: { id: room.id }, data: { currentProductId } })
    const product = currentProductId ? await prisma.product.findUnique({ where: { id: currentProductId } }) : null
    req.app.get('liveIo')?.to(room.id).emit('live:current-product:update', { liveRoomId: room.id, product })
  }
  ok(res, true)
})

const adminLiveRoomSchema = z.object({
  title: z.string().trim().min(2, '直播标题至少需要 2 个字'),
  coverUrl: z.string().trim().url('请先上传直播封面'),
  videoUrl: z.string().trim().url('请先上传模拟直播视频').optional().nullable(),
  anchorName: z.string().trim().min(1, '请输入主播名称'),
  anchorAvatar: z.string().trim().url('主播头像地址格式不正确').optional().nullable(),
  status: liveRoomStatusSchema.default('NOT_STARTED'),
  productIds: z.array(z.string()).default([]),
  currentProductId: z.string().optional().nullable(),
})

function currentProductForRoom(productIds: string[], currentProductId?: string | null) {
  const ids = uniqueIds(productIds)
  if (currentProductId && ids.includes(currentProductId)) return currentProductId
  return ids[0] || null
}

app.get('/api/admin/live-rooms', async (_req, res) => {
  const owner = await adminOwnerUser()
  ok(res, await prisma.liveRoom.findMany({
    where: { anchorUserId: owner.id },
    include: { products: { include: { product: true }, orderBy: { sort: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  }))
})
app.post('/api/admin/live-rooms', async (req: AuthedRequest, res) => {
  const owner = await adminOwnerUser()
  const body = adminLiveRoomSchema.parse(req.body)
  const { productIds, currentProductId, ...roomData } = body
  const linkedProductIds = uniqueIds(productIds)
  const room = await prisma.$transaction(async (tx) => {
    const created = await tx.liveRoom.create({
      data: {
        ...roomData,
        videoUrl: roomData.videoUrl || null,
        anchorAvatar: roomData.anchorAvatar || null,
        anchorUserId: owner.id,
        currentProductId: currentProductForRoom(linkedProductIds, currentProductId),
      },
    })
    if (linkedProductIds.length) {
      await tx.liveRoomProduct.createMany({ data: linkedProductIds.map((productId, sort) => ({ liveRoomId: created.id, productId, sort })) })
    }
    return created
  })
  ok(res, room)
})
app.patch('/api/admin/live-rooms/:id', async (req: AuthedRequest, res) => {
  const owner = await adminOwnerUser()
  const body = adminLiveRoomSchema.parse(req.body)
  const liveRoomId = param(req, 'id')
  const existing = await prisma.liveRoom.findFirst({ where: { id: liveRoomId, anchorUserId: owner.id } })
  if (!existing) return fail(res, '直播间不存在', 40401, 404)
  const { productIds, currentProductId, ...roomData } = body
  const linkedProductIds = uniqueIds(productIds)
  const room = await prisma.$transaction(async (tx) => {
    const updated = await tx.liveRoom.update({
      where: { id: liveRoomId },
      data: {
        ...roomData,
        videoUrl: roomData.videoUrl || null,
        anchorAvatar: roomData.anchorAvatar || null,
        anchorUserId: owner.id,
        currentProductId: currentProductForRoom(linkedProductIds, currentProductId),
      },
    })
    await tx.liveRoomProduct.deleteMany({ where: { liveRoomId } })
    if (linkedProductIds.length) {
      await tx.liveRoomProduct.createMany({ data: linkedProductIds.map((productId, sort) => ({ liveRoomId, productId, sort })) })
    }
    return updated
  })
  const product = room.currentProductId ? await prisma.product.findUnique({ where: { id: room.currentProductId } }) : null
  req.app.get('liveIo')?.to(liveRoomId).emit('live:current-product:update', { liveRoomId, product })
  ok(res, room)
})
app.post('/api/admin/live-rooms/:id/products', async (req, res) => {
  const owner = await adminOwnerUser()
  const body = z.object({ productIds: z.array(z.string()) }).parse(req.body)
  const liveRoomId = param(req, 'id')
  const productIds = uniqueIds(body.productIds)
  const room = await prisma.$transaction(async (tx) => {
    const existing = await tx.liveRoom.findFirst({ where: { id: liveRoomId, anchorUserId: owner.id } })
    if (!existing) throw new Error('直播间不存在')
    await tx.liveRoomProduct.deleteMany({ where: { liveRoomId } })
    if (productIds.length) {
      await tx.liveRoomProduct.createMany({ data: productIds.map((productId, sort) => ({ liveRoomId, productId, sort })) })
    }
    return tx.liveRoom.update({ where: { id: liveRoomId }, data: { currentProductId: currentProductForRoom(productIds, existing?.currentProductId) } })
  })
  const product = room.currentProductId ? await prisma.product.findUnique({ where: { id: room.currentProductId } }) : null
  req.app.get('liveIo')?.to(liveRoomId).emit('live:current-product:update', { liveRoomId, product })
  ok(res, true)
})
app.patch('/api/admin/live-rooms/:id/current-product', async (req, res) => {
  const owner = await adminOwnerUser()
  const liveRoomId = param(req, 'id')
  const body = z.object({ productId: z.string() }).parse(req.body)
  const existing = await prisma.liveRoom.findFirst({ where: { id: liveRoomId, anchorUserId: owner.id } })
  if (!existing) return fail(res, '直播间不存在', 40401, 404)
  const linked = await prisma.liveRoomProduct.findFirst({ where: { liveRoomId, productId: body.productId } })
  if (!linked) return fail(res, '请先将商品绑定到直播间')
  const room = await prisma.liveRoom.update({ where: { id: liveRoomId }, data: { currentProductId: body.productId } })
  const product = await prisma.product.findUnique({ where: { id: body.productId } })
  req.app.get('liveIo')?.to(liveRoomId).emit('live:current-product:update', { liveRoomId, product })
  ok(res, room)
})
const marketingRuleSchema = z.object({
  type: z.enum(['COUPON', 'DISCOUNT', 'FULL_REDUCTION', 'SECKILL']),
  title: z.string().trim().min(1),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  productId: z.string().optional().nullable(),
  amount: z.number().int().nonnegative().optional().nullable(),
  minAmount: z.number().int().nonnegative().optional().nullable(),
  discountPercent: z.number().int().min(1).max(100).optional().nullable(),
  countdownSeconds: z.number().int().positive().optional().nullable(),
})

app.get('/api/admin/live-rooms/:id/marketing-rules', async (req, res) => {
  const owner = await adminOwnerUser()
  const liveRoomId = param(req, 'id')
  const existing = await prisma.liveRoom.findFirst({ where: { id: liveRoomId, anchorUserId: owner.id } })
  if (!existing) return fail(res, '直播间不存在', 40401, 404)
  ok(res, await marketingRulesForRoom(liveRoomId))
})

app.post('/api/admin/live-rooms/:id/marketing-rules', async (req, res) => {
  const owner = await adminOwnerUser()
  const liveRoomId = param(req, 'id')
  const body = z.object({ rules: z.array(marketingRuleSchema).default([]) }).parse(req.body)
  const existing = await prisma.liveRoom.findFirst({ where: { id: liveRoomId, anchorUserId: owner.id } })
  if (!existing) return fail(res, '直播间不存在', 40401, 404)
  await prisma.marketingRule.deleteMany({ where: { liveRoomId } })
  if (body.rules.length) {
    await prisma.marketingRule.createMany({
      data: body.rules.map((rule) => ({
        liveRoomId,
        type: rule.type,
        title: rule.title,
        status: rule.status,
        productId: rule.productId || null,
        amount: rule.amount ?? null,
        minAmount: rule.minAmount ?? null,
        discountPercent: rule.discountPercent ?? null,
        countdownSeconds: rule.countdownSeconds ?? null,
        startsAt: null,
        endsAt: null,
      })),
    })
  }
  const rules = await marketingRulesForRoom(liveRoomId)
  req.app.get('liveIo')?.to(liveRoomId).emit('live:marketing:update', { liveRoomId, rules })
  ok(res, rules)
})

app.post('/api/admin/live-rooms/:id/push-coupon', async (req, res) => {
  const coupon = await prisma.marketingRule.findFirst({ where: { liveRoomId: param(req, 'id'), type: 'COUPON', status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } })
  req.app.get('liveIo')?.to(param(req, 'id')).emit('live:coupon:push', { liveRoomId: param(req, 'id'), coupon })
  ok(res, coupon)
})

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof z.ZodError) return fail(res, err.issues[0]?.message || '请求参数错误', 40000, 400)
  const message = err instanceof Error ? err.message : '服务器异常'
  fail(res, message, 50001, 500)
})
