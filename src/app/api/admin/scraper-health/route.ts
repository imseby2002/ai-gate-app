import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const scraperUrl = process.env.OTA_SCRAPER_URL
  const scraperKey = process.env.OTA_SCRAPER_KEY
  const checkedAt = new Date().toISOString()

  if (!scraperUrl) {
    return NextResponse.json({
      configured: false,
      checked_at: checkedAt,
    })
  }

  const startedAt = Date.now()
  try {
    const res = await fetch(`${scraperUrl}/health`, {
      headers: scraperKey ? { 'X-Api-Key': scraperKey } : {},
      signal: AbortSignal.timeout(10000),
    })
    const responseTimeMs = Date.now() - startedAt
    const body = await res.json().catch(() => null)

    return NextResponse.json({
      configured: true,
      url: scraperUrl,
      ok: res.ok && body?.ok === true,
      status_code: res.status,
      response_time_ms: responseTimeMs,
      checked_at: checkedAt,
    })
  } catch (e) {
    return NextResponse.json({
      configured: true,
      url: scraperUrl,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      response_time_ms: Date.now() - startedAt,
      checked_at: checkedAt,
    })
  }
}
