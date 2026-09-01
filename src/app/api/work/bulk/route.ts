import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = (await req.json()) as { rows?: Record<string, unknown>[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '沒有可匯入的任務資料' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []
  const toInsert: Record<string, unknown>[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 2
    const title = String(r.title ?? r.name ?? r.task ?? '').trim()
    if (!title) {
      errors.push({ line, reason: '缺少任務標題' })
      continue
    }

    let done = r.done
    if (typeof done === 'string') {
      done = ['true', '1', '是', 'yes', '已完成', 'done', 'v'].includes(done.trim().toLowerCase())
    } else if (done === undefined || done === null || done === '') {
      done = false
    }

    let deadline: string | null = null
    if (r.deadline) {
      const d = new Date(String(r.deadline))
      if (!isNaN(d.getTime())) {
        deadline = d.toISOString()
      }
    }

    toInsert.push({
      user_id: user.id,
      title,
      status: String(r.status ?? '').trim(),
      done: !!done,
      deadline,
      updated_at: new Date().toISOString(),
    })
  }

  let inserted = 0
  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from('work_docs')
      .insert(toInsert)
      .select('id')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    inserted = data?.length ?? 0
  }

  return NextResponse.json({ ok: true, inserted, errors })
}
