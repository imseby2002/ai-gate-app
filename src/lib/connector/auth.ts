// AI-GATE 桌面連接器（客人 Windows 電腦上的端點程式）驗證：配對碼換裝置 token，之後以 Bearer token 呼叫 /api/connector/*。
// token 與配對碼只存 SHA-256 雜湊；裝置可在網頁端撤銷。
import { createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'

export const PAIR_CODE_TTL_MINUTES = 10
const PAIR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混淆的 0/O/1/I

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function generateDeviceToken(): string {
  return `agc_${randomBytes(32).toString('base64url')}`
}

/** 8 碼配對碼，顯示為 XXXX-XXXX */
export function generatePairCode(): string {
  const bytes = randomBytes(8)
  let code = ''
  for (const b of bytes) code += PAIR_ALPHABET[b % PAIR_ALPHABET.length]
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

export function normalizePairCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw
}

export interface ConnectorDevice {
  deviceId: string
  userId: string
}

/** 驗證連接器 Bearer token，並確認帳號仍有社群矩陣權限 */
export async function requireConnectorDevice(req: NextRequest): Promise<{ device: ConnectorDevice; res?: never } | { device?: never; res: NextResponse }> {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return { res: NextResponse.json({ error: '缺少裝置 token' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: dev } = await admin
    .from('marketing_connector_devices')
    .select('id, user_id, revoked_at')
    .eq('token_hash', sha256(token))
    .maybeSingle()
  if (!dev || dev.revoked_at) return { res: NextResponse.json({ error: '裝置未配對或已撤銷，請重新配對' }, { status: 401 }) }

  const { features } = await getMarketingEntitlements(null, dev.user_id)
  if (!features.socialMatrix) {
    return { res: NextResponse.json({ error: '社群矩陣僅限 PRO 以上方案' }, { status: 403 }) }
  }

  await admin.from('marketing_connector_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', dev.id)
  return { device: { deviceId: dev.id, userId: dev.user_id } }
}
