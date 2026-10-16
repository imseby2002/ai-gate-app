/**
 * GET    /api/knowledge/[id] — 讀取知識全文（全公司成員）
 * PATCH  /api/knowledge/[id] — 修改標題、部門、內容（可管理該部門者）
 * DELETE /api/knowledge/[id]
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDeptAccess, canManageDept, type DeptAccess } from '@/lib/company/dept-access'

export const dynamic = 'force-dynamic'

async function load(access: DeptAccess, id: string) {
  const { data } = await access.admin.from('knowledge_docs')
    .select('id, department, title, source_type, file_name, content, char_count, created_at, updated_at')
    .eq('id', id).eq('company_id', access.companyId).maybeSingle()
  return data
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })
  const doc = await load(access, (await params).id)
  if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ doc: { ...doc, editable: canManageDept(access, doc.department as string) } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })
  const id = (await params).id
  const doc = await load(access, id)
  if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!canManageDept(access, doc.department as string)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null) as { title?: unknown; department?: unknown; content?: unknown } | null
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body?.title === 'string' && body.title.trim()) patch.title = body.title.trim().slice(0, 200)
  if (typeof body?.department === 'string' && body.department) {
    if (!canManageDept(access, body.department)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    patch.department = body.department
  }
  if (typeof body?.content === 'string') {
    const content = body.content.trim().slice(0, 500_000)
    if (!content) return NextResponse.json({ error: 'empty' }, { status: 400 })
    patch.content = content
    patch.char_count = content.length
  }
  const { error } = await access.admin.from('knowledge_docs').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })
  const id = (await params).id
  const doc = await load(access, id)
  if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!canManageDept(access, doc.department as string)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { error } = await access.admin.from('knowledge_docs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
