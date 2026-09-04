import { getUnitContext } from '@/lib/auth/unit-access'
import { generateGmReport } from '@/lib/gm/report'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

// 快報清單（預設每日）。?kind=daily|weekly|monthly
export async function GET(req: NextRequest) {
  const c = await getUnitContext('gm')
  if (!c.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const kind = new URL(req.url).searchParams.get('kind') || 'daily'
  const { data, error } = await c.admin.from('gm_reports')
    .select('id, kind, report_date, title, content, channels, created_at')
    .eq('owner_id', c.ownerId).eq('kind', kind)
    .order('report_date', { ascending: false }).limit(60)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// 立即產生一份快報並推播。body: { kind? }
export async function POST(req: NextRequest) {
  const c = await getUnitContext('gm')
  if (!c.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const kind = (['daily', 'weekly', 'monthly'].includes(b.kind) ? b.kind : 'daily') as 'daily' | 'weekly' | 'monthly'
  try {
    const r = await generateGmReport(c.admin, c.ownerId, kind)
    return NextResponse.json(r)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
