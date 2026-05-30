/**
 * TRAIWAN PMS 每日入住名單擷取
 * 執行：npm run traiwan
 *
 * 必要環境變數（GitHub Actions Secrets / .env.local）：
 *   TRAIWAN_USERNAME          - TRAIWAN 帳號
 *   TRAIWAN_PASSWORD          - TRAIWAN 密碼
 *   GMAIL_APP_PASSWORD        - Gmail 應用程式密碼（非登入密碼）
 *   GOOGLE_SHEETS_ID          - Google Sheets 試算表 ID
 *   GOOGLE_SERVICE_ACCOUNT_JSON - 服務帳號 JSON（字串格式）
 *   GOOGLE_SHEETS_TAB         - 工作表名稱（預設：入住名單）
 */

import { chromium, Page } from 'playwright'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { google } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

// ─── 設定 ───────────────────────────────────────────────────────────────────

const BASE_URL = 'https://pms.traiwan.com/place/accommodation/butler'
const LOGIN_URL = `${BASE_URL}/account/login.php`
const DASHBOARD_URL = `${BASE_URL}/index.php`

const SCREENSHOT_DIR = path.join(process.cwd(), 'tmp', 'traiwan-screenshots')

const TODAY = new Date().toLocaleDateString('zh-TW', {
  timeZone: 'Asia/Taipei',
  year: 'numeric', month: '2-digit', day: '2-digit'
}).replace(/\//g, '-') // 格式：2026-05-30

// ─── 截圖工具 ────────────────────────────────────────────────────────────────

async function screenshot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  const file = path.join(SCREENSHOT_DIR, `${Date.now()}-${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log(`📸 截圖：${file}`)
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

      // 搜尋最近 5 分鐘內，寄件人含 traiwan 的未讀郵件
      const since = new Date(Date.now() - 5 * 60 * 1000)
      const uids = await client.search({ since, from: 'traiwan' }, { uid: true })

      for (const uid of [...uids].reverse()) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true })
        if (!msg?.source) continue

        const parsed = await simpleParser(msg.source)
        const body = parsed.text ?? parsed.html ?? ''

        // 嘗試找 4-8 位數字驗證碼
        const match = body.match(/\b(\d{4,8})\b/)
        if (match) {
          console.log(`✅ 找到驗證碼：${match[1]}`)
          return match[1]
        }
      }

      await new Promise(r => setTimeout(r, 5000))
    }
  } finally {
    await client.logout()
  }

  throw new Error('❌ 90 秒內未收到驗證碼郵件')
}

// ─── TRAIWAN 入住資料結構 ─────────────────────────────────────────────────────

interface CheckInRecord {
  date: string
  roomType: string
  orderNumber: string
  guestName: string
  checkIn: string
  checkOut: string
  rooms: string
  amount: string
}

// ─── Playwright：登入 + 擷取 ─────────────────────────────────────────────────

async function scrape(): Promise<CheckInRecord[]> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const context = await browser.newContext({
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
  })
  const page = await context.newPage()

  try {
    // ── 1. 登入 ──────────────────────────────────────────────────────────────
    console.log('🔑 前往登入頁…')
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' })
    await screenshot(page, '01-login')

    await page.fill('input[name="account"], input[type="email"], #account', process.env.TRAIWAN_USERNAME!)
    await page.fill('input[name="password"], input[type="password"], #password', process.env.TRAIWAN_PASSWORD!)
    await screenshot(page, '02-filled')

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }),
      page.click('button[type="submit"], input[type="submit"], .btn-login'),
    ])
    await screenshot(page, '03-after-login')

    // ── 2. 偵測 2FA 頁面 ──────────────────────────────────────────────────────
    const url = page.url()
    const is2FA = url.includes('verify') || url.includes('otp') || url.includes('code') ||
      await page.$('input[name="otp"], input[name="code"], input[name="verify_code"]') !== null

    if (is2FA) {
      console.log('🔐 偵測到 2FA 頁面，讀取驗證碼…')
      const code = await waitForVerificationCode()

      const codeInput = await page.$('input[name="otp"], input[name="code"], input[name="verify_code"], input[type="number"]')
      if (!codeInput) throw new Error('找不到驗證碼輸入欄位，請看截圖')
      await codeInput.fill(code)
      await screenshot(page, '04-2fa-filled')

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }),
        page.click('button[type="submit"], input[type="submit"]'),
      ])
      await screenshot(page, '05-after-2fa')
    }

    // ── 3. 導覽至當日入住名單 ────────────────────────────────────────────────
    console.log(`📋 載入今日（${TODAY}）入住名單…`)

    // TRAIWAN PMS 常見的入住清單路徑，依序嘗試
    const checkinPaths = [
      `${BASE_URL}/order/checkin.php`,
      `${BASE_URL}/order/list.php?type=checkin&date=${TODAY}`,
      `${BASE_URL}/report/checkin.php?date=${TODAY}`,
      `${BASE_URL}/booking/checkin.php`,
      DASHBOARD_URL,
    ]

    let found = false
    for (const p of checkinPaths) {
      await page.goto(p, { waitUntil: 'domcontentloaded', timeout: 15_000 })
      const rows = await page.$$('table tbody tr, .order-row, .booking-row')
      if (rows.length > 0) {
        console.log(`✅ 找到資料頁面：${p}（${rows.length} 列）`)
        found = true
        break
      }
    }

    if (!found) {
      await screenshot(page, '06-dashboard-inspect')
      console.warn('⚠️  未自動找到入住清單，請查看截圖並手動確認 URL，再更新 checkinPaths')
    }

    await screenshot(page, '07-checkin-page')

    // ── 4. 解析資料 ──────────────────────────────────────────────────────────
    const records: CheckInRecord[] = []

    // 嘗試解析標準 HTML table
    const tables = await page.$$('table')
    for (const table of tables) {
      const rows = await table.$$('tbody tr')
      if (rows.length === 0) continue

      // 讀取表頭，找出欄位對應
      const headers: string[] = []
      const ths = await table.$$('thead th, thead td')
      for (const th of ths) {
        headers.push((await th.textContent() ?? '').trim())
      }
      console.log('表頭：', headers)

      for (const row of rows) {
        const cells = await row.$$('td')
        if (cells.length < 2) continue

        const values: string[] = []
        for (const cell of cells) {
          values.push((await cell.textContent() ?? '').trim().replace(/\s+/g, ' '))
        }

        // 嘗試找訂單號碼（通常是 #XXXXX 或純數字）
        const orderMatch = values.find(v => /^#?\d{4,10}$/.test(v.replace(/\s/g, '')))

        records.push({
          date: TODAY,
          roomType: values[0] ?? '',
          orderNumber: orderMatch ?? values[1] ?? '',
          guestName: values[2] ?? '',
          checkIn: values[3] ?? '',
          checkOut: values[4] ?? '',
          rooms: values[5] ?? '',
          amount: values[6] ?? '',
        })
      }

      if (records.length > 0) break
    }

    // 若 table 解析失敗，嘗試尋找房型連結，逐一進入取得訂單號碼
    if (records.length === 0) {
      console.log('📎 嘗試從房型連結逐一擷取…')
      const links = await page.$$('a[href*="order"], a[href*="booking"], a[href*="reservation"]')
      for (const link of links) {
        const text = (await link.textContent() ?? '').trim()
        const href = await link.getAttribute('href') ?? ''
        if (!text || !href) continue

        const fullUrl = href.startsWith('http') ? href : `https://pms.traiwan.com${href}`
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 })

        const content = await page.textContent('body') ?? ''
        const orderMatch = content.match(/訂單[：:\s]*([A-Z0-9\-]+)/i) ??
          content.match(/#([0-9]{4,10})/)
        records.push({
          date: TODAY,
          roomType: text,
          orderNumber: orderMatch?.[1] ?? '',
          guestName: '',
          checkIn: TODAY,
          checkOut: '',
          rooms: '',
          amount: '',
        })
        await page.goBack()
      }
    }

    console.log(`✅ 共擷取 ${records.length} 筆入住紀錄`)
    return records

  } finally {
    await browser.close()
  }
}

// ─── Google Sheets：寫入 ─────────────────────────────────────────────────────

async function writeToSheets(records: CheckInRecord[]) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.GOOGLE_SHEETS_ID) {
    console.warn('⚠️  未設定 Google Sheets 環境變數，跳過寫入')
    console.log('資料預覽：')
    console.table(records)
    return
  }

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID
  const sheetName = process.env.GOOGLE_SHEETS_TAB ?? '入住名單'

  // 確保表頭存在（若工作表空白則寫入）
  const header = [['日期', '房型', '訂單號碼', '旅客姓名', '入住日', '退房日', '房間數', '金額', '更新時間']]
  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1`,
  })
  if (!existingRes.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: header },
    })
  }

  // 刪除當日舊資料再寫入（防重複）
  const allRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`,
  })
  const existingRows = allRes.data.values ?? []
  const deleteRows: number[] = []
  existingRows.forEach((row, i) => {
    if (row[0] === TODAY) deleteRows.push(i + 1)
  })

  if (deleteRows.length > 0) {
    // 從後往前刪，避免行號偏移
    // 簡單做法：直接清空那幾行
    for (const rowNum of deleteRows.reverse()) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${rowNum}:I${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['', '', '', '', '', '', '', '', '']] },
      })
    }
  }

  // 追加新資料
  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
  const rows = records.map(r => [
    r.date, r.roomType, r.orderNumber, r.guestName,
    r.checkIn, r.checkOut, r.rooms, r.amount, now,
  ])

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:I`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  })

  console.log(`📊 已寫入 ${rows.length} 筆至 Google Sheets（${sheetName}）`)
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
  await writeToSheets(records)

  console.log('\n✅ 完成\n')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
