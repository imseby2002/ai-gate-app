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

    // ── 3. 訂房 → 日曆式訂房（頁面自動顯示今日資料）─────────────────────────
    console.log('📅 導覽至「日曆式訂房」…')

    // 點「訂房」展開子選單
    await page.click('text=訂房').catch(() => console.log('⚠ 找不到「訂房」'))
    await page.waitForTimeout(600)

    // 點「日曆式訂房」
    await page.click('text=日曆式訂房').catch(() => console.log('⚠ 找不到「日曆式訂房」'))
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    await screenshot(page, '04-calendar')

    // 頁面載入後今日已自動選取，右側顯示「已售出N間房間」
    // ── 4. 解析右側「已售出」表格，逐一點入取訂單號碼 ──────────────────────
    const records: CheckInRecord[] = []

    // 找到右側含「預訂人」欄的 table
    const allTables = await page.$$('table')
    let soldTable = null
    for (const t of allTables) {
      const txt = await t.textContent() ?? ''
      if (txt.includes('預訂人') && txt.includes('來源')) { soldTable = t; break }
    }

    if (!soldTable) {
      console.log('⚠ 未找到右側訂單表格，今日可能無入住訂單')
    } else {
      const rows = await soldTable.$$('tbody tr')
      console.log(`🏠 今日已售出 ${rows.length} 間`)

      for (let i = 0; i < rows.length; i++) {
        const cells = await rows[i].$$('td')
        if (cells.length === 0) continue
        const vals = await Promise.all(cells.map(c => c.textContent().then(t => t?.trim().replace(/\s+/g, ' ') ?? '')))
        // 欄位順序：房型名稱 | 價格 | 預訂人 | 電話 | 來源 | 狀態
        const roomName  = vals[0] ?? ''
        const guestName = vals[2] ?? ''
        console.log(`  📄 ${roomName} / ${guestName}`)

        // 點進去取訂單號碼
        const rowLink = await rows[i].$('a') ?? rows[i]
        await rowLink.click().catch(() => {})
        await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {})
        await page.waitForTimeout(600)
        await screenshot(page, `05-order-${i + 1}`)

        const body = await page.textContent('body') ?? ''
        // 嘗試多種訂單號格式
        const orderMatch =
          body.match(/訂單[編號碼No.#：:\s]+([A-Z0-9][A-Z0-9\-]{3,19})/i) ??
          body.match(/Order\s*(?:No|#|ID)?[.:\s]+([A-Z0-9][A-Z0-9\-]{3,19})/i) ??
          body.match(/#([A-Z0-9]{4,15})\b/) ??
          body.match(/\b([A-Z]{1,3}[0-9]{6,12})\b/)

        records.push({
          room_name:    roomName,
          order_number: orderMatch?.[1]?.trim() ?? '',
          guest_name:   guestName,
        })
        console.log(`     訂單號碼：${orderMatch?.[1] ?? '（未找到）'}`)

        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10_000 }).catch(() => {})
        await page.waitForTimeout(500)
      }
    }

    // 備用：無右側表格時從連結抓
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
