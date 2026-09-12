import { NextRequest, NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let ownerId: string | null = null
  let adminClient: any = null

  const ctx = await getUnitContextAny(['finance', 'store'])
  if (ctx.ok) {
    ownerId = ctx.ownerId
    adminClient = ctx.admin
  } else {
    // 支援公用事業廠商／瓦斯廠商透過 fill_token 上傳單據憑證
    const sp = new URL(req.url).searchParams
    const token = sp.get('token') || req.headers.get('x-vendor-token')
    if (token) {
      const admin = createAdminClient()
      const { data: v } = await admin.from('fin_vendors').select('owner_id, active').eq('fill_token', token).single()
      if (v && v.active) {
        ownerId = v.owner_id
        adminClient = admin
      }
    }
  }

  if (!ownerId || !adminClient) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file 必填' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `bills/${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const buckets = ['marketing-assets', 'pos-menu']
  let uploadErr: string | null = null
  let successfulBucket = ''

  for (const b of buckets) {
    const { error } = await adminClient.storage.from(b).upload(fileName, buf, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    })
    if (!error) {
      successfulBucket = b
      uploadErr = null
      break
    } else {
      uploadErr = error.message
    }
  }

  if (!successfulBucket) {
    return NextResponse.json({ error: uploadErr || 'Upload failed' }, { status: 500 })
  }

  const { data: pub } = adminClient.storage.from(successfulBucket).getPublicUrl(fileName)
  return NextResponse.json({ url: pub.publicUrl })
}
