// 公司專屬子網域：<slug>.im-tourist.com。純常數與驗證，client／server／middleware 皆可 import。
// 保留字與 host 解析放在 lib/systems.ts（系統子網域對照表的同一處），這裡只負責驗證。
import { RESERVED_SUBDOMAINS, companySlugFromHost } from '@/lib/systems'

export { RESERVED_SUBDOMAINS, companySlugFromHost }

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/

/** 回傳錯誤訊息；合法時回傳 null */
export function validateCompanySlug(slug: string): string | null {
  if (!SLUG_PATTERN.test(slug)) return '子網域只能用小寫英文、數字與連字號（開頭結尾不可為連字號，最多 32 字）'
  if (RESERVED_SUBDOMAINS.has(slug)) return `「${slug}」是系統保留名稱，請換一個`
  return null
}
