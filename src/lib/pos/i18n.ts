export type PosLocale = 'zh-TW' | 'en' | 'vi'

export interface PosI18nText {
  name?: string
  description?: string
}

export type PosTranslations = Partial<Record<PosLocale, PosI18nText>>

export function pickPosText(
  translations: PosTranslations | null | undefined,
  locale: string,
  fallback: { name: string; description?: string }
) {
  const loc = (locale in (translations ?? {}) ? locale : 'zh-TW') as PosLocale
  const tr = translations?.[loc] ?? translations?.['zh-TW']
  return {
    name: tr?.name?.trim() || fallback.name,
    description: tr?.description?.trim() || fallback.description || '',
  }
}

/** 合併 API 列成帶 display 欄位的品項 */
export function localizeItem<T extends { name: string; description?: string; translations?: PosTranslations }>(
  item: T,
  locale: string
) {
  const text = pickPosText(item.translations, locale, { name: item.name, description: item.description })
  return { ...item, displayName: text.name, displayDescription: text.description }
}

export function localizeCategory<T extends { name: string; translations?: PosTranslations }>(
  cat: T,
  locale: string
) {
  const text = pickPosText(cat.translations, locale, { name: cat.name })
  return { ...cat, displayName: text.name }
}
