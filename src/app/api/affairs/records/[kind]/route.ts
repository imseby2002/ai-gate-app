import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { RECORD_SPECS, cleanRecord } from '@/lib/affairs/records'

// 外務擴充資料（sites / contacts / logs / rents）的通用 CRUD，資料歸屬公司 owner。
type Params = { params: Promise<{ kind: string }> }

async function guard(kind: string) {
  const spec = RECORD_SPECS[kind]
  if (!spec) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const ctx = await getUnitContext('affairs')
  if (!ctx.ok) return { error: NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status }) }
  return { spec, ctx }
}

type Ctx = Awaited<ReturnType<typeof getUnitContext>>

// contact_id 只能指向自己公司的聯絡人
async function contactsOwned(ctx: Ctx, rows: Record<string, unknown>[]) {
  const ids = [...new Set(rows.map(r => r.contact_id).filter((v): v is string => typeof v === 'string' && !!v))]
  if (!ids.length) return true
  const { count } = await ctx.admin.from('affair_contacts').select('id', { count: 'exact', head: true }).eq('owner_id', ctx.ownerId).in('id', ids)
  return count === ids.length
}

export async function GET(req: NextRequest, { params }: Params) {
  const { kind } = await params
  const g = await guard(kind)
  if (g.error) return g.error
  const { spec, ctx } = g
  let q = ctx.admin.from(spec.table).select('*').eq('owner_id', ctx.ownerId)
  const contactId = req.nextUrl.searchParams.get('contact_id')
  if (contactId && 'contact_id' in spec.fields) q = q.eq('contact_id', contactId)
  const { data, error } = await q.order(spec.order.column, { ascending: spec.order.ascending }).limit(2000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { kind } = await params
  const g = await guard(kind)
  if (g.error) return g.error
  const { spec, ctx } = g
  const body = await req.json().catch(() => ({}))
  const rows = Array.isArray(body.items) ? body.items : [body]
  const clean: Record<string, unknown>[] = []
  for (const r of rows.slice(0, 200)) {
    const c = cleanRecord(kind, r ?? {}, false)
    if (typeof c === 'string') return NextResponse.json({ error: `缺少必填欄位：${c}` }, { status: 400 })
    clean.push({ ...c, owner_id: ctx.ownerId })
  }
  if (!(await contactsOwned(ctx, clean))) return NextResponse.json({ error: '找不到聯絡人' }, { status: 400 })
  const { data, error } = await ctx.admin.from(spec.table).insert(clean).select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (kind === 'logs') {
    // 更新聯絡人的最後聯繫日
    for (const l of data ?? []) {
      await ctx.admin.from('affair_contacts')
        .update({ last_contact_at: l.log_date, updated_at: new Date().toISOString() })
        .eq('id', l.contact_id).eq('owner_id', ctx.ownerId)
        .or(`last_contact_at.is.null,last_contact_at.lt.${l.log_date}`)
    }
  }
  return NextResponse.json({ items: data ?? [] })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { kind } = await params
  const g = await guard(kind)
  if (g.error) return g.error
  const { spec, ctx } = g
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  const c = cleanRecord(kind, body, true)
  if (typeof c === 'string') return NextResponse.json({ error: `缺少必填欄位：${c}` }, { status: 400 })
  if (!(await contactsOwned(ctx, [c]))) return NextResponse.json({ error: '找不到聯絡人' }, { status: 400 })
  if (spec.hasUpdatedAt) c.updated_at = new Date().toISOString()
  const { data, error } = await ctx.admin.from(spec.table).update(c).eq('id', id).eq('owner_id', ctx.ownerId).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ item: data })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { kind } = await params
  const g = await guard(kind)
  if (g.error) return g.error
  const { spec, ctx } = g
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  const { error } = await ctx.admin.from(spec.table).delete().eq('id', id).eq('owner_id', ctx.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
