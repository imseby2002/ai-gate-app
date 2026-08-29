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
  platform: 'line' | 'email' | 'webhook' | 'telegram' | ''
  to: string            // LINE：使用者或群組 id；email：收件地址；webhook：目標網址（例如既有的 Google Apps Script）；telegram：Chat ID（個人或群組）
  batchMode: 'daily' | 'immediate'
  batchTime: string      // HH:MM，batchMode=daily 時使用
  lineToken?: string     // LINE 專用，選填：這個表單要用哪一個 OA 帳號發送，不同於平台分頁預設的 OA；留空則用平台分頁設定的憑證
  telegramBotToken?: string  // Telegram 專用，選填：這個表單要用哪一個 Bot 發送；留空則用平台分頁設定的預設 Bot
}

// 0=週日...6=週六（JS Date.getDay() 慣例）。需要「某幾天不開放」時，就把那幾天從這裡拿掉；
// 需要「不同天用不同通知對象」時，建立多個表單、各自設定不同的開放星期＋通知對象即可，
// 不用在單一表單裡塞日期分流邏輯。
export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

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
  const { name, fields, triggerKeywords = '', notifyTarget, industry = 'homestay', availableWeekdays, confirmBeforeFields } = body

  if (!name?.trim()) return NextResponse.json({ error: '表單名稱不可為空' }, { status: 400 })
  if (!Array.isArray(fields) || !fields.length) return NextResponse.json({ error: '至少需要一個欄位' }, { status: 400 })
  const weekdays = Array.isArray(availableWeekdays) && availableWeekdays.length ? availableWeekdays : ALL_WEEKDAYS

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
      available_weekdays: weekdays,
      confirm_before_fields: confirmBeforeFields !== false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ form: data })
}
