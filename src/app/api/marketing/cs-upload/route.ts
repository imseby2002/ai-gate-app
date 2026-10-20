/**
 * POST /api/marketing/cs-upload
 * 收件匣真人要傳給客人的圖片：存到私有 bucket cs-media，回傳路徑，由 cs-send 送出時再產生簽名網址。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

const MAX_BYTES = 5 * 1024 * 1024

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file')
  const to = String(form.get('to') ?? '')
  if (!(file instanceof Blob) || !to) return NextResponse.json({ error: '缺少圖片或收件人' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: '只能上傳圖片' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: '圖片太大（上限 5MB）' }, { status: 400 })

  const ext = file.type.includes('png') ? 'png' : 'jpg'
  const path = `${ctx.ownerId}/${to.replace(/[^\w-]/g, '_')}/out-${Date.now()}-${crypto.randomUUID()}.${ext}`
  const admin = await createAdminClient()
  const buf = Buffer.from(await file.arrayBuffer())
  let { error } = await admin.storage.from('cs-media').upload(path, buf, { contentType: file.type })
  if (error && /not found/i.test(error.message)) {
    await admin.storage.createBucket('cs-media', { public: false })
    ;({ error } = await admin.storage.from('cs-media').upload(path, buf, { contentType: file.type }))
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ path })
}
