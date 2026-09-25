import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import { StorageService } from '@/lib/social-matrix/storage'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const authUser = guard.user

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  try {
    const body = await req.json()

    try {
      const supabase = await createClient()
      await supabase
        .from('marketing_official_proxies')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
    } catch (err) {
      console.warn('[official-proxies PATCH] DB error:', err)
    }

    const updated = StorageService.updateOfficialProxy(id, body)
    return NextResponse.json({ success: true, official_proxy: updated })
  } catch (err) {
    return NextResponse.json({ error: `更新失敗: ${String(err)}` }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const authUser = guard.user

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  try {
    try {
      const supabase = await createClient()
      await supabase.from('marketing_official_proxies').delete().eq('id', id)
    } catch (err) {
      console.warn('[official-proxies DELETE] DB error:', err)
    }

    StorageService.deleteOfficialProxy(id)
    return NextResponse.json({ success: true, id, message: '已成功自官方租賃庫存下架該 IP' })
  } catch (err) {
    return NextResponse.json({ error: `刪除失敗: ${String(err)}` }, { status: 500 })
  }
}
