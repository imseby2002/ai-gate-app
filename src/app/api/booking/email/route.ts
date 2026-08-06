import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { getBookingEntitlements } from '@/lib/booking/entitlements'
import { encryptSecret } from '@/lib/crypto/secret'

const SAFE_COLS = 'id,email_address,imap_host,imap_port,imap_folder,cancel_folder,sync_enabled,last_synced_at,last_sync_count,last_sync_error,property_id'

export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: settings } = await supabase
    .from('email_settings')
    .select('id,email_address,imap_host,imap_port,imap_folder,cancel_folder,sync_enabled,last_synced_at,last_sync_count,last_sync_error,property_id,properties(name)')
    .eq('user_id', ctx.ownerId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ settings: settings ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Email 同步為 CORE 以上方案功能
  const { features } = await getBookingEntitlements(supabase, ctx.ownerId)
  if (!features.emailSync) {
    return NextResponse.json({ error: '目前方案不支援 Email 同步，請升級方案。' }, { status: 403 })
  }

  const body = await req.json()
  if (!body.property_id) body.property_id = null
  // 密碼存前加密；沒填就不寫入
  if (body.imap_password) body.imap_password = encryptSecret(body.imap_password)
  else delete body.imap_password
  const { data: setting, error } = await supabase
    .from('email_settings')
    .insert({ ...body, user_id: ctx.ownerId })
    .select(SAFE_COLS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ setting })
}

export async function PUT(req: Request) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  if (!updates.property_id) updates.property_id = null
  // 密碼有填才更新並加密；留空＝沿用原密碼
  if (updates.imap_password) updates.imap_password = encryptSecret(updates.imap_password)
  else delete updates.imap_password

  // 換了資料夾/標籤等於換了另一個 UID 空間，沿用舊的 last_synced_uid 會誤判新信箱裡
  // UID 較小的信「已經處理過」而漏抓；換資料夾時一併重置，讓它從頭掃描新資料夾。
  if ('imap_folder' in updates) {
    const { data: before } = await supabase
      .from('email_settings')
      .select('imap_folder')
      .eq('id', id).eq('user_id', ctx.ownerId)
      .maybeSingle()
    if (before && before.imap_folder !== updates.imap_folder) {
      updates.last_synced_at = null
      updates.last_synced_uid = null
    }
  }

  const { data: setting, error } = await supabase
    .from('email_settings')
    .update(updates)
    .eq('id', id).eq('user_id', ctx.ownerId)
    .select(SAFE_COLS).single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ setting })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await supabase.from('email_settings').delete().eq('id', id).eq('user_id', ctx.ownerId)
  return NextResponse.json({ ok: true })
}
