import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getRdUser() {
  const ctx = await getUnitContext('rd')
  if (!ctx.ok) return { user: null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getRdUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const { rows } = (await req.json()) as { rows?: Record<string, unknown>[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '沒有可匯入的資料' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []
  const toInsert: Record<string, unknown>[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 2
    const title = String(r.title ?? '').trim()
    const summary = String(r.summary ?? r.content ?? r.notes ?? '').trim()

    if (!title && !summary) {
      errors.push({ line, reason: '缺少標題或日誌內容' })
      continue
    }

    toInsert.push({
      owner_id: user.id,
      title: title || '研發記錄',
      summary: summary || title,
      chat_id: '',
      updated_at: r.date ? new Date(String(r.date)).toISOString() : new Date().toISOString(),
    })
  }

  let inserted = 0
  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from('rd_logs')
      .insert(toInsert)
      .select('id')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    inserted = data?.length ?? 0
  }

  return NextResponse.json({ ok: true, inserted, errors })
}
