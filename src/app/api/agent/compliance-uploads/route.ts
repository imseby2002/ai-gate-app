import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasModuleAccess } from '@/lib/module-access'

// 手動上傳門市影像（真人先用這支測試，之後現場裝置也走同一支 API 銜接，不需重做）。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await hasModuleAccess(supabase, user.id, 'agent')) {
    return NextResponse.json({ error: '尚未開通 Agent 模組' }, { status: 403 })
  }

  const { imageBase64, mimeType, storeName } = await req.json()
  if (!imageBase64) return NextResponse.json({ error: 'imageBase64 required' }, { status: 400 })

  const admin = await createAdminClient()
  const ext = (mimeType as string | undefined)?.split('/')[1] ?? 'jpg'
  const path = `${user.id}/${Date.now()}.${ext}`
  const bytes = Buffer.from(imageBase64, 'base64')

  const { error: uploadErr } = await admin.storage
    .from('compliance-uploads')
    .upload(path, bytes, { contentType: mimeType ?? 'image/jpeg', upsert: false })
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: urlData } = admin.storage.from('compliance-uploads').getPublicUrl(path)

  const { data, error } = await admin
    .from('agent_compliance_uploads')
    .insert({
      user_id: user.id,
      store_name: storeName ?? null,
      image_url: urlData.publicUrl,
      source: 'manual',
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ upload: data })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await hasModuleAccess(supabase, user.id, 'agent')) {
    return NextResponse.json({ error: '尚未開通 Agent 模組' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('agent_compliance_uploads')
    .select('*')
    .eq('user_id', user.id)
    .order('uploaded_at', { ascending: false })
    .limit(30)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ uploads: data })
}
