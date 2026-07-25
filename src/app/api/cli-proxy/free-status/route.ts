import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeFreeLlmBaseUrl } from '@/lib/ai/providers/free-llm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawUrl = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
  const apiKey  = process.env.FREE_LLM_API_KEY

  if (!rawUrl) return NextResponse.json({ ok: false, error: 'FREE_LLM_URL 未設定' })
  const baseUrl = normalizeFreeLlmBaseUrl(rawUrl)

  try {
    const r = await fetch(`${baseUrl}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(5000),
    })
    if (!r.ok) return NextResponse.json({ ok: false, error: `HTTP ${r.status}` })
    const data = await r.json()
    const models: string[] = (data.data ?? []).map((m: { id: string }) => m.id)
    return NextResponse.json({ ok: true, models })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) })
  }
}
