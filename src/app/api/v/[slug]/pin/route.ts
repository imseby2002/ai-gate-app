import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { companyFromHost } from '@/lib/company/fromHost'
import { hashPin, verifySession } from '@/lib/hr/portal'
import { VENDOR_COOKIE } from '@/lib/fin/vendor-portal'

// POST { pin }：廠商登入後自行變更密碼（至少 6 碼）
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const company = await companyFromHost(req.headers.get('host') ?? '')
  const vid = verifySession(req.cookies.get(VENDOR_COOKIE)?.value, 'vendor')
  if (!company || !vid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { pin } = await req.json().catch(() => ({}))
  const p = String(pin ?? '').trim()
  if (p.length < 6) return NextResponse.json({ error: '密碼至少 6 碼' }, { status: 400 })
  const admin = createAdminClient()
  const { data, error } = await admin.from('fin_vendors')
    .update({ pin_hash: hashPin(p), pin_failed: 0, pin_locked_until: null })
    .eq('id', vid).eq('owner_id', company.ownerId).eq('link_slug', slug).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ ok: true })
}
