import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file 必填' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `proposals/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const admin = createAdminClient()
  const buckets = ['marketing-assets', 'pos-menu']
  let uploadErr: string | null = null
  let successfulBucket = ''

  for (const b of buckets) {
    const { error } = await admin.storage.from(b).upload(fileName, buf, {
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

  const { data: publicUrlData } = admin.storage.from(successfulBucket).getPublicUrl(fileName)
  return NextResponse.json({ url: publicUrlData.publicUrl })
}
