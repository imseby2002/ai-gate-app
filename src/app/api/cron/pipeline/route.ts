/**
 * GET /api/cron/pipeline
 * Vercel Cron Job — 每小時執行，檢查並觸發排程 Pipeline
 *
 * Vercel 呼叫時會帶 Authorization: Bearer CRON_SECRET
 * 設定：vercel.json crons + env CRON_SECRET
 *
 * 流程：
 *   1. 找出所有 _schedule.enabled=true 且到期的活動
 *   2. 對每個活動，依序呼叫各 Unit API（使用 service role token）
 *   3. 完成後發送 Telegram 通知
 *   4. 更新 lastRunAt / nextRunAt
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ── Supabase service role (no cookie needed) ──────────────────────────────────
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── Compute next run time ─────────────────────────────────────────────────────
function computeNextRun(schedule: {
  frequency: 'daily' | 'weekly' | 'monthly'
  hour: number
  minute: number
  weekday?: number
  monthDay?: number
}): Date {
  const now = new Date()
  const next = new Date(now)
  next.setSeconds(0, 0)
  next.setMinutes(schedule.minute)
  next.setHours(schedule.hour)

  if (schedule.frequency === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1)
  } else if (schedule.frequency === 'weekly') {
    const targetDay = schedule.weekday ?? 1
    const diff = (targetDay - next.getDay() + 7) % 7 || 7
    next.setDate(next.getDate() + diff)
    if (next <= now) next.setDate(next.getDate() + 7)
  } else if (schedule.frequency === 'monthly') {
    const targetDate = schedule.monthDay ?? 1
    next.setDate(targetDate)
    if (next <= now) {
      next.setMonth(next.getMonth() + 1)
      next.setDate(targetDate)
    }
  }
  return next
}

// ── Telegram notification ─────────────────────────────────────────────────────
async function sendTelegram(botToken: string, chatId: string, message: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    })
  } catch (_) { /* silent */ }
}

// ── Call a unit API with service token ────────────────────────────────────────
async function callUnitApi(
  path: string,
  body: Record<string, unknown>,
  serviceToken: string,
  baseUrl: string,
): Promise<{ ok: boolean; data: unknown; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': serviceToken,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return { ok: res.ok, data, error: res.ok ? undefined : (data as Record<string, string>).error }
  } catch (e) {
    return { ok: false, data: null, error: String(e) }
  }
}

// ── Main Cron Handler ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServiceClient()
  const baseUrl  = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
  const now      = new Date()

  // ── Find due campaigns ─────────────────────────────────────────────────────
  const { data: campaigns, error } = await supabase
    .from('marketing_campaigns')
    .select('id, title, user_id, unit_data')
    .not('unit_data->_schedule', 'is', null)

  if (error || !campaigns) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'DB error' })
  }

  const ran: string[] = []
  const skipped: string[] = []

  for (const campaign of campaigns) {
    const unitData = (campaign.unit_data ?? {}) as Record<string, unknown>
    const sched = unitData['_schedule'] as {
      enabled?: boolean
      frequency?: 'daily' | 'weekly' | 'monthly'
      hour?: number
      minute?: number
      weekday?: number
      monthDay?: number
      nextRunAt?: string
      lastRunAt?: string
      steps?: { unitId: number; enabled: boolean; notify: boolean }[]
      config?: Record<string, unknown>
    } | undefined

    if (!sched?.enabled) { skipped.push(campaign.id); continue }

    // Check if due
    const nextRun = sched.nextRunAt ? new Date(sched.nextRunAt) : new Date(0)
    if (nextRun > now) { skipped.push(campaign.id); continue }

    ran.push(campaign.id)
    const log: string[] = [`⚡ 活動「${campaign.title}」排程執行開始`]

    // Get user's Telegram settings
    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('id', campaign.user_id)
      .single()

    const botToken = profile?.telegram_bot_token ?? ''
    const chatId   = profile?.telegram_chat_id ?? ''

    // Notify start
    if (botToken && chatId) {
      await sendTelegram(botToken, chatId,
        `🤖 <b>AI GATE 排程流程啟動</b>\n\n活動：${campaign.title}\n時間：${now.toLocaleString('zh-TW')}\n\n正在自動執行中，完成後將通知您。`)
    }

    // ── Run enabled steps ──────────────────────────────────────────────────
    const steps = sched.steps ?? []
    const cfg   = (sched.config ?? {}) as Record<string, unknown>
    let ud = { ...unitData }

    for (const step of steps.filter(s => s.enabled)) {
      const { unitId } = step
      let result: { ok: boolean; data: unknown; error?: string }

      if (unitId === 1) {
        result = await callUnitApi('/api/marketing/collect', {
          types:   (cfg.u1_types as string[]) ?? ['news', 'web'],
          keywords: cfg.u1_keywords ?? campaign.title,
          location: cfg.u1_location ?? '',
          limit:    10,
          alertRssUrls: cfg.u1_alertRssUrls ?? [],
          appIds:   cfg.u1_appIds ?? [],
          shopUrls: cfg.u1_shopUrls ?? [],
        }, cronSecret ?? '', baseUrl)
      } else if (unitId === 3) {
        result = await callUnitApi('/api/marketing/analyze', {
          types:         (cfg.u3_types as string[]) ?? ['swot', 'company', 'marketing'],
          collectedData: (ud[1] as { summary?: string } | undefined)?.summary ?? '',
          companyData:   ud[2] ?? {},
        }, cronSecret ?? '', baseUrl)
      } else if (unitId === 4) {
        result = await callUnitApi('/api/marketing/copy', {
          copyTypes:        (cfg.u4_copyTypes as string[]) ?? ['facebook_post'],
          userInstructions: cfg.u4_instructions ?? '',
          companyData:      ud[2] ?? {},
          analysisData:     ud[3] ?? {},
          collectedSummary: (ud[1] as { summary?: string } | undefined)?.summary ?? '',
        }, cronSecret ?? '', baseUrl)
      } else if (unitId === 5) {
        result = await callUnitApi('/api/marketing/image-script', {
          count:     cfg.u5_count ?? 3,
          platforms: (cfg.u5_platforms as string[]) ?? ['instagram'],
          companyData:      ud[2] ?? {},
          analysisData:     ud[3] ?? {},
          copyData:         ud[4] ?? {},
          collectedSummary: (ud[1] as { summary?: string } | undefined)?.summary ?? '',
        }, cronSecret ?? '', baseUrl)
      } else if (unitId === 7) {
        result = await callUnitApi('/api/marketing/video-script', {
          count:     cfg.u7_count ?? 2,
          duration:  cfg.u7_duration ?? 10,
          videoTypes: ['brand_story'],
          platforms:  ['youtube'],
          companyData:      ud[2] ?? {},
          analysisData:     ud[3] ?? {},
          copyData:         ud[4] ?? {},
          collectedSummary: (ud[1] as { summary?: string } | undefined)?.summary ?? '',
        }, cronSecret ?? '', baseUrl)
      } else if (unitId === 10) {
        // 潛在客戶行銷：從 _prospectConfig 讀取設定執行 collect + filter
        const pcfg = (ud['_prospectConfig'] ?? cfg) as Record<string, unknown>
        const sources = (pcfg.sources as string[]) ?? ['map']
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

        const collectResult = await callUnitApi('/api/marketing/collect', {
          types, subOptions,
          keywords: pcfg.keywords ?? campaign.title,
          location: pcfg.location ?? '',
          limit: 20,
        }, cronSecret ?? '', baseUrl)

        let prospectResult: { ok: boolean; data: unknown; error?: string } = { ok: false, data: null, error: '蒐集失敗' }
        if (collectResult.ok) {
          const rawText = (collectResult.data as Record<string, string>)?.result
            || (collectResult.data as Record<string, string>)?.summary || ''
          prospectResult = await callUnitApi('/api/marketing/prospect-filter', {
            rawText,
            filterCriteria: pcfg.filterCriteria ?? '',
            minEmployees:   pcfg.minEmployees ?? 0,
            maxDistanceKm:  pcfg.maxDistanceKm ?? 0,
            branches: [],
          }, cronSecret ?? '', baseUrl)
        }

        if (prospectResult.ok && prospectResult.data) {
          const orgs = (prospectResult.data as Record<string, unknown>).orgs as Array<{ selected?: boolean }> ?? []
          const selected = orgs.filter(o => o.selected)
          const prospectSummary = { orgs, total: orgs.length, selected: selected.length, runAt: new Date().toISOString() }
          ud = { ...ud, _prospectResult: prospectSummary }
          result = { ok: true, data: prospectSummary }
          log.push(`✓ 潛在客戶行銷完成：蒐集 ${orgs.length} 家，入選 ${selected.length} 家`)
        } else {
          result = { ok: false, data: null, error: prospectResult.error ?? '篩選失敗' }
        }
      } else {
        // Units 6,8,9,11 need user interaction or long async — skip in cron
        log.push(`⏭ 跳過 Unit ${unitId}（需人工確認或長時非同步）`)
        continue
      }

      if (result.ok && result.data) {
        ud = { ...ud, [unitId]: result.data }
        await supabase
          .from('marketing_campaigns')
          .update({ unit_data: { ...ud } })
          .eq('id', campaign.id)
        log.push(`✓ Unit ${unitId} 完成`)
      } else {
        log.push(`✗ Unit ${unitId} 失敗：${result.error ?? '未知錯誤'}`)
      }

      // Notify if step has notify flag
      if (step.notify && botToken && chatId) {
        await sendTelegram(botToken, chatId,
          `✅ Unit ${unitId} 已完成\n${result.ok ? '結果已儲存，可至 AI GATE 查看。' : `⚠️ 失敗：${result.error}`}`)
      }
    }

    // ── Update schedule ────────────────────────────────────────────────────
    const newNextRun = computeNextRun({
      frequency: sched.frequency ?? 'daily',
      hour:      sched.hour ?? 8,
      minute:    sched.minute ?? 0,
      weekday:   sched.weekday,
      monthDay:  sched.monthDay,
    })

    const updatedSched = {
      ...sched,
      lastRunAt: now.toISOString(),
      nextRunAt: newNextRun.toISOString(),
    }
    await supabase
      .from('marketing_campaigns')
      .update({ unit_data: { ...ud, _schedule: updatedSched } })
      .eq('id', campaign.id)

    // ── Final Telegram notification ────────────────────────────────────────
    if (botToken && chatId) {
      await sendTelegram(botToken, chatId,
        `🎉 <b>排程流程完成</b>\n\n活動：${campaign.title}\n完成時間：${new Date().toLocaleString('zh-TW')}\n下次執行：${newNextRun.toLocaleString('zh-TW')}\n\n執行記錄：\n${log.join('\n')}`)
    }
  }

  return NextResponse.json({
    ok: true,
    ran: ran.length,
    skipped: skipped.length,
    timestamp: now.toISOString(),
  })
}
