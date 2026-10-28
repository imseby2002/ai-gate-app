// JaaS（8x8 Jitsi as a Service）JWT 簽發。
// 以環境變數啟用，未設定則視為停用（前端不顯示視訊）。用 Node 內建 crypto
// 手刻 RS256，不裝任何套件。
//
// 需要的環境變數：
//   NEXT_PUBLIC_JAAS_APP_ID  JaaS App ID（vpaas-magic-cookie-…，非機密，前端也用）
//   JAAS_API_KEY             JaaS API Key ID（kid 的後半，機密）
//   JAAS_PRIVATE_KEY         對應的 RSA 私鑰 PEM（機密；可含真實換行或字面 \n）
import crypto from 'crypto'

export function getJaasAppId(): string | undefined {
  return process.env.JAAS_APP_ID ?? process.env.NEXT_PUBLIC_JAAS_APP_ID
}

export function jaasConfigured(): boolean {
  return !!(getJaasAppId() && process.env.JAAS_API_KEY && process.env.JAAS_PRIVATE_KEY)
}

/**
 * 讀取 JAAS_PRIVATE_KEY 並容錯：貼到 Vercel 時常見換行消失（變空白或字面 \\n）、
 * Windows 換行、外層引號，或只貼了中間的 base64。一律取出 base64 內容重新排成標準 PEM，
 * 先試 PKCS#8（BEGIN PRIVATE KEY），再試 PKCS#1（BEGIN RSA PRIVATE KEY）。
 */
let cachedKey: crypto.KeyObject | null = null
export function loadJaasPrivateKey(): crypto.KeyObject {
  if (cachedKey) return cachedKey
  const raw = (process.env.JAAS_PRIVATE_KEY ?? '').trim().replace(/^["']|["']$/g, '').replace(/\\r/g, '').replace(/\\n/g, '\n')
  const tries: string[] = []
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(raw)) tries.push(raw.replace(/\r/g, ''))
  const label = raw.match(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----/)?.[1]
  const body = raw.replace(/-----(BEGIN|END) [A-Z ]*-----/g, '').replace(/[^A-Za-z0-9+/=]/g, '')
  const wrapped = body.match(/.{1,64}/g)?.join('\n') ?? ''
  for (const l of [label, 'PRIVATE KEY', 'RSA PRIVATE KEY']) if (l) tries.push(`-----BEGIN ${l}-----\n${wrapped}\n-----END ${l}-----\n`)
  let last: unknown
  for (const pem of tries) {
    try { cachedKey = crypto.createPrivateKey(pem); return cachedKey } catch (e) { last = e }
  }
  throw new Error(`JAAS_PRIVATE_KEY 無法解析：${last instanceof Error ? last.message : String(last)}`)
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function mintJaasToken(opts: {
  room: string
  userId: string
  name: string
  moderator?: boolean
}): string {
  const appId = getJaasAppId()!
  const apiKey = process.env.JAAS_API_KEY!
  const privateKey = loadJaasPrivateKey()
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'RS256', kid: `${appId}/${apiKey}`, typ: 'JWT' }
  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    sub: appId,
    room: opts.room,
    iat: now,
    nbf: now - 10,
    exp: now + 2 * 60 * 60, // 2 小時
    context: {
      user: {
        id: opts.userId,
        name: opts.name,
        moderator: opts.moderator ? 'true' : 'false',
      },
      features: {
        livestreaming: 'false',
        recording: 'false',
        transcription: 'false',
        'outbound-call': 'false',
      },
    },
  }

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(privateKey)
  return `${signingInput}.${b64url(signature)}`
}
