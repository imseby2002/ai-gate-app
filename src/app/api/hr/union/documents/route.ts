import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getUnitContext } from '@/lib/auth/unit-access'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'affair-docs' // reuse documents bucket or hr bucket

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

export async function GET(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const sp = new URL(req.url).searchParams
  const category = sp.get('category')

  let q = supabase.from('hr_union_documents').select('*').eq('owner_id', user.id)
  if (category) q = q.eq('doc_category', category)

  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ documents: [] })

  const admin = createAdminClient()
  const documents = await Promise.all((data ?? []).map(async d => {
    let url = ''
    if (d.storage_path) {
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(d.storage_path, 3600)
      url = signed?.signedUrl ?? ''
    }
    return { ...d, url }
  }))

  return NextResponse.json({ documents })
}

export async function POST(req: NextRequest) {
  const { user, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const admin = createAdminClient()

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })

  const title = String(form.get('title') ?? '').trim()
  const doc_category = String(form.get('doc_category') ?? 'tuldtt').trim()
  const effective_date = form.get('effective_date') ? String(form.get('effective_date')) : null
  const expiry_date = form.get('expiry_date') ? String(form.get('expiry_date')) : null
  const notes = String(form.get('notes') ?? '').trim()
  const file = form.get('file')

  let storage_path = '', file_name = ''
  if (file instanceof File && file.size > 0) {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
    const path = `union/${user.id}/${doc_category}-${randomUUID()}${ext ? '.' + ext : ''}`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType: file.type || 'application/pdf',
      upsert: false,
    })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    storage_path = path
    file_name = file.name
  }

  const { data, error } = await admin.from('hr_union_documents').insert({
    owner_id: user.id,
    doc_category,
    title: title || file_name || 'Tài liệu công đoàn',
    effective_date,
    expiry_date,
    storage_path,
    file_name,
    notes,
  }).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ document: data })
}
