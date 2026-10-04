import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import type { FtMenu, FtTranslations } from './types'

// 菜單多語系：以 iPOS 越南文原文為 key 查 ft_menu_translations；
// 缺的字串由 Claude 批次翻譯後寫回（人工修正過的 manual=true 不覆蓋）

const BATCH = 60
const inFlight = new Set<string>()

interface Row {
  source: string
  zh_tw: string | null
  en: string | null
}

type Translatable = { translations?: FtTranslations }

function visit(menu: FtMenu, fn: (source: string, target: Translatable, field: 'name' | 'description') => void) {
  const name = (s: string | null | undefined, t: Translatable) => { if (s?.trim()) fn(s.trim(), t, 'name') }
  const desc = (s: string | null | undefined, t: Translatable) => { if (s?.trim()) fn(s.trim(), t, 'description') }
  for (const c of menu.categories) {
    name(c.category_name, c)
    for (const i of c.items) {
      name(i.item_name, i)
      desc(i.description, i)
      for (const g of i.customizations ?? []) {
        name(g.name, g)
        for (const o of g.options) name(o.item_name, o)
      }
      for (const ch of i.childs ?? []) {
        name(ch.item_name, ch)
        for (const g of ch.customizations ?? []) {
          name(g.name, g)
          for (const o of g.options) name(o.item_name, o)
        }
      }
    }
  }
}

/** 把已存的翻譯套進菜單，回傳還沒翻譯的原文 */
export async function applyTranslations(menu: FtMenu): Promise<string[]> {
  const sources = new Set<string>()
  visit(menu, s => sources.add(s))
  const all = [...sources]
  if (all.length === 0) return []

  const found = new Map<string, Row>()
  try {
    const admin = createAdminClient()
    for (let i = 0; i < all.length; i += 200) {
      const { data } = await admin
        .from('ft_menu_translations')
        .select('source, zh_tw, en')
        .in('source', all.slice(i, i + 200))
      for (const r of (data ?? []) as Row[]) found.set(r.source, r)
    }
  } catch {
    return []
  }

  visit(menu, (source, target, field) => {
    const r = found.get(source)
    if (!r) return
    const tr = (target.translations ??= {})
    if (r.zh_tw) tr['zh-TW'] = { ...tr['zh-TW'], [field]: r.zh_tw }
    if (r.en) tr.en = { ...tr.en, [field]: r.en }
  })

  return all.filter(s => !found.has(s))
}

async function translateBatch(sources: string[]): Promise<Row[]> {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const { text } = await generateText({
    model: anthropic('claude-opus-5-5'),
    system:
      'You translate Vietnamese bubble-tea / café menu text (drink names, sizes, sugar and ice levels, toppings, categories, descriptions) ' +
      'into Traditional Chinese as used in Taiwan and into English. Keep brand names and product codes as-is. ' +
      'Use the terms a Taiwanese tea shop menu would use (e.g. 正常冰, 少冰, 去冰, 半糖, 珍珠). ' +
      'Return ONLY a JSON object mapping each input string exactly to {"zh":"...","en":"..."}. No prose, no code fences.',
    prompt: JSON.stringify(sources),
    maxOutputTokens: 16000,
  })
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const parsed = JSON.parse(cleaned) as Record<string, { zh?: string; en?: string }>
  return sources.flatMap(source => {
    const t = parsed[source]
    if (!t?.zh && !t?.en) return []
    return [{ source, zh_tw: t.zh?.trim() || null, en: t.en?.trim() || null }]
  })
}

/** 背景補翻譯（在 after() 裡呼叫），同一字串不會同時送兩次 */
export async function translateMissing(missing: string[]) {
  const todo = missing.filter(s => !inFlight.has(s))
  if (todo.length === 0 || !process.env.ANTHROPIC_API_KEY) return
  todo.forEach(s => inFlight.add(s))
  try {
    const admin = createAdminClient()
    for (let i = 0; i < todo.length; i += BATCH) {
      const chunk = todo.slice(i, i + BATCH)
      try {
        const rows = await translateBatch(chunk)
        if (rows.length > 0) {
          await admin.from('ft_menu_translations').upsert(rows, { onConflict: 'source', ignoreDuplicates: true })
        }
      } catch (err) {
        console.error('[ft-kiosk] translate batch failed', err)
      }
    }
  } finally {
    todo.forEach(s => inFlight.delete(s))
  }
}
