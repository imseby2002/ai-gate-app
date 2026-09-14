import { getRequestConfig } from 'next-intl/server'
import { IntlErrorCode } from 'next-intl'
import { cookies, headers } from 'next/headers'

export const locales = ['zh-TW', 'en', 'vi'] as const
export type Locale = typeof locales[number]
export const defaultLocale: Locale = 'zh-TW'

export function detectLocaleFromAcceptLanguage(acceptLanguage?: string | null): Locale {
  if (!acceptLanguage) return defaultLocale
  const parts = acceptLanguage.split(',').map(part => {
    const [tag, qPart] = part.trim().split(';')
    const q = qPart && qPart.startsWith('q=') ? parseFloat(qPart.slice(2)) : 1.0
    return { tag: tag.toLowerCase(), q: isNaN(q) ? 1.0 : q }
  }).sort((a, b) => b.q - a.q)

  for (const { tag } of parts) {
    if (tag.startsWith('vi')) return 'vi'
    if (tag.startsWith('zh')) return 'zh-TW'
    if (tag.startsWith('en')) return 'en'
  }
  return defaultLocale
}

// 深度合併：以 base（英文）為底，用當前語系覆蓋。
// 這樣任一語系若缺某個 key，會自動退回英文，而不會讓 next-intl 丟 MISSING_MESSAGE
// 導致整頁 500（例如某功能只加了中英、漏了越南文）。陣列直接以覆蓋語系為準。
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(override)) {
    const b = out[k]
    out[k] = isPlainObject(b) && isPlainObject(v) ? deepMerge(b, v) : v
  }
  return out
}

async function loadJson(loc: string): Promise<Record<string, unknown>> {
  try {
    return (await import(`../../messages/${loc}.json`)).default as Record<string, unknown>
  } catch {
    return {}
  }
}

export default getRequestConfig(async () => {
  let locale: Locale = defaultLocale
  try {
    const cookieStore = await cookies()
    const cookieLocale = cookieStore.get('locale')?.value
    if (locales.includes(cookieLocale as Locale)) {
      locale = cookieLocale as Locale
    } else {
      // 依使用者瀏覽器/系統語言 (Accept-Language) 自動偵測
      const headerStore = await headers()
      const acceptLanguage = headerStore.get('accept-language')
      locale = detectLocaleFromAcceptLanguage(acceptLanguage)
    }
  } catch {
    // cookies()/headers() may not be available in all edge contexts
  }

  // 英文為 fallback 基底；當前語系覆蓋其上
  const en = await loadJson('en')
  const current = locale === 'en' ? en : await loadJson(locale)
  const messages =
    Object.keys(en).length > 0 ? deepMerge(en, current) : current

  return {
    locale,
    messages,
    // 萬一某 key 連英文都缺：不要丟例外讓整頁崩潰，改為安靜略過（開發時仍可從 log 看到其他錯誤）
    onError(error) {
      if (error.code === IntlErrorCode.MISSING_MESSAGE) return
      console.error(error)
    },
    // 顯示 key 路徑當最後防線（而非拋錯）
    getMessageFallback({ namespace, key }) {
      return namespace ? `${namespace}.${key}` : key
    },
  }
})
