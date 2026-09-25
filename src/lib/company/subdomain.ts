// 公司專屬子網域：<slug>.im-tourist.com。純常數與驗證，client／server／middleware 皆可 import。
import { SUBDOMAIN_SYSTEM } from '@/lib/systems'

// 系統既有子網域（lib/systems.ts、middleware 的 SUBDOMAIN_HOME）與常見基礎設施名稱，公司不可使用
export const RESERVED_SUBDOMAINS = new Set<string>([
  ...Object.keys(SUBDOMAIN_SYSTEM),
  'www', 'esim', 'app', 'api', 'admin', 'auth', 'login', 'mail', 'smtp', 'ftp', 'static', 'cdn', 'assets',
  'img', 'images', 'docs', 'help', 'support', 'status', 'blog', 'dev', 'test', 'staging', 'preview', 'intro',
])

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/

/** 回傳錯誤訊息；合法時回傳 null */
export function validateCompanySlug(slug: string): string | null {
  if (!SLUG_PATTERN.test(slug)) return '子網域只能用小寫英文、數字與連字號（開頭結尾不可為連字號，最多 32 字）'
  if (RESERVED_SUBDOMAINS.has(slug)) return `「${slug}」是系統保留名稱，請換一個`
  return null
}

/** 由 host 取出公司子網域；非 im-tourist.com 網域、主網域或系統子網域回傳 null */
export function companySlugFromHost(host: string): string | null {
  const labels = host.split('.')
  if (!host.endsWith('.im-tourist.com') || labels.length !== 3) return null
  const sub = labels[0]
  return RESERVED_SUBDOMAINS.has(sub) ? null : sub
}
