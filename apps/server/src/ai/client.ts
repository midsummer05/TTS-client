import OpenAI from 'openai'

const baseURL =
  process.env.AI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const apiKey = process.env.AI_API_KEY

export const aiClient = new OpenAI({ apiKey, baseURL })

export const AI_MODEL = process.env.AI_MODEL || 'qwen-plus'
export const AI_VISION_MODEL = process.env.AI_VISION_MODEL || 'qwen-vl-max'
