import OpenAI from 'openai'
import fs from 'node:fs'
import path from 'node:path'

function envValue(name: string) {
  if (process.env[name]) return process.env[name]
  const envPath = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), 'apps', 'server', '.env')].find((item) => fs.existsSync(item))
  if (!envPath) return undefined
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((item) => item.trim().startsWith(`${name}=`))
  if (!line) return undefined
  return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
}

const baseURL =
  envValue('AI_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const apiKey = envValue('AI_API_KEY')

export const aiClient = new OpenAI({ apiKey, baseURL })

export const AI_MODEL = envValue('AI_MODEL') || 'qwen-plus'
export const AI_VISION_MODEL = envValue('AI_VISION_MODEL') || 'qwen-vl-max'
