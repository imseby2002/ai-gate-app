import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiUrl = process.env.CLI_PROXY_API_URL ?? process.env.NEXT_PUBLIC_CLI_PROXY_API_URL
  const apiKey = process.env.CLI_PROXY_API_KEY

  if (!apiUrl) return NextResponse.json({ error: 'CLI_PROXY_API_URL 未設定' })

  try {
    const r = await fetch(`${apiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 64,
        messages: [{ role: 'user', content: '用一句話說你好，測試連線用' }],
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) {
      const txt = await r.text()
      return NextResponse.json({ error: `HTTP ${r.status}: ${txt}` })
    }
    const data = await r.json()
    const reply = data.choices?.[0]?.message?.content ?? JSON.stringify(data)
    return NextResponse.json({ reply })
  } catch (e) {
    return NextResponse.json({ error: String(e) })
  }
}
