/**
 * IVR webhook 簽章驗證。
 * 設計：若對應密鑰未設定 → 回傳 true（放行，方便尚未配置時先接通）；
 *       密鑰已設定但簽章不符 → 回傳 false（拒絕）。
 * TODO: 待後台確認實際標頭名與公式後微調（標頭名見各 route 註解）。
 */
import { createHash, createHmac, timingSafeEqual } from 'crypto'

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/**
 * Bird webhook：HMAC-SHA256(rawBody, secret) 與標頭比對（hex）。
 * 標頭值可能含 "sha256=" 前綴，會自動剝除。
 */
export function verifyBirdSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.BIRD_WEBHOOK_SECRET
  if (!secret) return true // 尚未配置，放行
  if (!signature) return false
  const provided = signature.replace(/^sha256=/i, '').trim().toLowerCase()
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  return safeEqualHex(provided, expected)
}

/**
 * Zalo OA webhook：mac = SHA256(appSecret + rawData + timestamp)（hex）。
 * 標頭通常為 X-ZEvent-Signature，值形如 "mac=<hex>"。
 */
export function verifyZaloSignature(rawBody: string, signature: string | null, timestamp: string | number | undefined): boolean {
  const secret = process.env.ZALO_OA_SECRET
  if (!secret) return true // 尚未配置，放行
  if (!signature) return false
  const provided = signature.replace(/^mac=/i, '').trim().toLowerCase()
  const expected = createHash('sha256').update(secret + rawBody + String(timestamp ?? ''), 'utf8').digest('hex')
  return safeEqualHex(provided, expected)
}
