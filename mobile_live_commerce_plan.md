# 移动端直播/短视频带货购物系统 - 可落地实现方案

> 面向编程 Agent 的项目实现说明书  
> 推荐技术栈：React Native + Expo + TypeScript + Node.js + Express + Prisma + SQLite + Socket.IO  
> 项目目标：实现一个围绕“内容种草 → 商品转化 → 加购/下单 → 订单查看”的移动端直播/短视频带货购物闭环系统。

---

## 1. 项目定位

本项目不是普通电商列表项目，而是一个以移动端内容流为核心入口的内容电商系统。

核心链路：

```text
用户进入短视频/直播内容流
  ↓
上下滑浏览内容
  ↓
观看商品讲解
  ↓
点击视频上的商品浮层卡片
  ↓
打开商品详情半屏弹窗
  ↓
领取优惠 / 加入购物车 / 立即购买
  ↓
提交订单
  ↓
模拟支付
  ↓
查看订单状态
```

项目需要突出以下能力：

```text
1. 原生移动端体验
2. 视频播放与上下滑内容流
3. 商品浮层与半屏详情弹窗
4. 实时互动：弹幕、评论、在线人数、当前讲解商品
5. 购物车、订单、模拟支付完整闭环
6. 后台商品、视频、直播间管理
7. 弱网、加载、错误、空状态等客户端体验处理
```

---

## 2. 技术选型

### 2.1 移动用户端

```text
React Native + Expo + TypeScript
Expo Router：移动端页面路由
Zustand：客户端状态管理
TanStack Query：接口请求缓存和异步状态管理
Axios：HTTP 请求
Socket.IO Client：实时通信
expo-av 或 expo-video：视频播放
React Native Reanimated：底部弹窗、滑动、动效
React Native Gesture Handler：上下滑、手势交互
React Native MMKV / AsyncStorage：本地缓存
```

说明：

```text
选择 React Native + Expo，而不是 H5。
原因是：
1. 更接近真实移动客户端开发；
2. 可以体现视频播放、手势、弱网、原生体验优化；
3. Expo 可以降低原生环境配置复杂度；
4. TypeScript 方便和后端共享类型。
```

### 2.2 运营后台

为了减少复杂度，运营后台可以使用 Web 技术实现：

```text
React + Vite + TypeScript
Ant Design
ECharts
Axios
TanStack Query
```

后台不是项目重点，但需要能管理商品、视频、直播间，并驱动用户端实时状态变化。

### 2.3 后端服务

```text
Node.js
Express
TypeScript
Prisma ORM
SQLite
Socket.IO
JWT
Zod
```

说明：

```text
SQLite 适合课程项目、演示项目和本地开发，不需要额外部署数据库。
Prisma 用来管理数据模型、迁移和类型安全查询。
Socket.IO 用来实现直播间实时评论、弹幕、在线人数、当前讲解商品、优惠券推送等能力。
```

---

## 3. 单仓库目录结构

建议使用 pnpm workspace 管理。

```text
live-commerce-mobile/
├── apps/
│   ├── mobile/                 # React Native + Expo 用户端
│   ├── admin/                  # React + Vite 运营后台
│   └── server/                 # Node.js + Express 后端
│
├── packages/
│   └── shared/                 # 共享类型、常量、工具函数
│
├── docs/
│   ├── api.md                  # 接口文档
│   ├── db.md                   # 数据库设计
│   └── socket-events.md        # WebSocket 事件文档
│
├── package.json
├── pnpm-workspace.yaml
├── README.md
├── .gitignore
├── .prettierrc
└── eslint.config.js
```

---

## 4. 移动端页面规划

### 4.1 页面路由

```text
apps/mobile/app/
├── _layout.tsx
├── index.tsx                         # 首页，重定向到内容流
├── feed/
│   └── index.tsx                     # 短视频/直播内容流
├── live/
│   └── [id].tsx                      # 直播间详情
├── product/
│   └── [id].tsx                      # 商品详情页，可选
├── cart/
│   └── index.tsx                     # 购物车
├── order/
│   ├── confirm.tsx                   # 订单确认
│   ├── result.tsx                    # 支付结果
│   ├── index.tsx                     # 订单列表
│   └── [id].tsx                      # 订单详情
├── profile/
│   └── index.tsx                     # 我的
└── login.tsx                         # 简化登录
```

### 4.2 主要页面说明

#### 内容流页面 FeedScreen

核心功能：

```text
1. 全屏展示短视频或直播内容
2. 支持上下滑切换
3. 当前视频自动播放，离开屏幕后暂停
4. 右侧展示点赞、评论、收藏、分享按钮
5. 底部展示作者、标题、商品入口
6. 视频区域悬浮商品卡
7. 点击商品卡弹出商品详情半屏浮层
8. 直播内容支持实时弹幕、在线人数、当前讲解商品
```

实现建议：

```text
1. 使用 FlatList 或 FlashList 做竖向分页列表；
2. pagingEnabled 开启整屏滑动；
3. onViewableItemsChanged 判断当前可见 item；
4. 当前 item 播放视频，前后相邻 item 可预加载；
5. 离开屏幕的视频必须 pause/unload，避免内存占用过高；
6. 列表每页请求 5-10 条内容，避免一次性加载过多。
```

#### 商品半屏浮层 ProductSheet

核心功能：

```text
1. 展示商品图、标题、价格、原价、优惠、库存、销量
2. 支持规格选择
3. 支持领取优惠券
4. 支持加入购物车
5. 支持立即购买
6. 库存不足时禁用购买按钮
```

交互要求：

```text
1. 从底部弹出，覆盖屏幕 60%-80%；
2. 背景视频保留但变暗；
3. 点击遮罩关闭；
4. 规格未选择时点击购买，需要 Toast 提示；
5. 加购成功后给出明确反馈。
```

#### 购物车页面 CartScreen

核心功能：

```text
1. 展示购物车商品列表
2. 支持单选、全选
3. 支持数量加减
4. 支持删除商品
5. 实时计算商品总价、优惠、实付金额
6. 点击结算进入订单确认页
```

#### 订单确认页 OrderConfirmScreen

核心功能：

```text
1. 展示收货地址
2. 展示待结算商品
3. 展示商品金额、优惠金额、运费、实付金额
4. 提交订单
5. 后端校验库存和价格
6. 创建订单后进入模拟支付页
```

#### 支付结果页 PayResultScreen

核心功能：

```text
1. 模拟支付中 loading
2. 支付成功展示成功结果
3. 支付失败展示失败原因和重试按钮
4. 成功后可跳转订单详情
```

#### 订单列表页 OrderListScreen

核心功能：

```text
1. 支持订单状态筛选
2. 状态包括：待支付、待发货、已完成、已取消
3. 展示订单商品、金额、状态、操作按钮
```

---

## 5. 移动端组件拆分

```text
apps/mobile/src/
├── components/
│   ├── VideoPlayer.tsx               # 视频播放组件
│   ├── FeedItem.tsx                  # 单个内容流 item
│   ├── ProductFloatCard.tsx          # 视频浮层商品卡
│   ├── ProductSheet.tsx              # 商品详情半屏弹窗
│   ├── LiveCommentList.tsx           # 实时评论/弹幕列表
│   ├── LikeButton.tsx                # 点赞按钮
│   ├── EmptyState.tsx                # 空状态
│   ├── ErrorState.tsx                # 错误状态
│   ├── LoadingView.tsx               # 加载状态
│   └── PriceText.tsx                 # 价格展示
│
├── api/
│   ├── request.ts                    # Axios 实例
│   ├── video.ts
│   ├── product.ts
│   ├── cart.ts
│   ├── order.ts
│   └── live.ts
│
├── store/
│   ├── userStore.ts
│   ├── cartStore.ts
│   └── liveStore.ts
│
├── socket/
│   └── liveSocket.ts
│
├── types/
│   └── index.ts
│
├── hooks/
│   ├── useFeed.ts
│   ├── useProductSheet.ts
│   ├── useLiveRoomSocket.ts
│   └── useNetworkStatus.ts
│
└── utils/
    ├── formatPrice.ts
    ├── throttle.ts
    └── errorMessage.ts
```

---

## 6. 运营后台页面规划

```text
apps/admin/src/pages/
├── Dashboard.tsx                     # 数据看板
├── ProductList.tsx                   # 商品列表
├── ProductEdit.tsx                   # 新增/编辑商品
├── VideoList.tsx                     # 视频列表
├── VideoEdit.tsx                     # 新增/编辑视频
├── LiveRoomList.tsx                  # 直播间列表
├── LiveRoomEdit.tsx                  # 直播间配置
└── Login.tsx
```

后台核心能力：

```text
1. 商品列表、新增、编辑、上下架
2. 视频列表、新增、编辑、发布、下架
3. 给视频绑定商品
4. 创建模拟直播间
5. 给直播间绑定商品
6. 设置当前讲解商品
7. 推送优惠券
8. 查看简单运营数据
```

---

## 7. 后端目录结构

```text
apps/server/src/
├── app.ts
├── server.ts
├── config/
│   └── env.ts
├── prisma/
│   └── prisma.service.ts
├── modules/
│   ├── auth/
│   ├── user/
│   ├── video/
│   ├── product/
│   ├── cart/
│   ├── order/
│   ├── comment/
│   ├── coupon/
│   ├── live/
│   └── admin/
├── socket/
│   ├── socket.server.ts
│   └── live.socket.ts
├── middlewares/
│   ├── auth.middleware.ts
│   └── error.middleware.ts
├── utils/
│   ├── generateOrderNo.ts
│   └── response.ts
└── seed/
    └── seed.ts
```

---

## 8. 数据库模型设计

使用 Prisma + SQLite。

### 8.1 User

```prisma
model User {
  id        String   @id @default(cuid())
  nickname  String
  avatarUrl String?
  phone     String?  @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  cartItems CartItem[]
  orders    Order[]
  comments  Comment[]
}
```

### 8.2 Product

```prisma
model Product {
  id          String        @id @default(cuid())
  title       String
  coverUrl    String
  price       Int           // 单位：分
  originPrice Int?
  stock       Int
  sales       Int           @default(0)
  status      ProductStatus @default(ON_SALE)
  category    String?
  tags        String?       // JSON 字符串，简化处理
  description String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  videoLinks  VideoProduct[]
  liveLinks   LiveRoomProduct[]
  cartItems   CartItem[]
  orderItems  OrderItem[]
}
```

### 8.3 Video

```prisma
model Video {
  id          String      @id @default(cuid())
  title       String
  coverUrl    String
  videoUrl    String
  authorName  String
  authorAvatar String?
  status      VideoStatus @default(DRAFT)
  playCount   Int         @default(0)
  likeCount   Int         @default(0)
  commentCount Int        @default(0)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  products    VideoProduct[]
  comments    Comment[]
}
```

### 8.4 VideoProduct

```prisma
model VideoProduct {
  id        String  @id @default(cuid())
  videoId   String
  productId String
  sort      Int     @default(0)
  startTime Int?    // 商品讲解开始时间，单位秒

  video     Video   @relation(fields: [videoId], references: [id])
  product   Product @relation(fields: [productId], references: [id])

  @@unique([videoId, productId])
}
```

### 8.5 LiveRoom

```prisma
model LiveRoom {
  id               String         @id @default(cuid())
  title            String
  coverUrl          String
  anchorName        String
  anchorAvatar      String?
  status            LiveRoomStatus @default(NOT_STARTED)
  onlineCount       Int            @default(0)
  heat              Int            @default(0)
  currentProductId  String?
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  products          LiveRoomProduct[]
  comments          Comment[]
}
```

### 8.6 LiveRoomProduct

```prisma
model LiveRoomProduct {
  id         String   @id @default(cuid())
  liveRoomId String
  productId  String
  sort       Int      @default(0)

  liveRoom   LiveRoom @relation(fields: [liveRoomId], references: [id])
  product    Product  @relation(fields: [productId], references: [id])

  @@unique([liveRoomId, productId])
}
```

### 8.7 CartItem

```prisma
model CartItem {
  id        String   @id @default(cuid())
  userId    String
  productId String
  quantity  Int      @default(1)
  selected  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id])
  product   Product  @relation(fields: [productId], references: [id])

  @@unique([userId, productId])
}
```

### 8.8 Order

```prisma
model Order {
  id             String      @id @default(cuid())
  orderNo        String      @unique
  userId          String
  status          OrderStatus @default(PENDING_PAYMENT)
  totalAmount     Int
  discountAmount  Int         @default(0)
  payAmount       Int
  address         String
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  user            User        @relation(fields: [userId], references: [id])
  items           OrderItem[]
}
```

### 8.9 OrderItem

```prisma
model OrderItem {
  id        String  @id @default(cuid())
  orderId   String
  productId String
  title     String
  coverUrl  String
  price     Int
  quantity  Int

  order     Order   @relation(fields: [orderId], references: [id])
  product   Product @relation(fields: [productId], references: [id])
}
```

### 8.10 Comment

```prisma
model Comment {
  id         String   @id @default(cuid())
  userId     String
  videoId    String?
  liveRoomId String?
  content    String
  createdAt  DateTime @default(now())

  user       User      @relation(fields: [userId], references: [id])
  video      Video?    @relation(fields: [videoId], references: [id])
  liveRoom   LiveRoom? @relation(fields: [liveRoomId], references: [id])
}
```

### 8.11 Coupon

```prisma
model Coupon {
  id          String   @id @default(cuid())
  title       String
  amount      Int
  minAmount   Int      @default(0)
  status      CouponStatus @default(ACTIVE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 8.12 Enums

```prisma
enum ProductStatus {
  ON_SALE
  OFF_SALE
}

enum VideoStatus {
  DRAFT
  PUBLISHED
  OFFLINE
}

enum LiveRoomStatus {
  NOT_STARTED
  LIVING
  ENDED
}

enum OrderStatus {
  PENDING_PAYMENT
  PAID
  SHIPPED
  COMPLETED
  CANCELLED
}

enum CouponStatus {
  ACTIVE
  INACTIVE
}
```

---

## 9. RESTful API 设计

### 9.1 Auth

```text
POST /api/auth/mock-login
```

请求：

```json
{
  "nickname": "测试用户"
}
```

返回：

```json
{
  "token": "mock-jwt-token",
  "user": {
    "id": "user_id",
    "nickname": "测试用户"
  }
}
```

### 9.2 视频内容流

```text
GET /api/videos?page=1&pageSize=10
GET /api/videos/:id
POST /api/videos/:id/like
POST /api/videos/:id/favorite
GET /api/videos/:id/comments
POST /api/videos/:id/comments
```

### 9.3 商品

```text
GET /api/products?page=1&pageSize=20
GET /api/products/:id
GET /api/videos/:id/products
POST /api/products/:id/favorite
```

### 9.4 购物车

```text
GET /api/cart
POST /api/cart
PATCH /api/cart/:cartItemId
DELETE /api/cart/:cartItemId
PATCH /api/cart/:cartItemId/selected
PATCH /api/cart/select-all
```

POST /api/cart 请求：

```json
{
  "productId": "product_id",
  "quantity": 1
}
```

PATCH /api/cart/:cartItemId 请求：

```json
{
  "quantity": 2
}
```

### 9.5 订单

```text
POST /api/orders
GET /api/orders?status=PENDING_PAYMENT
GET /api/orders/:id
POST /api/orders/:id/pay
POST /api/orders/:id/cancel
```

POST /api/orders 请求：

```json
{
  "source": "cart",
  "cartItemIds": ["cart_item_id_1", "cart_item_id_2"],
  "address": "北京市朝阳区测试地址",
  "couponId": "coupon_id"
}
```

也支持立即购买：

```json
{
  "source": "buyNow",
  "productId": "product_id",
  "quantity": 1,
  "address": "北京市朝阳区测试地址",
  "couponId": "coupon_id"
}
```

### 9.6 直播间

```text
GET /api/live-rooms
GET /api/live-rooms/:id
GET /api/live-rooms/:id/products
GET /api/live-rooms/:id/comments
POST /api/live-rooms/:id/comments
```

### 9.7 后台接口

```text
GET /api/admin/products
POST /api/admin/products
PATCH /api/admin/products/:id
PATCH /api/admin/products/:id/status

GET /api/admin/videos
POST /api/admin/videos
PATCH /api/admin/videos/:id
PATCH /api/admin/videos/:id/status
POST /api/admin/videos/:id/products

GET /api/admin/live-rooms
POST /api/admin/live-rooms
PATCH /api/admin/live-rooms/:id
POST /api/admin/live-rooms/:id/products
PATCH /api/admin/live-rooms/:id/current-product
POST /api/admin/live-rooms/:id/push-coupon

GET /api/admin/dashboard/overview
GET /api/admin/dashboard/funnel
GET /api/admin/dashboard/gmv-ranking
```

---

## 10. WebSocket 事件设计

命名空间：

```text
/live
```

### 10.1 用户端发送事件

#### 加入直播间

```text
live:join
```

Payload：

```json
{
  "liveRoomId": "live_room_id",
  "userId": "user_id"
}
```

#### 离开直播间

```text
live:leave
```

Payload：

```json
{
  "liveRoomId": "live_room_id",
  "userId": "user_id"
}
```

#### 发送评论/弹幕

```text
live:comment:send
```

Payload：

```json
{
  "liveRoomId": "live_room_id",
  "userId": "user_id",
  "content": "这个价格可以"
}
```

#### 点赞直播间

```text
live:like
```

Payload：

```json
{
  "liveRoomId": "live_room_id",
  "userId": "user_id"
}
```

### 10.2 用户端接收事件

#### 新评论

```text
live:comment:new
```

Payload：

```json
{
  "id": "comment_id",
  "liveRoomId": "live_room_id",
  "user": {
    "id": "user_id",
    "nickname": "用户A"
  },
  "content": "这个价格可以",
  "createdAt": "2026-05-24T12:00:00.000Z"
}
```

#### 在线人数变化

```text
live:online:update
```

Payload：

```json
{
  "liveRoomId": "live_room_id",
  "onlineCount": 1280,
  "heat": 9520
}
```

#### 当前讲解商品变化

```text
live:current-product:update
```

Payload：

```json
{
  "liveRoomId": "live_room_id",
  "product": {
    "id": "product_id",
    "title": "轻薄长续航手机",
    "coverUrl": "https://example.com/product.png",
    "price": 199900,
    "stock": 80
  }
}
```

#### 优惠券推送

```text
live:coupon:push
```

Payload：

```json
{
  "liveRoomId": "live_room_id",
  "coupon": {
    "id": "coupon_id",
    "title": "直播间专享 30 元券",
    "amount": 3000,
    "minAmount": 19900
  }
}
```

#### 库存变化

```text
product:stock:update
```

Payload：

```json
{
  "productId": "product_id",
  "stock": 76
}
```

---

## 11. 客户端性能与弱网要求

### 11.1 视频内容流优化

必须实现：

```text
1. 内容分页加载；
2. 当前视频播放，非当前视频暂停；
3. 只保留当前视频和前后相邻视频的资源；
4. 切换视频时显示封面图或 loading；
5. 视频加载失败时显示重试按钮；
6. 接口失败时显示错误状态；
7. 下拉刷新和上拉加载更多。
```

建议实现：

```text
1. 相邻视频预加载；
2. 对 FeedItem 使用 memo，减少重复渲染；
3. 商品卡、点赞按钮等组件拆分并缓存；
4. 请求结果使用 TanStack Query 缓存；
5. 长列表使用 FlashList 替代普通 FlatList。
```

### 11.2 弱网体验

要求：

```text
1. 接口 loading 状态明确；
2. 请求失败有 Toast 或错误页；
3. 支持重试；
4. 下单失败不能直接跳成功页；
5. WebSocket 断线后自动重连；
6. 重连后重新加入直播间 room；
7. 本地缓存用户 token 和基础信息。
```

### 11.3 移动端适配

要求：

```text
1. 使用 SafeAreaView 处理刘海屏和底部安全区；
2. 底部按钮不能贴边；
3. 小屏手机商品弹窗高度不能超过屏幕；
4. 商品卡不能遮挡核心视频内容；
5. 右侧操作栏点击区域至少 44px；
6. 评论输入框弹出键盘时不能遮挡发送按钮。
```

---

## 12. Mock 数据建议

初始 seed 数据：

```text
用户：3 个
商品：20 个
视频：10 个
直播间：2 个
评论：50 条
订单：5 个
优惠券：5 个
```

视频素材：

```text
可以先使用本地测试视频或公开视频 URL。
每个视频绑定 1-3 个商品。
直播间绑定 5-10 个商品。
```

商品类目建议：

```text
手机数码
美妆个护
食品饮料
家居生活
服饰配件
```

---

## 13. 开发顺序

### 第一阶段：项目基础

```text
1. 初始化 monorepo
2. 初始化 apps/mobile
3. 初始化 apps/admin
4. 初始化 apps/server
5. 配置 ESLint、Prettier、TypeScript
6. 配置 Prisma + SQLite
7. 编写 seed 数据
```

验收标准：

```text
1. 三个应用可以分别启动；
2. 后端可以连接数据库；
3. seed 后数据库里有商品、视频、直播间数据；
4. 移动端可以请求到视频列表。
```

### 第二阶段：用户端主链路

```text
1. 内容流页面
2. 视频播放
3. 商品浮层卡
4. 商品半屏详情
5. 加入购物车
6. 购物车页面
7. 订单确认页
8. 模拟支付
9. 订单列表和订单详情
```

验收标准：

```text
用户可以从视频内容流进入商品，完成加购、下单、支付成功、查看订单。
```

### 第三阶段：直播实时能力

```text
1. Socket.IO 服务端
2. 用户端加入直播间
3. 实时评论/弹幕
4. 在线人数模拟
5. 后台切换当前讲解商品
6. 用户端实时更新商品浮层
7. 后台推送优惠券
```

验收标准：

```text
后台切换当前讲解商品后，用户端不刷新页面即可看到商品浮层变化。
```

### 第四阶段：运营后台

```text
1. 商品管理
2. 视频管理
3. 视频绑定商品
4. 直播间管理
5. 直播间绑定商品
6. 设置当前讲解商品
7. 简单数据看板
```

验收标准：

```text
后台配置的数据可以真实影响用户端展示。
```

### 第五阶段：优化和加分项

```text
1. 视频预加载
2. 弱网重试
3. 骨架屏
4. 运营数据看板
5. 转化漏斗
6. 猜你喜欢推荐
7. 优惠券
8. AIGC 商品文案生成，可选
```

---

## 14. 编程 Agent 执行要求

请编程 Agent 按以下原则实现：

```text
1. 优先保证主链路完整，不要一开始追求 UI 精美；
2. 所有接口先用真实后端，不要只在前端写死 mock；
3. 数据库使用 Prisma + SQLite；
4. 所有金额字段统一使用“分”为单位；
5. 所有接口返回统一格式；
6. 所有页面必须有 loading、empty、error 三种状态；
7. 用户端重点实现移动端交互，而不是 Web 样式；
8. 后台只需要清晰可用，不要求复杂权限系统；
9. WebSocket 事件必须单独封装，不要散落在页面里；
10. 下单逻辑必须在后端校验库存和价格。
```

统一响应格式：

```ts
type ApiResponse<T> = {
  code: number
  message: string
  data: T
}
```

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

失败：

```json
{
  "code": 40001,
  "message": "库存不足",
  "data": null
}
```

---

## 15. README 需要包含的内容

```text
1. 项目介绍
2. 技术栈
3. 功能模块
4. 本地启动方式
5. 数据库初始化方式
6. 移动端预览方式
7. 后台访问方式
8. API 文档位置
9. WebSocket 事件说明
10. 项目亮点
```

示例启动命令：

```bash
pnpm install

pnpm --filter server dev
pnpm --filter mobile start
pnpm --filter admin dev
```

数据库初始化：

```bash
cd apps/server
pnpm prisma migrate dev
pnpm seed
```

---

## 16. 简历/答辩可包装亮点

```text
1. 基于 React Native + Expo 实现移动端短视频/直播带货购物系统，完成从内容浏览、商品浮层、加购、下单、模拟支付到订单查看的完整业务闭环。

2. 基于 Socket.IO 实现直播间实时互动能力，支持弹幕评论、在线人数、当前讲解商品和优惠券推送，保证商家后台状态可以实时同步到用户端。

3. 针对移动端视频内容流进行性能优化，通过分页加载、当前视频播放控制、相邻视频预加载和资源释放，降低长列表滑动卡顿和视频切换白屏问题。

4. 使用 Node.js + TypeScript + Prisma 设计商品、视频、直播间、购物车、订单等核心数据模型，并通过 RESTful API 提供稳定的业务服务。

5. 实现运营后台商品管理、视频管理、直播间配置和数据看板，使用户端、商家端和后端形成完整联动。
```

---

## 17. 最小可交付版本 MVP

如果时间有限，至少完成以下内容：

```text
1. 移动端内容流
2. 视频播放
3. 商品浮层
4. 商品半屏详情
5. 加入购物车
6. 购物车结算
7. 创建订单
8. 模拟支付
9. 订单列表
10. 后台商品管理
11. 后台视频绑定商品
12. WebSocket 当前讲解商品同步
```

这个 MVP 已经足够体现课题核心价值。
