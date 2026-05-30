# 移动端直播/短视频带货购物系统

基于 React Native + Expo、React + Vite、Node.js + Express + Prisma + SQLite + Socket.IO 的内容电商 MVP。

## 功能模块

- 移动端：短视频内容流、商品浮层、商品详情半屏弹窗、购物车、订单确认、模拟支付、订单列表、直播间。
- 后端：商品、视频、直播间、购物车、订单、评论、后台管理接口、Socket.IO 直播事件。
- 运营后台：数据看板、商品管理、视频管理、直播间管理、当前讲解商品切换和优惠券推送。

## 本地启动

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
- 运营后台：http://localhost:5173
- Expo 移动端：运行 `npm run dev:mobile` 后按终端提示预览。

## 文档

- API 文档：[docs/api.md](docs/api.md)
- 数据库设计：[docs/db.md](docs/db.md)
- WebSocket 事件：[docs/socket-events.md](docs/socket-events.md)
