// 伺服器元件用：依目前語系載入字典（zh-TW 直接回傳原文）。同一個 request 只載入一次。
import { cache } from 'react'
import { getLocale } from 'next-intl/server'
import { makeTr, type Dict, type Tr } from './tr-core'

const LOADERS: Record<string, () => Promise<Dict>> = {
  en: async () => ({ ...(await import('./templates.en.json')).default, ...(await import('./intro.en.json')).default }),
  vi: async () => ({ ...(await import('./templates.vi.json')).default, ...(await import('./intro.vi.json')).default }),
}

export const introTr = cache(async (): Promise<Tr> => {
  const load = LOADERS[await getLocale()]
  return makeTr(load ? await load() : null)
})

export { trDeep } from './tr-core'
