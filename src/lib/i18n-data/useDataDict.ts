'use client'

// 大型中文資料（範本庫、平台教學）的多語系字典：key 為原中文字串，依語系動態載入，
// 找不到翻譯時回傳原文。zh-TW 不載入任何檔案。
import { useEffect, useState, useCallback } from 'react'
import { useLocale } from 'next-intl'

type Dict = Record<string, string>
export type DataDictName = 'templates' | 'guides'

const LOADERS: Record<DataDictName, Record<string, () => Promise<{ default: Dict }>>> = {
  templates: {
    en: () => import('./templates.en.json'),
    vi: () => import('./templates.vi.json'),
  },
  guides: {
    en: () => import('./guides.en.json'),
    vi: () => import('./guides.vi.json'),
  },
}

const cache: Record<string, Dict> = {}

export function useDataDict(name: DataDictName) {
  const locale = useLocale()
  const key = `${name}.${locale}`
  const [dict, setDict] = useState<Dict | null>(cache[key] ?? null)

  useEffect(() => {
    const load = LOADERS[name][locale]
    if (!load) { setDict(null); return }
    if (cache[key]) { setDict(cache[key]); return }
    let alive = true
    load().then(m => {
      cache[key] = m.default
      if (alive) setDict(m.default)
    }).catch(() => {})
    return () => { alive = false }
  }, [name, locale, key])

  return useCallback((s: string | undefined) => (s && dict?.[s]) || s || '', [dict])
}
