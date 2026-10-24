import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

/**
 * 驗證 Cron 請求。設計為 fail-closed：
 *  - 未設定 CRON_SECRET → 一律拒絕（503），不接受可偽造的 x-vercel-cron / localhost。
 *  - 已設定 → 以 timing-safe 比對 Authorization: Bearer <CRON_SECRET>。
 *
 * 用法：
 *   const authError = verifyCronAuth(req)
 *   if (authError) return authError
 */
export function verifyCronAuth(req: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
  }

  const authHeader = req.headers.get('authorization') || ''
  const expected = `Bearer ${cronSecret}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
