/**
 * GET /api/cron/prospect
 * Vercel Cron — 每小時檢查並執行到期的潛在客戶排程
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function computeNextRun(s: {
  frequency: 'daily' | 'weekly' | 'monthly'
  hour: number; minute: number
  weekday?: number; monthDay?: number
}): Date {
  const now = new Date()
  const next = new Date(now)
  next.setSeconds(0, 0)
  next.setMinutes(s.minute ?? 0)
  next.setHours(s.hour ?? 8)
  if (s.frequency === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1)
  } else if (s.frequency === 'weekly') {
    const target = s.weekday ?? 1
    const diff = (target - next.getDay() + 7) % 7 || 7
    next.setDate(next.getDate() + diff)
    if (next <= now) next.setDate(next.getDate() + 7)
  } else if (s.frequency === 'monthly') {
    const d = s.monthDay ?? 1
    next.setDate(d)
    if (next <= now) { next.setMonth(next.getMonth() + 1); next.setDate(d) }
  }
  return next
}

async function sendTelegram(botToken: string, chatId: string, message: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    })
  } catch { /* silent */ }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServiceClient()
  const baseUrl  = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
  const now      = new Date()

  const { data: rows, error } = await supabase
    .from('prospect_schedules')
    .select('id, user_id, config, schedule')

  if (error || !rows) return NextResponse.json({ ok: false, error: error?.message })

  const ran: string[] = []
  const skipped: string[] = []

  for (const row of rows) {
    const sched = row.schedule as {
      enabled?: boolean
      frequency?: 'daily' | 'weekly' | 'monthly'
      hour?: number; minute?: number
      weekday?: number; monthDay?: number
      nextRunAt?: string; lastRunAt?: string
    }

    if (!sched?.enabled) { skipped.push(row.id); continue }

    const nextRun = sched.nextRunAt ? new Date(sched.nextRunAt) : new Date(0)
    if (nextRun > now) { skipped.push(row.id); continue }

    ran.push(row.id)

    // Get telegram settings
    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('id', row.user_id)
      .single()

    const botToken = profile?.telegram_bot_token ?? ''
    const chatId   = profile?.telegram_chat_id ?? ''

    if (botToken && chatId) {
      await sendTelegram(botToken, chatId,
        `🤖 <b>潛在客戶排程啟動</b>\n時間：${now.toLocaleString('zh-TW')}\n關鍵字：${(row.config as Record<string,string>)?.keywords ?? ''}\n\n正在蒐集並篩選中…`)
    }

    // ── Step 1: collect ──────────────────────────────────────────────────────
    const cfg = (row.config ?? {}) as Record<string, unknown>
    const sources = (cfg.sources as string[]) ?? ['map']

    const sourceToTypes: Record<string, string> = {
      map: 'map', facebook: 'facebook', instagram: 'instagram',
      tiktok: 'tiktok', youtube: 'youtube', threads: 'threads',
      amazon: 'amazon', shopee: 'shopee', ios_android: 'ios_android', web: 'web',
    }
    const types = sources.map((s: string) => sourceToTypes[s]).filter(Boolean)

    const subOptions: Record<string, string[]> = {}
    if (sources.includes('map'))         subOptions.map         = ['info', 'coordinates']
    if (sources.includes('facebook'))    subOptions.facebook    = ['vendor_info', 'posts']
    if (sources.includes('instagram'))   subOptions.instagram   = ['vendor_info', 'posts']
    if (sources.includes('tiktok'))      subOptions.tiktok      = ['vendor_info', 'videos']
    if (sources.includes('youtube'))     subOptions.youtube     = ['vendor_info', 'videos']
    if (sources.includes('threads'))     subOptions.threads     = ['vendor_info', 'posts']
    if (sources.includes('amazon'))      subOptions.amazon      = ['vendor_info', 'products']
    if (sources.includes('shopee'))      subOptions.shopee      = ['vendor_info', 'products']
    if (sources.includes('ios_android')) subOptions.ios_android = ['vendor_info', 'reviews']

    let rawText = ''
    let orgs: unknown[] = []
    let collectOk = false

    try {
      const collectRes = await fetch(`${baseUrl}/api/marketing/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Cron-Secret': cronSecret ?? '' },
        body: JSON.stringify({
          types, subOptions,
          keywords: cfg.keywords ?? '',
          location: cfg.location ?? '',
          limit: 20,
        }),
      })
      const collectData = await collectRes.json()
      if (collectRes.ok) {
        rawText = collectData.result || collectData.summary || ''
        collectOk = true
      }
    } catch { /* skip */ }

    // ── Step 2: filter ───────────────────────────────────────────────────────
    if (collectOk && rawText) {
      try {
        const filterRes = await fetch(`${baseUrl}/api/marketing/prospect-filter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Cron-Secret': cronSecret ?? '' },
          body: JSON.stringify({
            rawText,
            filterCriteria: cfg.filterCriteria ?? '',
            minEmployees:   cfg.minEmployees ?? 0,
            maxDistanceKm:  cfg.maxDistanceKm ?? 0,
            branches:       [],
          }),
        })
        const filterData = await filterRes.json()
        if (filterRes.ok) orgs = filterData.orgs ?? []
      } catch { /* skip */ }
    }

    // ── Save result & update schedule ────────────────────────────────────────
    const newNextRun = computeNextRun({
      frequency: sched.frequency ?? 'daily',
      hour:      sched.hour ?? 8,
      minute:    sched.minute ?? 0,
      weekday:   sched.weekday,
      monthDay:  sched.monthDay,
    })

    const selected = (orgs as Array<{ selected?: boolean }>).filter(o => o.selected)

    await supabase
      .from('prospect_schedules')
      .update({
        last_result: { orgs, runAt: now.toISOString(), total: orgs.length, selected: selected.length },
        schedule: { ...sched, lastRunAt: now.toISOString(), nextRunAt: newNextRun.toISOString() },
      })
      .eq('id', row.id)

    if (botToken && chatId) {
      await sendTelegram(botToken, chatId,
        `✅ <b>潛在客戶排程完成</b>\n\n關鍵字：${cfg.keywords ?? ''}\n蒐集：${orgs.length} 家 → 入選 <b>${selected.length}</b> 家\n下次執行：${newNextRun.toLocaleString('zh-TW')}\n\n請至「潛在客戶行銷」查看結果。`)
    }
  }

  return NextResponse.json({ ok: true, ran: ran.length, skipped: skipped.length, timestamp: now.toISOString() })
}
