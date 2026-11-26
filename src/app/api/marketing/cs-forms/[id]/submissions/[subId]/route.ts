/**
 * PATCH /api/marketing/cs-forms/[id]/submissions/[subId]  body: { paid: boolean }
 * 需收費的表單（例如賞鯨行程）：專員確認收到款項後標記已付，或改回未付
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string; subId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, subId } = await params
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: form } = await supabase
    .from('cs_forms').select('id').eq('id', id).eq('user_id', ctx.ownerId).maybeSingle()
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const paid_at = body.paid ? new Date().toISOString() : null
  // 提交紀錄只有 SELECT 的 RLS；上面已確認表單屬於這個商家，更新用 service client 並鎖定 form_id
  const { data, error } = await createAdminClient()
    .from('cs_form_submissions')
    .update({ paid_at })
    .eq('id', subId).eq('form_id', id)
    .select('id, paid_at')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ paid_at: data.paid_at })
}
