import { NextRequest, NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ctx = await getUnitContextAny(['finance', 'store'])
  if (!ctx.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file 必填' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `bills/${ctx.ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const buckets = ['marketing-assets', 'pos-menu']
  let uploadErr: string | null = null
  let successfulBucket = ''

  for (const b of buckets) {
    const { error } = await ctx.admin.storage.from(b).upload(fileName, buf, {
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

  const { data: pub } = ctx.admin.storage.from(successfulBucket).getPublicUrl(fileName)
  return NextResponse.json({ url: pub.publicUrl })
}
