import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getUnitContext } from '@/lib/auth/unit-access'
import { AFFAIR_BUCKET, IMAGE_DOC_TYPES, docImages, type DocImage } from '@/lib/affairs/doc-images'

const MAX_SIZE = 20 * 1024 * 1024
const MAX_IMAGES = 20

async function loadDoc(id: string) {
  const ctx = await getUnitContext('affairs')
  if (!ctx.ok) return { ctx, doc: null }
  const { data: doc } = await ctx.admin.from('affair_documents')
    .select('id, doc_type, ai_extracted').eq('id', id).eq('owner_id', ctx.ownerId).maybeSingle()
  return { ctx, doc }
}

// 補傳證件圖片（multipart：id ＋ files[]）
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: '格式錯誤' }, { status: 400 })
  const id = String(form.get('id') ?? '').trim()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { ctx, doc } = await loadDoc(id)
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  if (!doc) return NextResponse.json({ error: '找不到文件' }, { status: 404 })
  if (!IMAGE_DOC_TYPES.has(doc.doc_type)) return NextResponse.json({ error: '此類文件不支援圖片存檔' }, { status: 400 })

  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (!files.length) return NextResponse.json({ error: '請選擇圖片' }, { status: 400 })
  const current = docImages(doc.ai_extracted)
  if (current.length + files.length > MAX_IMAGES) return NextResponse.json({ error: `每份文件最多 ${MAX_IMAGES} 張` }, { status: 400 })

  const added: DocImage[] = []
  for (const file of files) {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') return NextResponse.json({ error: `${file.name} 不是圖片或 PDF` }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: `${file.name} 超過 20MB` }, { status: 400 })
    const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
    const path = `${ctx.ownerId}/img-${doc.id}-${randomUUID()}${ext ? '.' + ext : ''}`
    const { error } = await ctx.admin.storage.from(AFFAIR_BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
    if (error) {
      if (added.length) await ctx.admin.storage.from(AFFAIR_BUCKET).remove(added.map(a => a.path))
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    added.push({ path, name: file.name, mime: file.type, uploaded_at: new Date().toISOString() })
  }

  const ext = { ...((doc.ai_extracted as Record<string, unknown>) ?? {}), images: [...current, ...added] }
  const { error } = await ctx.admin.from('affair_documents')
    .update({ ai_extracted: ext, updated_at: new Date().toISOString() }).eq('id', doc.id).eq('owner_id', ctx.ownerId)
  if (error) {
    await ctx.admin.storage.from(AFFAIR_BUCKET).remove(added.map(a => a.path))
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, count: current.length + added.length })
}

// 刪除單張圖片。body: { id, path }
export async function DELETE(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const id = String(b.id ?? '').trim()
  const path = String(b.path ?? '').trim()
  if (!id || !path) return NextResponse.json({ error: 'id/path required' }, { status: 400 })
  const { ctx, doc } = await loadDoc(id)
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  if (!doc) return NextResponse.json({ error: '找不到文件' }, { status: 404 })
  const current = docImages(doc.ai_extracted)
  if (!current.some(i => i.path === path)) return NextResponse.json({ error: '找不到圖片' }, { status: 404 })

  const ext = { ...((doc.ai_extracted as Record<string, unknown>) ?? {}), images: current.filter(i => i.path !== path) }
  const { error } = await ctx.admin.from('affair_documents')
    .update({ ai_extracted: ext, updated_at: new Date().toISOString() }).eq('id', doc.id).eq('owner_id', ctx.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await ctx.admin.storage.from(AFFAIR_BUCKET).remove([path]).catch(() => {})
  return NextResponse.json({ ok: true })
}
