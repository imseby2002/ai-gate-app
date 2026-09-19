import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCronOrUserAuth } from '@/lib/cron-auth'
import { StorageService } from '@/lib/social-matrix/storage'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getCronOrUserAuth(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
