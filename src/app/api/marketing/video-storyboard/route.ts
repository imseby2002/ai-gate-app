/**
 * POST /api/marketing/video-storyboard
 * 多分鏡配音影片 — 由主題或內容產生 N 段旁白（給 TTS）＋ 每段英文畫面提示詞（給產圖）
 * 提示詞規範改寫自 Pixelle-Video（AIDC-AI，Apache-2.0）的 topic/content narration 與 image prompt。
 *
 * Body: { content: string, sceneCount?: number(3–10), language?: string, mode?: 'topic' | 'content', style?: string }
 * 回傳：{ title, scenes: [{ narration, visualPrompt }] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { langInstruction } from '@/lib/marketing/lang'
import { chargeUsage, llmCost, precheckUsage } from '@/lib/marketing/billing'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import { STORY_MAX_NARRATION } from '@/lib/marketing/story-video'

export const maxDuration = 60

const MODEL = 'claude-sonnet-4-6'

function buildPrompt(content: string, n: number, mode: 'topic' | 'content', language: string | undefined, style: string): string {
  const task = mode === 'topic'
    ? `把以下主題展開成 ${n} 段短影音分鏡旁白，每段傳達一個有價值的觀點。\n# 主題\n${content}`
    : `從以下內容萃取重點，改寫成 ${n} 段短影音分鏡旁白；內容長就濃縮重點，內容短就補充例子，忠於原意。\n# 內容\n${content}`

  return `你是短影音腳本與視覺設計專家。
${task}

# 旁白規範（給 TTS 朗讀）
- 每段 25～60 字（英文約 15～40 個字詞），口語、自然，像跟朋友分享
- 第 1 段用提問、情境或反差抓住注意力；中間展開重點；最後一段收斂成結論或行動呼籲
- 每段開頭依內容自然選擇，同一個詞不得在兩段以上當開頭，不得套用固定句型
- 段與段要連貫，像同一個人一路講下去
- 禁止網址、emoji、數字編號、空泛套話；不可捏造數據或出處
- 句中可用標點表示停頓，段尾不加句號

# 畫面提示詞規範（給 AI 產圖）
- 一律英文，50～90 個字詞：場景 ＋ 主體動作 ＋ 情緒 ＋ 象徵元素
- 準確呼應該段旁白；抽象概念用具象隱喻表現
- 全部分鏡維持同一視覺風格：${style}
- 畫面中不要出現文字

# 輸出
${langInstruction(language)}（畫面提示詞例外，必須是英文）
只輸出 JSON，不要任何說明或 markdown：
{"title":"影片標題（15 字內）","scenes":[{"narration":"…","visualPrompt":"…"}]}
scenes 必須剛好 ${n} 筆。`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { features, plan } = await getMarketingEntitlements(supabase, user.id)
  if (!features.videoGen) {
    return NextResponse.json({ error: '目前方案未開放影片產出，請升級至 PRO 以上', plan }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const content = String(body.content ?? '').trim().slice(0, 6000)
  if (!content) return NextResponse.json({ error: '請輸入主題或內容' }, { status: 400 })
  const n = Math.min(10, Math.max(3, Number(body.sceneCount) || 5))
  const mode: 'topic' | 'content' = body.mode === 'content' ? 'content' : 'topic'
  const style = String(body.style ?? '').trim().slice(0, 200) || 'clean modern commercial photography, soft natural light'

  const blocked = await precheckUsage(user.id, 0.05)
  if (blocked) return NextResponse.json(blocked, { status: 402 })

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const { text, usage } = await generateText({
    model: anthropic(MODEL),
    prompt: buildPrompt(content, n, mode, body.language, style),
    maxOutputTokens: 4000,
  })
  await chargeUsage(user.id, llmCost(MODEL, usage), '[marketing] 多分鏡影片腳本')

  let parsed: { title?: string; scenes?: { narration?: string; visualPrompt?: string }[] } | null = null
  try {
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    parsed = JSON.parse(json)
  } catch {
    parsed = null
  }
  const scenes = (parsed?.scenes ?? [])
    .map(s => ({
      narration: String(s.narration ?? '').trim().slice(0, STORY_MAX_NARRATION),
      visualPrompt: String(s.visualPrompt ?? '').trim(),
    }))
    .filter(s => s.narration && s.visualPrompt)
  if (!scenes.length) return NextResponse.json({ error: '腳本產生失敗，請再試一次' }, { status: 502 })

  return NextResponse.json({ title: String(parsed?.title ?? '').trim(), scenes })
}
