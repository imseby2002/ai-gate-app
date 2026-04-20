import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export const locales = ['zh-TW', 'en', 'vi'] as const
export type Locale = typeof locales[number]
export const defaultLocale: Locale = 'zh-TW'

export default getRequestConfig(async () => {
  let locale: Locale = defaultLocale
  try {
    const cookieStore = await cookies()
    const cookieLocale = cookieStore.get('locale')?.value
    if (locales.includes(cookieLocale as Locale)) {
      locale = cookieLocale as Locale
    }
  } catch {
    // cookies() may not be available in all edge contexts
  }

  let messages: Record<string, unknown> = {}
  try {
    messages = (await import(`../../messages/${locale}.json`)).default as Record<string, unknown>
  } catch {
    try {
      messages = (await import('../../messages/zh-TW.json')).default as Record<string, unknown>
    } catch {
      messages = {}
    }
  }

  return { locale, messages }
})
