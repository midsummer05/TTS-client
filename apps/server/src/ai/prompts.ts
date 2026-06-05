import OpenAI from 'openai'

export interface ProductInfo {
  title: string
  description?: string
  price?: number // 单位：分
  category?: string
  tags?: string
  coverUrl?: string
}

export type GenerateType =
  | 'video_title'
  | 'selling_point'
  | 'live_script'
  | 'recommend_copy'

const TYPE_LABEL: Record<GenerateType, string> = {
  video_title: '短视频标题',
  selling_point: '商品卖点',
  live_script: '直播讲解文案',
  recommend_copy: '商品推荐语',
}

function formatProduct(product: ProductInfo): string {
  const parts: string[] = []
  parts.push(`商品名称：${product.title}`)
  if (product.description) parts.push(`商品描述：${product.description}`)
  if (product.price != null)
    parts.push(`价格：¥${(product.price / 100).toFixed(2)}`)
  if (product.category) parts.push(`类目：${product.category}`)
  if (product.tags) parts.push(`标签：${product.tags}`)
  return parts.join('\n')
}

function buildSystemPrompt(type: GenerateType): string {
  switch (type) {
    case 'video_title':
      return '你是短视频运营专家，擅长写带货短视频的吸睛标题。要求：口语化、有情绪张力、适合抖音/快手风格，每条标题不超过30字。'
    case 'selling_point':
      return '你是电商文案专家，擅长提炼商品核心卖点。要求：每条卖点一句话，直击用户痛点或爽点，突出差异化优势。'
    case 'live_script':
      return '你是直播带货主播，擅长互动式讲解。要求：模拟真人主播口播风格，语气热情亲切，使用"家人们""宝贝们"等称呼，包含限时优惠、库存紧张等促单话术。字数200-300字。'
    case 'recommend_copy':
      return '你是种草达人，擅长写让人心动的商品推荐文案。要求：感性、有代入感，像朋友推荐好物，突出使用场景和体验感。字数80-150字。'
  }
}

function buildUserPrompt(type: GenerateType, product: ProductInfo): string {
  const info = formatProduct(product)
  switch (type) {
    case 'video_title':
      return `请根据以下商品信息，生成 5 个短视频带货标题，每条一行，用数字编号。\n\n${info}`
    case 'selling_point':
      return `请根据以下商品信息，提炼 3-5 条核心卖点文案，每条一行，用数字编号。\n\n${info}`
    case 'live_script':
      return `请根据以下商品信息，写一段直播讲解口播稿，模拟主播在直播间推荐这个商品。\n\n${info}`
    case 'recommend_copy':
      return `请根据以下商品信息，写一段种草推荐文案，分享给朋友的感觉。\n\n${info}`
  }
}

export function buildMessages(type: GenerateType, product: ProductInfo) {
  return {
    system: buildSystemPrompt(type),
    user: buildUserPrompt(type, product),
  }
}

export function buildVisionMessages(
  type: 'recommend_copy',
  product: ProductInfo,
) {
  const textContent = `请根据这张商品图片，写一段种草推荐文案。商品信息供参考：\n${formatProduct(product)}\n\n要求：感性、有代入感，像朋友推荐好物，80-150字。`

  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: 'text', text: textContent },
  ]

  if (product.coverUrl) {
    // coverUrl 可能是本地路径 (/media/xxx) 或远程 URL
    const imageUrl = product.coverUrl.startsWith('http')
      ? product.coverUrl
      : product.coverUrl.startsWith('/media')
        ? `http://localhost:${process.env.PORT || 4000}${product.coverUrl}`
        : product.coverUrl

    content.push({
      type: 'image_url',
      image_url: { url: imageUrl, detail: 'auto' },
    })
  }

  return {
    system: '你是种草达人，擅长根据商品图片和描述写让人心动的推荐文案。',
    userContent: content,
  }
}
