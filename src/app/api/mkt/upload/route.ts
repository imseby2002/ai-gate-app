import { NextRequest, NextResponse } from 'next/server'
import { marketingCompany } from '@/lib/marketing/company'

export async function POST(req: NextRequest) {
  const c = await marketingCompany()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file 必填' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `mkt-assets/${c.ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  // 優先嘗試 marketing-assets，失敗則 fallback 到 pos-menu
  let uploadErr = null
  let bucket = 'marketing-assets'
  const { error: err1 } = await c.admin.storage.from(bucket).upload(fileName, buf, {
    contentType: file.type || 'image/jpeg',
    upsert: true,
  })

  if (err1) {
    bucket = 'pos-menu'
    const { error: err2 } = await c.admin.storage.from(bucket).upload(fileName, buf, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    })
    if (err2) uploadErr = err2.message
  }

  if (uploadErr) return NextResponse.json({ error: uploadErr }, { status: 500 })

  const { data: pub } = c.admin.storage.from(bucket).getPublicUrl(fileName)
  return NextResponse.json({ url: pub.publicUrl })
}
