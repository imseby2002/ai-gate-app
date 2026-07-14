import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { getPosOwner } from '@/lib/pos/auth'

const LANGS: Record<string, string> = {
  'zh-TW': '繁體中文',
  en: 'English',
  vi: 'Tiếng Việt',
}

function hash(s: string) {
  return createHash('sha1').update(s).digest('hex')
}

/** 批次翻譯菜單品名／描述 → { zh-TW, en, vi } */
export async function POST(req: NextRequest) {
  const ctx = await getPosOwner()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name 必填' }, { status: 400 })

  const source = { name: name.trim(), description: (description ?? '').trim() }
  const targets = ['zh-TW', 'en', 'vi'] as const
  const out: Record<string, { name: string; description: string }> = {}

  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system:
        'Translate menu item name and description into zh-TW, en, vi. ' +
        'Return ONLY JSON: {"zh-TW":{"name":"","description":""},"en":{...},"vi":{...}}. ' +
        'Keep brand names. If source is already in target language, copy as-is.',
      prompt: JSON.stringify(source),
      maxOutputTokens: 800,
    })
    const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const parsed = JSON.parse(cleaned) as Record<string, { name: string; description: string }>
    for (const loc of targets) {
      out[loc] = {
        name: parsed[loc]?.name || source.name,
        description: parsed[loc]?.description || source.description,
      }
    }
  } catch {
    for (const loc of targets) {
      out[loc] = { name: source.name, description: source.description }
    }
  }

  return NextResponse.json({ translations: out, hash: hash(source.name) })
}
