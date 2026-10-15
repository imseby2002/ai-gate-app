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
 * Bird webhook（Standard Webhooks 格式）：
 * 標頭 webhook-id / webhook-timestamp / webhook-signature（"v1,<base64>"，可多組空白分隔），
 * 簽章 = base64(HMAC-SHA256(secret, `${id}.${timestamp}.${rawBody}`))。
 * 密鑰若為 "whsec_<base64>" 取 base64 解碼後的位元組，否則同時嘗試原字串。
 * 時間戳與現在相差超過 5 分鐘視為重放，拒絕。
 */
export function verifyBirdStandardWebhook(
  rawBody: string,
  id: string | null,
  timestamp: string | null,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.BIRD_WEBHOOK_SECRET
  if (!secret) return true // 尚未配置，放行
  if (!id || !timestamp || !signatureHeader) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false

  const keys: Buffer[] = [Buffer.from(secret, 'utf8')]
  if (secret.startsWith('whsec_')) keys.unshift(Buffer.from(secret.slice(6), 'base64'))
  const signed = `${id}.${timestamp}.${rawBody}`
  const provided = signatureHeader.split(' ').map((s) => s.split(',')[1]).filter(Boolean)

  return keys.some((key) => {
    const expected = createHmac('sha256', key).update(signed, 'utf8').digest('base64')
    return provided.some((p) => safeEqualHex(p, expected))
  })
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
