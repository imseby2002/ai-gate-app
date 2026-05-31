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

async function waitForVerificationCode(timeoutMs = 90_000): Promise<string> {
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
  console.log('📧 等待 TRAIWAN 驗證碼郵件…')

  await client.connect()
  try {
    while (Date.now() < deadline) {
      await client.mailboxOpen('INBOX')
      const since = new Date(Date.now() - 5 * 60 * 1000)
      const result = await client.search({ since, from: 'traiwan' }, { uid: true })
      const uids: number[] = result === false ? [] : result

      for (const uid of [...uids].reverse()) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true })
        if (!msg?.source) continue
        const parsed = await simpleParser(msg.source)
        const body = parsed.text ?? parsed.html ?? ''
        const match = body.match(/\b(\d{4,8})\b/)
        if (match) {
          console.log(`✅ 驗證碼：${match[1]}`)
          return match[1]
        }
      }
      await new Promise(r => setTimeout(r, 5000))
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

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }),
      page.click('button[type="submit"], input[type="submit"], .btn-login'),
    ])
    await screenshot(page, '02-after-login')

    // ── 2. 2FA ───────────────────────────────────────────────────────────────
    const url = page.url()
    const is2FA = url.includes('verify') || url.includes('otp') || url.includes('code') ||
      await page.$('input[name="otp"], input[name="code"], input[name="verify_code"]') !== null

    if (is2FA) {
      console.log('🔐 2FA 頁面，讀取驗證碼…')
      const code = await waitForVerificationCode()
      const codeInput = await page.$('input[name="otp"], input[name="code"], input[name="verify_code"], input[type="number"]')
      if (!codeInput) throw new Error('找不到驗證碼輸入欄，請看截圖')
      await codeInput.fill(code)
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }),
        page.click('button[type="submit"], input[type="submit"]'),
      ])
      await screenshot(page, '03-after-2fa')
    }

    // ── 3. 入住名單頁面 ───────────────────────────────────────────────────────
    console.log(`📋 載入 ${TODAY} 入住名單…`)

    const checkinPaths = [
      `${BASE_URL}/order/checkin.php`,
      `${BASE_URL}/order/list.php?type=checkin&date=${TODAY}`,
      `${BASE_URL}/report/checkin.php?date=${TODAY}`,
      `${BASE_URL}/booking/checkin.php`,
      DASHBOARD_URL,
    ]

    for (const p of checkinPaths) {
      await page.goto(p, { waitUntil: 'domcontentloaded', timeout: 15_000 })
      const rows = await page.$$('table tbody tr, .order-row, .booking-row')
      if (rows.length > 0) { console.log(`✅ 頁面：${p}（${rows.length} 列）`); break }
    }
    await screenshot(page, '04-checkin-page')

    // ── 4. 解析資料 ──────────────────────────────────────────────────────────
    const records: CheckInRecord[] = []

    const tables = await page.$$('table')
    for (const table of tables) {
      const rows = await table.$$('tbody tr')
      if (rows.length === 0) continue

      const ths = await table.$$('thead th, thead td')
      const headers = await Promise.all(ths.map(th => th.textContent().then(t => t?.trim() ?? '')))
      console.log('表頭：', headers.join(' | '))

      for (const row of rows) {
        const cells = await row.$$('td')
        if (cells.length < 2) continue
        const values = await Promise.all(cells.map(c => c.textContent().then(t => t?.trim().replace(/\s+/g, ' ') ?? '')))

        const orderMatch = values.find(v => /^#?\d{4,10}$/.test(v.replace(/\s/g, '')))
        records.push({
          room_name: values[0] ?? '',
          order_number: orderMatch ?? values[1] ?? '',
          guest_name: values[2] ?? '',
        })
      }
      if (records.length > 0) break
    }

    // 備用：從訂單連結逐一進入
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
