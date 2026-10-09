'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'

// API 回傳的 { error } 多為中文（少數英文）。這裡在瀏覽器端攔截 fetch：
// 失敗回應若是 JSON 且 error 在對照表（lib/i18n/api-errors.json）裡，就換成目前語系的文字。
// 不必逐支改 API；對照表沒有的訊息原樣保留。
type ApiErrorDict = {
  exact: Record<string, Record<string, string>>
  patterns: { re: string; en: string; vi: string }[]
}

let dictPromise: Promise<ApiErrorDict> | null = null
const loadDict = () =>
  (dictPromise ??= import('@/lib/i18n/api-errors.json').then(m => m.default as ApiErrorDict))

let compiled: { re: RegExp; en: string; vi: string }[] | null = null

function translate(dict: ApiErrorDict, locale: string, msg: string): string | null {
  const exact = dict.exact[locale]?.[msg]
  if (exact) return exact
  if (locale !== 'en' && locale !== 'vi') return null
  compiled ??= dict.patterns.map(p => ({ ...p, re: new RegExp(p.re) }))
  for (const p of compiled) {
    const m = msg.match(p.re)
    if (m) return p[locale].replace(/\{(\d+)\}/g, (_, i) => m[Number(i)] ?? '')
  }
  return null
}

type PatchedWindow = Window & { __apiErrLocale?: string; __apiErrPatched?: boolean }

export function ApiErrorTranslator() {
  const locale = useLocale()

  useEffect(() => {
    const w = window as PatchedWindow
    w.__apiErrLocale = locale
    if (w.__apiErrPatched) return
    w.__apiErrPatched = true

    const originalFetch = window.fetch.bind(window)
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await originalFetch(...args)
      if (res.ok) return res
      const lc = w.__apiErrLocale
      if (!lc || !(res.headers.get('content-type') ?? '').includes('application/json')) return res
      try {
        const body = await res.clone().json()
        if (!body || typeof body.error !== 'string') return res
        const translated = translate(await loadDict(), lc, body.error)
        if (!translated) return res
        return new Response(JSON.stringify({ ...body, error: translated }), {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        })
      } catch {
        return res
      }
    }
  }, [locale])

  return null
}
