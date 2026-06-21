import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

const LANGS: Record<string, string> = {
  'zh-TW': '繁體中文 (Traditional Chinese)',
  en: 'English',
  vi: 'Tiếng Việt (Vietnamese)',
}

function hash(s: string) {
  return createHash('sha1').update(s).digest('hex')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { texts, target } = (await req.json()) as { texts: string[]; target: string }
  const langName = LANGS[target]
  if (!langName || !Array.isArray(texts)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  // 去重 + 過濾空字串
  const uniq = Array.from(new Set(texts.map(t => (t ?? '').trim()).filter(Boolean)))
  const result: Record<string, string> = {}

  // 1) 讀快取
  const hashes = uniq.map(hash)
  if (hashes.length) {
    const { data: cached } = await supabase
      .from('work_translations')
      .select('source, translated')
      .eq('target_lang', target)
      .in('source_hash', hashes)
    for (const row of cached ?? []) result[(row as { source: string }).source] = (row as { translated: string }).translated
  }

  // 2) 翻譯未命中的
  const missing = uniq.filter(t => !(t in result))
  if (missing.length) {
    try {
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
      const { text } = await generateText({
        model: anthropic('claude-sonnet-4-5'),
        system:
          `You are a translation engine. Translate each input string into ${langName}. ` +
          `If a string is already in the target language, return it unchanged. ` +
          `Preserve emojis, numbers and proper nouns. Keep it natural and concise. ` +
          `Return ONLY a JSON array of translated strings, in the exact same order, no extra text.`,
        prompt: JSON.stringify(missing),
        maxOutputTokens: 2000,
      })

      let arr: string[] = []
      try {
        const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
        arr = JSON.parse(cleaned)
      } catch {
        arr = []
      }

      const rows: { source_hash: string; target_lang: string; source: string; translated: string }[] = []
      missing.forEach((src, i) => {
        const tr = typeof arr[i] === 'string' ? arr[i] : src
        result[src] = tr
        rows.push({ source_hash: hash(src), target_lang: target, source: src, translated: tr })
      })
      if (rows.length) await supabase.from('work_translations').upsert(rows, { onConflict: 'source_hash,target_lang' })
    } catch {
      // 翻譯失敗 → 回傳原文，不阻斷
      for (const src of missing) result[src] = src
    }
  }

  // 依輸入順序回傳
  const translations = texts.map(t => {
    const k = (t ?? '').trim()
    return k ? result[k] ?? t : t
  })
  return NextResponse.json({ translations })
}
