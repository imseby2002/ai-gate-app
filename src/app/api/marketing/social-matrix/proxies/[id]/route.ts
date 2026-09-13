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
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  try {
    const supabase = await createClient()
    await supabase.from('marketing_proxies').delete().eq('id', id)
  } catch (err) {
    console.warn('[proxies delete] db error:', err)
  }

  StorageService.deleteProxy(id)
  return NextResponse.json({ success: true, id })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getCronOrUserAuth(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  try {
    const supabase = await createClient()
    await supabase.from('marketing_proxies').update(body).eq('id', id)
  } catch (err) {
    console.warn('[proxies patch] db error:', err)
  }

  const updated = StorageService.updateProxy(id, body)
  return NextResponse.json({ success: true, proxy: updated })
}
