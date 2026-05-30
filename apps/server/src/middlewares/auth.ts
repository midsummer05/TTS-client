import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { fail } from '../utils/response.js'

export type AuthedRequest = Request & { userId?: string }

export function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header) {
    return fail(res, '请先登录', 40101, 401)
  }

  try {
    const token = header.replace('Bearer ', '')
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as { userId: string }
    req.userId = payload.userId
    next()
  } catch {
    return fail(res, '登录已失效', 40102, 401)
  }
}
