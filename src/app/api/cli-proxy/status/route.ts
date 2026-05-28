import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiUrl = process.env.CLI_PROXY_API_URL ?? process.env.NEXT_PUBLIC_CLI_PROXY_API_URL
  const apiKey = process.env.CLI_PROXY_API_KEY

  if (!apiUrl) return NextResponse.json({ ok: false, error: 'CLI_PROXY_API_URL 未設定' })

  try {
    const r = await fetch(`${apiUrl}/models`, {
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
