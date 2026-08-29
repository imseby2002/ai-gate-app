// 任務：把一份 xlsx 上傳到 IVT 指定頁（盤點 / 訂貨）。
// 用法：node run.mjs ivt-upload --page stock-taking|purchase-order --file /path/to.xlsx
import fs from 'node:fs'
import { env, firstVisible, screenshot, launch, loginIvt } from '../lib/browser.mjs'

const PAGE_URL = {
  'stock-taking': () => env('IVT_PAGE_STOCK_TAKING', 'https://ivt.ipos.vn/stock/stock-taking'),
  'purchase-order': () => env('IVT_PAGE_PURCHASE_ORDER', 'https://ivt.ipos.vn/order/purchase-order-internal'),
}

export async function run(args) {
  const pageKey = args.page
  const file = args.file
  if (!pageKey || !PAGE_URL[pageKey]) throw new Error(`--page 需為 ${Object.keys(PAGE_URL).join(' | ')}`)
  if (!file || !fs.existsSync(file)) throw new Error(`找不到檔案：${file}（請用 --file 指定 xlsx 路徑）`)

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
