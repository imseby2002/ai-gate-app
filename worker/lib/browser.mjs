// 共用瀏覽器與 IVT 登入輔助。所有選擇器可由 env 覆寫（見 .env.example）。
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve(process.cwd(), 'out')

export function env(name, fallback = '') {
  const v = process.env[name]
  return v === undefined || v === '' ? fallback : v
}

// 支援以逗號分隔的多個候選選擇器，回傳第一個可見者的 Locator。
export async function firstVisible(page, selectorList, timeout = 15000) {
  const sels = selectorList.split(',').map(s => s.trim()).filter(Boolean)
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    for (const sel of sels) {
      const loc = page.locator(sel).first()
      if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) return loc
    }
    await page.waitForTimeout(300)
  }
  throw new Error(`找不到可見元素：${selectorList}`)
}

export async function screenshot(page, name) {
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true })
    const file = path.join(OUT_DIR, `${name}-${Date.now()}.png`)
    await page.screenshot({ path: file, fullPage: true })
    return file
  } catch { return null }
}

export async function launch() {
  const headless = env('HEADLESS', 'true') !== 'false'
  const browser = await chromium.launch({ headless })
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()
  return { browser, context, page }
}

// IVT 登入。回傳前確保已離開登入頁。
export async function loginIvt(page) {
  const loginUrl = env('IVT_LOGIN_URL', 'https://ivt.ipos.vn/login')
  const user = env('IVT_USERNAME'), pass = env('IVT_PASSWORD')
  if (!user || !pass) throw new Error('缺少 IVT_USERNAME / IVT_PASSWORD（請設定 .env）')

  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' })
  await (await firstVisible(page, env('IVT_SEL_USERNAME'))).fill(user)
  await (await firstVisible(page, env('IVT_SEL_PASSWORD'))).fill(pass)
  await (await firstVisible(page, env('IVT_SEL_SUBMIT'))).click()

  // 等待離開登入頁（URL 改變或出現主畫面）
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1500)
  if (page.url().includes('/login')) {
    throw new Error('登入後仍停在登入頁，帳密或選擇器可能有誤')
  }
}
