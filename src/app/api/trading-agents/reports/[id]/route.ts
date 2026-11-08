import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTradingSessionById } from '@/lib/trading-agents/storage'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { id } = await params
    const session = await getTradingSessionById(id, user.id)
    if (!session || !session.full_report_html) {
      return new Response('Report not found', { status: 404 })
    }

    return new Response(session.full_report_html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('[api/trading-agents/reports] GET error:', err)
    return new Response('Internal Server Error', { status: 500 })
  }
}
