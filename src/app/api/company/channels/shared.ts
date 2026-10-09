import { CHANNEL_PLATFORM_MAP, isChannelModule, type ChannelModuleId } from '@/lib/channels/platforms'

export interface ChannelAccountRow {
  id: string
  platform: string
  name: string
  credentials: Record<string, string>
  modules: string[]
  is_connected: boolean
  updated_at: string
}

// 憑證遮罩：非機密欄位顯示原值，機密欄位只露末 4 碼
export function maskCredentials(platform: string, creds: Record<string, string>): Record<string, string> {
  const def = CHANNEL_PLATFORM_MAP[platform]
  const out: Record<string, string> = {}
  for (const f of def?.fields ?? []) {
    const v = String(creds?.[f.key] ?? '')
    if (!v) continue
    out[f.key] = f.secret ? (v.length > 8 ? '••••' + v.slice(-4) : '••••') : v
  }
  return out
}

// 只收該平台定義的欄位；空字串代表「保留原值」
export function mergeCredentials(platform: string, current: Record<string, string>, input: unknown): Record<string, string> {
  const def = CHANNEL_PLATFORM_MAP[platform]
  const merged: Record<string, string> = { ...current }
  if (!def || !input || typeof input !== 'object') return merged
  for (const f of def.fields) {
    const v = (input as Record<string, unknown>)[f.key]
    if (typeof v === 'string' && v.trim()) merged[f.key] = v.trim()
  }
  return merged
}

export function isConnected(platform: string, creds: Record<string, string>): boolean {
  const def = CHANNEL_PLATFORM_MAP[platform]
  return !!def && def.required.every(k => !!creds[k])
}

export function parseModules(v: unknown): ChannelModuleId[] {
  return Array.isArray(v) ? [...new Set(v.filter(isChannelModule))] : []
}

export function parseName(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, 60) : ''
}
