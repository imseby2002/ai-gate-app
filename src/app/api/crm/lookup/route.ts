import { NextRequest, NextResponse } from 'next/server'
import { getCrmUser } from '@/lib/crm/auth'
import { normalizeIdentity } from '@/lib/crm/normalize'

// GET /api/crm/lookup?kind=line&value=Uxxxx → 用 LINE / WhatsApp / 電話 / Email 直接查出客人完整資料
export async function GET(req: NextRequest) {
  const auth = await getCrmUser()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth
  const kind = req.nextUrl.searchParams.get('kind') ?? ''
  const value = normalizeIdentity(kind, req.nextUrl.searchParams.get('value'))
  if (!kind || !value) return NextResponse.json({ error: '缺少 kind 或 value' }, { status: 400 })

  const { data: ident } = await supabase.from('crm_identities').select('contact_id').eq('owner_id', user.id).eq('kind', kind).eq('value', value).maybeSingle()
  if (!ident) return NextResponse.json({ found: false })
  const [{ data: contact }, { data: identities }, { data: activities }] = await Promise.all([
    supabase.from('crm_contacts').select('*').eq('id', ident.contact_id).single(),
    supabase.from('crm_identities').select('kind, value, label').eq('contact_id', ident.contact_id),
    supabase.from('crm_activities').select('source, kind, title, amount, status, occurred_at').eq('contact_id', ident.contact_id).order('occurred_at', { ascending: false }).limit(50),
  ])
  return NextResponse.json({ found: true, contact, identities: identities ?? [], activities: activities ?? [] })
}
