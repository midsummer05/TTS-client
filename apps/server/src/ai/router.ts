import type { Express, Request, Response } from 'express'
import { z } from 'zod'
import { aiClient, AI_MODEL, AI_VISION_MODEL } from './client.js'
import {
  buildMessages,
  buildVisionMessages,
  type GenerateType,
  type ProductInfo,
} from './prompts.js'
import { prisma } from '../prisma.js'
import { fail, ok } from '../utils/response.js'

const generateSchema = z.object({
  type: z.enum([
    'video_title',
    'selling_point',
    'live_script',
    'recommend_copy',
  ]),
  product: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    price: z.number().optional(),
    category: z.string().optional(),
    tags: z.string().optional(),
    coverUrl: z.string().optional(),
  }),
  extra: z
    .object({
      tone: z.string().optional(),
      length: z.string().optional(),
      keywords: z.string().optional(),
    })
    .optional(),
})

type GenerateBody = z.infer<typeof generateSchema>

const contentDraftSchema = z.object({
  productIds: z.array(z.string()).min(1, '请至少选择一个商品'),
  videoTitle: z.string().optional().nullable(),
  liveTitle: z.string().optional().nullable(),
})

function formatProductForDraft(product: {
  title: string
  description?: string | null
  price: number
  originPrice?: number | null
  category?: string | null
  tags?: string | null
  stock: number
  sales: number
}) {
  return [
    `商品名称：${product.title}`,
    `价格：¥${(product.price / 100).toFixed(2)}`,
    product.originPrice ? `原价：¥${(product.originPrice / 100).toFixed(2)}` : '',
    product.category ? `类目：${product.category}` : '',
    product.description ? `描述：${product.description}` : '',
    product.tags ? `标签：${product.tags}` : '',
    `库存：${product.stock}`,
    `销量：${product.sales}`,
  ].filter(Boolean).join('\n')
}

function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
  return JSON.parse(cleaned)
}

function fallbackDraft(text: string) {
  return {
    videoTitles: ['直播好物推荐', '今天这款值得看看', '真实体验好物分享'],
    sellingPoints: [text.slice(0, 120) || 'AI 已生成内容，请根据商品特点进一步编辑。'],
    recommendation: text,
    liveScript: text,
  }
}

async function createContentDraft(prompt: string, imageParts: Array<{ type: 'image_url'; image_url: { url: string; detail: 'auto' } }>) {
  const system = '你擅长电商内容运营、短视频种草和直播带货脚本生成。输出必须是可解析 JSON。'
  if (imageParts.length) {
    try {
      return await aiClient.chat.completions.create({
        model: AI_VISION_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: [{ type: 'text' as const, text: prompt }, ...imageParts] },
        ],
        temperature: 0.75,
        max_tokens: 1800,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (!/Unexpected item type|invalid.*content|vision|image/i.test(message)) throw error
      console.warn('AI vision request failed, fallback to text model:', message)
    }
  }

  return aiClient.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    temperature: 0.75,
    max_tokens: 1800,
  })
}

/** SSE 写入辅助：写一条事件并立即 flush */
function sse(res: Response, data: Record<string, unknown> | string) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data)
  res.write(`data: ${payload}\n\n`)
  // 关键：强制立即发送，避免 Node.js HTTP 层缓冲
  if (typeof (res as any).flush === 'function') {
    ;(res as any).flush()
  }
}

export function registerAiRoutes(app: Express) {
  app.post('/api/admin/ai/content-draft', async (req: Request, res: Response) => {
    try {
      const body = contentDraftSchema.parse(req.body)
      const products = await prisma.product.findMany({ where: { id: { in: body.productIds } }, orderBy: { createdAt: 'desc' } })
      if (!products.length) return fail(res, '未找到可用于生成的商品', 40401, 404)

      const productText = products.map((product, index) => `【商品${index + 1}】\n${formatProductForDraft(product)}`).join('\n\n')
      const imageParts = products
        .filter((product) => product.coverUrl?.startsWith('http'))
        .slice(0, 4)
        .map((product) => ({ type: 'image_url' as const, image_url: { url: product.coverUrl, detail: 'auto' as const } }))

      const prompt = `你是电商短视频和直播带货运营专家。请根据商品信息${imageParts.length ? '和商品图片' : ''}生成一份可直接交给运营使用的内容方案。

已填写的视频标题：${body.videoTitle || '无'}
直播间标题：${body.liveTitle || '无'}

商品信息：
${productText}

请严格返回 JSON，不要输出 markdown。JSON 结构如下：
{
  "videoTitles": ["短视频标题1", "短视频标题2", "短视频标题3", "短视频标题4", "短视频标题5"],
  "sellingPoints": ["商品卖点1", "商品卖点2", "商品卖点3", "商品卖点4"],
  "recommendation": "商品推荐语，120字以内",
  "liveScript": "直播讲解文案，300-500字，包含开场、痛点、卖点、促单、互动引导"
}`

      const completion = await createContentDraft(prompt, imageParts)

      const text = completion.choices[0]?.message?.content || ''
      try {
        ok(res, parseJsonObject(text))
      } catch {
        ok(res, fallbackDraft(text))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 服务调用失败'
      console.error('AI content draft error:', message)
      fail(res, `AI 服务调用失败：${message}`, 50201, 502)
    }
  })

  app.post('/api/ai/generate/stream', async (req: Request, res: Response) => {
    // 验证请求体
    let body: GenerateBody
    try {
      body = generateSchema.parse(req.body)
    } catch {
      return fail(res, '请求参数有误', 40001, 400)
    }

    const { type, product } = body

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // 禁用 nginx 缓冲
    // 关键：立即发送响应头，减少 TTFB
    res.flushHeaders()

    // 发送初始心跳，让前端知道连接已建立
    res.write(': connected\n\n')
    if (typeof (res as any).flush === 'function') {
      ;(res as any).flush()
    }

    try {
      const useVision = type === 'recommend_copy' && product.coverUrl

      if (useVision) {
        const { system, userContent } = buildVisionMessages(type, product)
        const stream = await aiClient.chat.completions.create({
          model: AI_VISION_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userContent },
          ],
          stream: true,
          max_tokens: 1000,
          temperature: 0.8,
        })

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content
          if (delta) {
            sse(res, { content: delta })
          }
        }
      } else {
        const { system, user } = buildMessages(type, product)
        const stream = await aiClient.chat.completions.create({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          stream: true,
          max_tokens: 1000,
          temperature: 0.8,
        })

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content
          if (delta) {
            sse(res, { content: delta })
          }
        }
      }

      // 结束信号
      sse(res, '[DONE]')
      res.end()
    } catch (err) {
      console.error('AI generate error:', err)
      sse(res, { error: 'AI 服务调用失败，请检查 API Key 或稍后重试' })
      sse(res, '[DONE]')
      res.end()
    }
  })
}
