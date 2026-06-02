import type { Express, Request, Response } from 'express'
import { z } from 'zod'
import { aiClient, AI_MODEL, AI_VISION_MODEL } from './client.js'
import {
  buildMessages,
  buildVisionMessages,
  type GenerateType,
  type ProductInfo,
} from './prompts.js'
import { fail } from '../utils/response.js'

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
