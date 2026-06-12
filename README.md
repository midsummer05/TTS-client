# 移动端直播/短视频带货购物系统

基于 React Native + Expo、React + Vite、Node.js + Express + Prisma + SQLite + Socket.IO 的内容电商 MVP。

## 功能模块

- 移动端：短视频内容流、商品浮层、商品详情半屏弹窗、购物车、订单确认、模拟支付、订单列表、直播间。
- 后端：商品、视频、直播间、购物车、订单、评论、后台管理接口、Socket.IO 直播事件。
- 运营后台：数据看板、商品管理、视频管理、直播间管理、当前讲解商品切换和优惠券推送。

## 本地启动

先准备后端环境变量：

```bash
cp apps/server/.env.example apps/server/.env
```

然后在 `apps/server/.env` 中填写本机配置。腾讯云 COS 的真实密钥只允许保存在本地 `.env`，不要提交到仓库：

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-me-in-local-env"
PORT=4000

TENCENT_SECRET_ID=""
TENCENT_SECRET_KEY=""
TENCENT_COS_BUCKET="tts-1441040031"
TENCENT_COS_REGION="ap-guangzhou"
TENCENT_COS_PREFIX="直播素材/后台上传/"
AI_API_KEY=""
```

仓库中只提交脱敏后的 `apps/server/.env.example`。`.gitignore` 已忽略 `apps/**/.env`，避免误提交真实密钥。

```bash
npm install
npm run prisma:migrate
npm run seed
npm run dev:server
npm run dev:admin
npm run dev:mobile
```

如果使用 pnpm：

```bash
pnpm install
pnpm --filter server prisma:migrate
pnpm --filter server seed
pnpm --filter server dev
pnpm --filter admin dev
pnpm --filter mobile start
```

## 访问地址

- 后端 API：http://localhost:4000/api/health
- 运营后台：http://localhost:5173，使用移动端同一套手机号和密码登录。
- Expo 移动端：运行 `npm run dev:mobile` 后按终端提示预览。

## 腾讯云 COS

运营后台的内容管理支持选择本地视频上传。上传流程为：

```text
运营后台选择本地视频 -> 后端上传到腾讯云 COS -> 返回 HTTPS 视频地址 -> 保存短视频内容
```

后端会从 `apps/server/.env` 读取 COS 配置。请使用腾讯云 CAM 子账号并按最小权限授权，建议只给当前存储桶和上传目录必要的 `PutObject`、`GetObject`、`HeadObject`、`DeleteObject` 权限。

## 文档

- API 文档：[docs/api.md](docs/api.md)
- 数据库设计：[docs/db.md](docs/db.md)
- WebSocket 事件：[docs/socket-events.md](docs/socket-events.md)
