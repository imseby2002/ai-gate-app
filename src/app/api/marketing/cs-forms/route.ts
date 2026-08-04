/**
 * GET  /api/marketing/cs-forms?industry=homestay   — 列出這個商家的自建表單
 * POST /api/marketing/cs-forms                      — 新增表單
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

export interface CsFormField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'radio' | 'number'
  options?: string[]
  required: boolean
}

export interface CsFormNotifyTarget {
  platform: 'line' | 'email' | 'webhook' | ''
  to: string            // LINE：使用者或群組 id；email：收件地址；webhook：目標網址（例如既有的 Google Apps Script）
  batchMode: 'daily' | 'immediate'
  batchTime: string      // HH:MM，batchMode=daily 時使用
}

function randomSlug(): string {
  return Math.random().toString(36).slice(2, 10)
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const industry = req.nextUrl.searchParams.get('industry') ?? 'homestay'

  const { data, error } = await supabase
    .from('cs_forms')
    .select('*')
    .eq('user_id', ctx.ownerId)
    .eq('industry', industry)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ forms: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, fields, triggerKeywords = '', notifyTarget, industry = 'homestay' } = body

  if (!name?.trim()) return NextResponse.json({ error: '表單名稱不可為空' }, { status: 400 })
  if (!Array.isArray(fields) || !fields.length) return NextResponse.json({ error: '至少需要一個欄位' }, { status: 400 })

  // slug 撞號機率極低，仍保留重試
  let slug = randomSlug()
  for (let i = 0; i < 3; i++) {
    const { data: existing } = await supabase.from('cs_forms').select('id').eq('slug', slug).maybeSingle()
    if (!existing) break
    slug = randomSlug()
  }

  const { data, error } = await supabase
    .from('cs_forms')
    .insert({
      user_id: ctx.ownerId,
      industry,
      name: name.trim(),
      slug,
      fields,
      trigger_keywords: triggerKeywords,
      notify_target: notifyTarget ?? {},
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ form: data })
}
