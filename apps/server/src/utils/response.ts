import type { Response } from 'express'

export function ok<T>(res: Response, data: T) {
  return res.json({ code: 0, message: 'ok', data })
}

export function fail(
  res: Response,
  message: string,
  code = 40001,
  status = 400,
) {
  return res.status(status).json({ code, message, data: null })
}
