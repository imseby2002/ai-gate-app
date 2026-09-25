import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import { StorageService } from '@/lib/social-matrix/storage'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const authUser = guard.user

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing Lease ID' }, { status: 400 })

  try {
    try {
      const supabase = await createClient()
      await supabase
        .from('marketing_proxy_leases')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', authUser.id)
    } catch (err) {
      console.warn('[lease cancel] DB error:', err)
    }

    StorageService.releaseOfficialProxy(authUser.id, id)
    return NextResponse.json({ success: true, message: '已成功解除該官方 IP 租用，並自代理池移除！' })
  } catch (err) {
    return NextResponse.json({ error: `退租失敗: ${String(err)}` }, { status: 500 })
  }
}
