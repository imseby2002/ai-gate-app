/**
 * DELETE /api/marketing/delete-asset
 * Body: { url: string }  — Supabase public URL
 * 從 marketing-assets bucket 刪除對應檔案
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'url 必填' }, { status: 400 })

  // 從 public URL 提取 storage path
  // 格式: .../storage/v1/object/public/marketing-assets/{path}
  const marker = '/marketing-assets/'
  const idx = url.indexOf(marker)
  if (idx === -1) return NextResponse.json({ error: '非 marketing-assets 的 URL' }, { status: 400 })

  const filePath = decodeURIComponent(url.slice(idx + marker.length).split('?')[0])

  // 安全性：只允許刪除自己的檔案
  if (!filePath.startsWith(user.id + '/')) {
    return NextResponse.json({ error: '無權限刪除此檔案' }, { status: 403 })
  }

  const { error } = await supabase.storage.from('marketing-assets').remove([filePath])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, deleted: filePath })
}
