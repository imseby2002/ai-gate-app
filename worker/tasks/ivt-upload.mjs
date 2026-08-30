// 任務：把一份 xlsx 上傳到 IVT 指定頁（盤點 / 訂貨）。
// 用法一（手動檔）：node run.mjs ivt-upload --page stock-taking|purchase-order --file /path/to.xlsx
// 用法二（自動取檔）：node run.mjs ivt-upload --page stock-taking --store YL
//   需 env：APP_BASE_URL（主 app 網址）、WORKER_SECRET（與主 app 相同）。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { env, firstVisible, screenshot, launch, loginIvt } from '../lib/browser.mjs'

const PAGE_URL = {
  'stock-taking': () => env('IVT_PAGE_STOCK_TAKING', 'https://ivt.ipos.vn/stock/stock-taking'),
  'purchase-order': () => env('IVT_PAGE_PURCHASE_ORDER', 'https://ivt.ipos.vn/order/purchase-order-internal'),
}
const PAGE_KIND = { 'stock-taking': 'ivt-count', 'purchase-order': 'ivt-order' }

// 由主 app 取「某門市最新盤點」的 IVT 匯入檔，存成暫存檔並回傳路徑。
async function fetchFromApp(pageKey, store) {
  const base = env('APP_BASE_URL')
  const secret = env('WORKER_SECRET')
  if (!base || !secret) throw new Error('自動取檔需設定 APP_BASE_URL 與 WORKER_SECRET（或改用 --file）')
  const url = `${base.replace(/\/$/, '')}/api/worker/ivt-xlsx?secret=${encodeURIComponent(secret)}&store=${encodeURIComponent(store)}&kind=${PAGE_KIND[pageKey]}`
  const res = await fetch(url)
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(`向主 app 取檔失敗（${res.status}）：${msg.slice(0, 200)}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const tmp = path.join(os.tmpdir(), `ivt-${pageKey}-${store}-${Date.now()}.xlsx`)
  fs.writeFileSync(tmp, buf)
  return tmp
}

export async function run(args) {
  const pageKey = args.page
  if (!pageKey || !PAGE_URL[pageKey]) throw new Error(`--page 需為 ${Object.keys(PAGE_URL).join(' | ')}`)

  let file = args.file
  if (!file && args.store) file = await fetchFromApp(pageKey, args.store)
  if (!file || !fs.existsSync(file)) throw new Error('請用 --file 指定 xlsx，或用 --store 由主 app 自動取檔')

  const { browser, page } = await launch()
  try {
    await loginIvt(page)
    await page.goto(PAGE_URL[pageKey](), { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})

    // 開啟匯入對話框（若頁面直接就有 file input 則略過）
    const openSel = env('IVT_SEL_IMPORT_OPEN')
    try { await (await firstVisible(page, openSel, 6000)).click() } catch { /* 有些頁面免點即有 file input */ }

    // 設定檔案
    const input = await firstVisible(page, env('IVT_SEL_FILE_INPUT'), 15000)
    await input.setInputFiles(file)
    await page.waitForTimeout(1000)

    // 確認送出
    await (await firstVisible(page, env('IVT_SEL_CONFIRM'), 15000)).click()
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)

    const shot = await screenshot(page, `ivt-${pageKey}-done`)
    console.log(JSON.stringify({ ok: true, page: pageKey, file, screenshot: shot }))
  } catch (e) {
    let shot = null
    if (env('SCREENSHOT_ON_ERROR', 'true') !== 'false') shot = await screenshot(page, `ivt-${pageKey}-error`)
    console.error(JSON.stringify({ ok: false, page: pageKey, file, error: String(e?.message || e), screenshot: shot }))
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
