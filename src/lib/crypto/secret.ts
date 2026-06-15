import crypto from 'crypto'

// IMAP 密碼等機密欄位的對稱加密（AES-256-GCM）。
// 金鑰來自環境變數 EMAIL_ENC_KEY（32 bytes，base64 或 hex）。
// 儲存格式：enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
const PREFIX = 'enc:v1:'

function getKey(): Buffer | null {
  const raw = process.env.EMAIL_ENC_KEY
  if (!raw) return null
  let key = Buffer.from(raw, 'base64')
  if (key.length !== 32) key = Buffer.from(raw, 'hex')
  return key.length === 32 ? key : null
}

export function isEncrypted(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.startsWith(PREFIX)
}

// 加密；尚未設金鑰時維持明文（部署金鑰後新存的才會加密），已加密則原樣返回。
export function encryptSecret(plain: string | null | undefined): string | null {
  if (plain == null || plain === '') return null
  if (isEncrypted(plain)) return plain
  const key = getKey()
  if (!key) return plain
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':')
}

// 解密；舊明文（無前綴）原樣返回，方便平滑遷移。
export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored == null) return null
  if (!isEncrypted(stored)) return stored
  const key = getKey()
  if (!key) throw new Error('EMAIL_ENC_KEY 未設定，無法解密既有機密')
  const parts = stored.split(':') // ['enc','v1',iv,tag,ct]
  const iv = Buffer.from(parts[2], 'base64')
  const tag = Buffer.from(parts[3], 'base64')
  const ct = Buffer.from(parts[4], 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}
