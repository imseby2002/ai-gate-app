/**
 * GET /api/marketing/cs-forms/[id]/submissions — 這張表單的提交紀錄（不分來源：公開頁面／CS 對話）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 確認表單屬於這個商家，避免用別人的 form id 偷看提交紀錄
  const { data: form } = await supabase
    .from('cs_forms').select('id').eq('id', id).eq('user_id', ctx.ownerId).maybeSingle()
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '100'), 500)
  const { data, error } = await supabase
    .from('cs_form_submissions')
    .select('*')
    .eq('form_id', id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submissions: data ?? [] })
}
