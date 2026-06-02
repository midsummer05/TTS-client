# 移动端直播/短视频带货购物系统

基于 React Native + Expo、React + Vite、Node.js + Express + Prisma + SQLite + Socket.IO 的内容电商 MVP。

## 功能模块

- 移动端：短视频内容流、商品浮层、商品详情半屏弹窗、购物车、订单确认、模拟支付、订单列表、直播间。
- 后端：商品、视频、直播间、购物车、订单、评论、后台管理接口、Socket.IO 直播事件、AIGC 智能文案生成。
- 运营后台：数据看板、商品管理、视频管理、直播间管理、当前讲解商品切换和优惠券推送、AI 一键生成文案。

## 本地启动

```bash
# ===== 初次环境配置 =====
npm install                  # 安装所有依赖
npm run prisma:migrate       # 创建 SQLite 数据库 & 生成 Prisma Client
npm run seed                 # 填充测试种子数据

# ===== 启动服务（需在三个终端分别运行） =====
npm run dev:server           # 后端 API
npm run dev:admin            # 运营后台
npm run dev:mobile           # 移动端 App
```

如果使用 pnpm（monorepo 原生支持）：

```bash
# ===== 初次环境配置 =====
pnpm install                                      # 安装所有依赖
pnpm --filter server prisma:migrate               # 创建 SQLite 数据库 & 生成 Prisma Client
pnpm --filter server seed                         # 填充测试种子数据

# ===== 启动服务（需在三个终端分别运行） =====
pnpm --filter server dev                          # 后端 API
pnpm --filter admin dev                           # 运营后台
pnpm --filter mobile start                        # 移动端 App
```

## 访问地址

- 后端 API：http://localhost:4000/api/health
- 运营后台：http://localhost:5173
- Expo 移动端：运行 `npm run dev:mobile` 后按终端提示预览

## 环境变量

在 `apps/server/.env` 中配置（首次启动前需要手动创建）：

```env
DATABASE_URL="file:./dev.db"           # SQLite 数据库路径
JWT_SECRET="dev-secret-change-in-production"  # JWT 签名密钥
PORT=4000                               # 后端端口

# AIGC 能力（可选，不配则 AI 功能不可用）
AI_API_KEY=sk-your-api-key-here         # AI 服务 API Key
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1  # OpenAI 兼容接口地址
AI_MODEL=qwen3.6-flash                      # 文本模型（标题/卖点/讲解文案）
AI_VISION_MODEL=qwen3-vl-flash             # 多模态模型（商品图 → 推荐语）
```

## AIGC 能力

支持商家输入商品信息后，通过大模型自动生成营销文案，采用 **SSE 流式输出**，打字机效果实时展示。

### 生成场景

| 场景         | 入口                            | 输入                 | 输出                     |
| ------------ | ------------------------------- | -------------------- | ------------------------ |
| 短视频标题   | 视频管理 → AI 生成标题          | 商品名称、描述、价格 | 5 个吸睛标题             |
| 商品卖点     | 商品管理 → 编辑 → AI 生成卖点   | 商品完整信息         | 3-5 条卖点文案           |
| 直播讲解文案 | 直播间管理 → AI 讲解文案        | 当前讲解商品信息     | 主播口播稿（200-300 字） |
| 商品推荐语   | 商品管理 → 编辑 → AI 生成推荐语 | 商品图片 + 描述      | 种草推荐文案（多模态）   |

### 技术实现

```
Admin 点击 AI 生成
    │
    ▼  POST /api/ai/generate/stream (SSE)
Server ──→ ai/prompts.ts  根据场景构造 Prompt
       ──→ ai/client.ts   调用 OpenAI 兼容 API（流式）
    │
    ▼  SSE 逐 token 返回
Admin AIGenerateModal ──→ 打字机效果实时展示
                        ──→ 一键填入表单 / 复制
```

- **后端**：`apps/server/src/ai/` 目录，包含 client（API 客户端）、prompts（Prompt 模板）、router（SSE 路由）
- **前端**：`apps/admin/src/main.tsx` 中的 `AIGenerateModal` 组件
- **推荐语**使用多模态模型（`AI_VISION_MODEL`），同时传入商品图和描述
- 其余 3 个场景使用纯文本模型（`AI_MODEL`）

## 文档

- API 文档：[docs/api.md](docs/api.md)
- 数据库设计：[docs/db.md](docs/db.md)
- WebSocket 事件：[docs/socket-events.md](docs/socket-events.md)
