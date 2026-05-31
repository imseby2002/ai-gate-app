/**
 * TRAIWAN PMS 每日入住名單擷取 → Supabase bnb_daily_records
 * 執行：npm run traiwan
 *
 * 必要環境變數（GitHub Actions Secrets）：
 *   TRAIWAN_USERNAME        - TRAIWAN 帳號
 *   TRAIWAN_PASSWORD        - TRAIWAN 密碼
 *   GMAIL_APP_PASSWORD      - Gmail 應用程式密碼
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TRAIWAN_USER_ID         - 民宿帳號的 Supabase user.id（在 auth.users 可查）
 */

import { chromium, Page } from 'playwright'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ─── 設定 ───────────────────────────────────────────────────────────────────

const BASE_URL = 'https://pms.traiwan.com/place/accommodation/butler'
const LOGIN_URL = `${BASE_URL}/account/login.php`
const DASHBOARD_URL = `${BASE_URL}/index.php`
const SCREENSHOT_DIR = path.join(process.cwd(), 'tmp', 'traiwan-screenshots')

const TODAY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

// ─── 截圖工具 ────────────────────────────────────────────────────────────────

async function screenshot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  const file = path.join(SCREENSHOT_DIR, `${Date.now()}-${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log(`📸 截圖：${path.basename(file)}`)
}

// ─── Gmail IMAP：等待驗證碼 ──────────────────────────────────────────────────

async function waitForVerificationCode(notBefore: Date, timeoutMs = 90_000): Promise<string> {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: 'imseby@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
    logger: false,
  })

  const deadline = Date.now() + timeoutMs
  console.log(`📧 等待 TRAIWAN 驗證碼郵件（只接受 ${notBefore.toISOString()} 之後的信）…`)

  // 先等 10 秒讓信件有時間送達
  await new Promise(r => setTimeout(r, 10_000))

  await client.connect()
  try {
    while (Date.now() < deadline) {
      await client.mailboxOpen('INBOX')
      // since 用今天，搜到全部今日信再手動過濾時間
      const since = new Date(); since.setHours(0, 0, 0, 0)
      const result = await client.search({ since, from: 'traiwan' }, { uid: true })
      const uids: number[] = result === false ? [] : result
      console.log(`📬 找到 ${uids.length} 封今日 TRAIWAN 信件`)

      for (const uid of [...uids].reverse()) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true })
        if (!msg?.source) continue
        const parsed = await simpleParser(msg.source)

        // 只看 notBefore 之後寄出的信
        const mailDate = parsed.date ?? new Date(0)
        if (mailDate < notBefore) {
          console.log(`⏩ 跳過舊信件 (${mailDate.toISOString()})`)
          continue
        }

        const body = parsed.text ?? ''
        console.log(`📄 信件時間：${mailDate.toISOString()}，內容片段：${body.slice(0, 100)}`)

        // 精確比對 6 位數字
        const match = body.match(/\b(\d{6})\b/)
        if (match) {
          console.log(`✅ 驗證碼：${match[1]}`)
          return match[1]
        }
      }
      await new Promise(r => setTimeout(r, 8000))
    }
  } finally {
    await client.logout()
  }

  throw new Error('❌ 90 秒內未收到驗證碼')
}

// ─── 資料結構 ────────────────────────────────────────────────────────────────

interface CheckInRecord {
  room_name: string
  order_number: string
  guest_name: string
}

// ─── Playwright：登入 + 擷取 ─────────────────────────────────────────────────

async function scrape(): Promise<CheckInRecord[]> {
  const browser = await chromium.launch({
    // CI 環境用 xvfb-run 提供虛擬顯示，headless:false 可繞過 reCAPTCHA 偵測
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  })
  const context = await browser.newContext({
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  })

  // 隱藏 webdriver 特徵，避免 reCAPTCHA 偵測
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
    Object.defineProperty(navigator, 'languages', { get: () => ['zh-TW', 'zh', 'en-US', 'en'] })
  })

  const page = await context.newPage()

  try {
    // ── 1. 登入 ──────────────────────────────────────────────────────────────
    console.log('🔑 登入 TRAIWAN PMS…')
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 30_000 })
    await screenshot(page, '01-login')

    // 等待登入表單出現（reCAPTCHA 載入後才顯示）
    const accountInput = await page.waitForSelector(
      'input[name="account"], input[type="email"], #account, input[placeholder*="帳號"], input[placeholder*="Email"]',
      { timeout: 20_000 }
    )
    await accountInput.fill(process.env.TRAIWAN_USERNAME!)
    await page.fill('input[name="password"], input[type="password"], #password', process.env.TRAIWAN_PASSWORD!)

    const loginTime = new Date() // 記錄送出登入的時間，只讀這之後的驗證信
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }),
      page.click('button[type="submit"], input[type="submit"], .btn-login'),
    ])
    await screenshot(page, '02-after-login')

    // ── 2. 2FA ───────────────────────────────────────────────────────────────
    const pageContent = await page.content()
    const url = page.url()
    const is2FA =
      url.includes('verify') || url.includes('otp') || url.includes('code') ||
      pageContent.includes('驗證碼') || pageContent.includes('OTP') ||
      await page.$('input[name="otp"], input[name="code"], input[name="verify_code"], input[maxlength="6"]') !== null

    if (is2FA) {
      console.log('🔐 2FA 頁面，讀取驗證碼…')
      const code = await waitForVerificationCode(loginTime)

      // 廣泛選取 OTP 輸入框
      const codeInput = await page.$(
        'input[name="otp"], input[name="code"], input[name="verify_code"], input[type="number"], input[maxlength="6"], input[placeholder="000000"]'
      ) ?? await page.$('input[type="text"]')
      if (!codeInput) throw new Error('找不到驗證碼輸入欄，請看截圖')

      await codeInput.click({ clickCount: 3 }) // 先全選清空
      await codeInput.fill(code)
      console.log(`🔢 已填入驗證碼：${code}`)

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }),
        page.click('button[type="submit"], input[type="submit"], button:has-text("驗證")'),
      ])
      await screenshot(page, '03-after-2fa')
    }

    // ── 3. 訂房 → 日曆 → 今日 ────────────────────────────────────────────────
    console.log('📅 導覽至訂房日曆…')
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 15_000 })

    // 點側邊欄「訂房」展開子選單
    await page.click('text=訂房').catch(() => console.log('⚠ 找不到「訂房」連結'))
    await page.waitForTimeout(800)
    await screenshot(page, '04-menu-booking')

    // 點「日曆」
    await page.click('text=日曆').catch(() => console.log('⚠ 找不到「日曆」連結'))
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    await screenshot(page, '05-calendar')

    // 確認目前在哪個月；若不是本月則導覽至今日
    const todayDay = parseInt(TODAY.split('-')[2], 10)  // e.g. 31
    const [todayYear, todayMonth] = TODAY.split('-')

    // 試著點「今天」按鈕，或找到今日日期格子
    const todayBtn = await page.$('button:has-text("今天"), a:has-text("今天"), [data-date="' + TODAY + '"]')
    if (todayBtn) {
      await todayBtn.click()
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
    }

    // 找今日的日曆格子並點擊（各 PMS 寫法不一，廣泛嘗試）
    const dayCellSelectors = [
      `[data-date="${TODAY}"]`,
      `td[data-date="${TODAY}"]`,
      `.day-${todayDay}`,
      `td:has-text("${todayDay}")`,
      `.fc-day[data-date="${TODAY}"]`,  // FullCalendar
    ]
    let dayClicked = false
    for (const sel of dayCellSelectors) {
      const cell = await page.$(sel)
      if (cell) {
        console.log(`📆 點擊今日格子：${sel}`)
        await cell.click()
        await page.waitForTimeout(1500)
        dayClicked = true
        break
      }
    }
    if (!dayClicked) console.log('⚠ 未能點擊今日格子，繼續嘗試解析')
    await screenshot(page, '06-today-clicked')

    // ── 4. 收集今日所有訂單連結，逐一進入取資料 ──────────────────────────────
    const records: CheckInRecord[] = []

    // 找今日有入住標記的房間連結（TRAIWAN 日曆中通常是 a 標籤包著房間名）
    const bookingLinks = await page.$$(
      'a[href*="order"], a[href*="booking"], a[href*="reservation"], a[href*="detail"], .booking-item a, .event a'
    )
    console.log(`🔗 找到 ${bookingLinks.length} 個訂單連結`)

    for (let i = 0; i < bookingLinks.length; i++) {
      const link = bookingLinks[i]
      const href = await link.getAttribute('href') ?? ''
      const linkText = (await link.textContent() ?? '').trim()
      if (!href || !linkText) continue

      const fullUrl = href.startsWith('http') ? href : `https://pms.traiwan.com${href}`
      console.log(`📄 進入訂單 ${i + 1}：${fullUrl}`)

      await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 }).catch(() => {})
      await page.waitForTimeout(800)

      const content = await page.textContent('body') ?? ''

      // 抓訂單號碼
      const orderMatch = content.match(/訂單[編號碼：:\s]*([A-Z0-9\-]{4,20})/i)
        ?? content.match(/#([0-9]{4,10})/)
        ?? content.match(/\b([A-Z]{0,3}[0-9]{6,10})\b/)

      // 抓旅客姓名
      const guestMatch = content.match(/(?:姓名|旅客|住客)[：:\s]*([^\s,，。\n]{2,10})/)
        ?? content.match(/旅客姓名[：:\s]*([^\n]{2,10})/)

      // 抓房型名稱
      const roomMatch = content.match(/房型[：:\s]*([^\n,，]{2,20})/)
        ?? content.match(/房間[：:\s]*([^\n,，]{2,20})/)

      if (orderMatch || guestMatch) {
        records.push({
          room_name: roomMatch?.[1]?.trim() ?? linkText,
          order_number: orderMatch?.[1]?.trim() ?? '',
          guest_name: guestMatch?.[1]?.trim() ?? '',
        })
        console.log(`  ✅ 房型：${roomMatch?.[1] ?? '?'} / 訂單：${orderMatch?.[1] ?? '?'} / 旅客：${guestMatch?.[1] ?? '?'}`)
      }

      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10_000 }).catch(() => {})
    }

    // 備用：若日曆沒有連結，嘗試舊的 table 解析方式
    if (records.length === 0) {
      const links = await page.$$('a[href*="order"], a[href*="booking"], a[href*="reservation"]')
      for (const link of links) {
        const text = (await link.textContent() ?? '').trim()
        const href = await link.getAttribute('href') ?? ''
        if (!text || !href) continue
        const fullUrl = href.startsWith('http') ? href : `https://pms.traiwan.com${href}`
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 })
        const content = await page.textContent('body') ?? ''
        const m = content.match(/訂單[：:\s]*([A-Z0-9\-]+)/i) ?? content.match(/#([0-9]{4,10})/)
        records.push({ room_name: text, order_number: m?.[1] ?? '', guest_name: '' })
        await page.goBack()
      }
    }

    console.log(`✅ 擷取 ${records.length} 筆`)
    return records

  } finally {
    await browser.close()
  }
}

// ─── Supabase：寫入 ──────────────────────────────────────────────────────────

async function writeToSupabase(records: CheckInRecord[]) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const userId = process.env.TRAIWAN_USER_ID

  if (!supabaseUrl || !serviceKey || !userId) {
    console.warn('⚠️  未設定 Supabase 環境變數，僅顯示資料：')
    console.table(records)
    return
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const rows = records.map((r, i) => ({
    user_id: userId,
    date: TODAY,
    room_name: r.room_name,
    order_number: r.order_number || null,
    guest_name: r.guest_name || null,
    source: 'traiwan',
    sort_order: i,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('bnb_daily_records')
    .upsert(rows, { onConflict: 'user_id,date,room_name', ignoreDuplicates: false })

  if (error) throw new Error(`Supabase 寫入失敗：${error.message}`)
  console.log(`📊 已寫入 ${rows.length} 筆至 Supabase（bnb_daily_records）`)
}

// ─── 主程式 ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🏨 TRAIWAN 入住名單擷取 — ${TODAY}\n`)

  const missing = ['TRAIWAN_USERNAME', 'TRAIWAN_PASSWORD', 'GMAIL_APP_PASSWORD']
    .filter(k => !process.env[k])
  if (missing.length) {
    console.error(`❌ 缺少環境變數：${missing.join(', ')}`)
    process.exit(1)
  }

  const records = await scrape()
  await writeToSupabase(records)
  console.log('\n✅ 完成\n')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
