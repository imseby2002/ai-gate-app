import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET() {
  const checks: Record<string, string> = {}

  // Check env vars
  checks.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ? 'ok' : 'MISSING'
  checks.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'ok' : 'MISSING'
  checks.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'MISSING'

  // Test next-intl message loading
  let intlStatus = 'ok'
  try {
    const messages = await import('../../../../messages/zh-TW.json')
    checks.intl_messages = messages ? 'ok' : 'empty'
  } catch (e: any) {
    intlStatus = e?.message || 'failed'
    checks.intl_messages = intlStatus
  }

  return NextResponse.json({
    status: 'ok',
    runtime: 'edge',
    checks,
  })
}
