/**
 * AI GATE — 門市點單本機 Bridge（Debian）
 *
 * 職責：ESC/POS 列印、離線訂單佇列同步輔助
 * 印表機驅動待確認型號後實作（目前 stub 輸出文字）
 *
 * 環境變數:
 *   PORT=3002
 *   DEVICE_KEY=終端 device_key
 *   AIGATE_URL=https://work.im-tourist.com
 *   KIOSK_PRINTER=點單機印表機的 CUPS 名稱（印給客人）
 *   BAR_PRINTER=吧檯印表機的 CUPS 名稱（印給店員）
 *   CHROMIUM_BIN=chromium（單據轉 PDF 用，越南文字才不會亂碼）
 *   PAPER_WIDTH_MM=80
 */
import express from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const run = promisify(execFile)
const app = express()

// 點單頁在 https 網域，呼叫本機 http://localhost 需要 CORS 與 Private Network Access 標頭
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
app.use(express.json())

const PORT = process.env.PORT || 3002
const DEVICE_KEY = process.env.DEVICE_KEY || ''
const AIGATE_URL = process.env.AIGATE_URL || ''
const QUEUE_FILE = path.join('./data', 'order-queue.json')

fs.mkdirSync('./data', { recursive: true })

function loadQueue() {
  try {
    return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'))
  } catch {
    return []
  }
}

function saveQueue(q) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2))
}

/** 印表機抽象層 — 確認型號後替換為 escpos-usb / bluetooth */
async function printReceipt(payload) {
  const lines = formatReceipt(payload)
  console.log('─── RECEIPT ───')
  console.log(lines)
  console.log('───────────────')
  return { ok: true, mode: 'console-stub' }
}

function formatReceipt({ order, store }) {
  const o = order || {}
  const items = (o.items || []).map(l => {
    const mods = (l.modifiers || []).map(m => m.optionLabel).join('、')
    return `${l.name} x${l.qty} ${mods ? `(${mods})` : ''}`
  })
  return [
    store || '門市',
    `類型: ${o.order_type || ''}`,
    o.table_label ? `桌號: ${o.table_label}` : '',
    '---',
    ...items,
    '---',
    `備註: ${o.note || ''}`,
  ].filter(Boolean).join('\n')
}

// ── 點單機列印模式：客人聯 + 吧檯聯 ─────────────────────────

const KIOSK_PRINTER = process.env.KIOSK_PRINTER || ''
const BAR_PRINTER = process.env.BAR_PRINTER || ''
const CHROMIUM_BIN = process.env.CHROMIUM_BIN || 'chromium'
const PAPER_WIDTH_MM = Number(process.env.PAPER_WIDTH_MM || 80)

const vnd = new Intl.NumberFormat('vi-VN')
const money = n => `${vnd.format(Math.round(n))}₫`
const esc = s =>
  String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function ticketHtml(t, copy) {
  const dine = t.dineOption === 'takeaway' ? 'MANG ĐI' : 'TẠI CHỖ'
  const time = new Date(t.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  const rows = t.lines
    .map(
      l => `<tr><td class="q">${l.qty}×</td><td>${esc(l.name)}${l.detail ? `<div class="d">${esc(l.detail)}</div>` : ''}</td><td class="r">${money(l.lineTotal)}</td></tr>`
    )
    .join('')
  // 長度依品項數估算（Chrome 的 PDF 不支援 auto 高度）
  const heightMm = 95 + t.lines.length * 14
  const footer =
    copy === 'bar'
      ? '<p class="big">CHƯA THANH TOÁN</p><p>Thu tiền tại quầy, nhập đơn vào FABI</p>'
      : '<p class="big">Vui lòng thanh toán tại quầy</p><p>Please pay at the counter · 請至櫃台結帳</p>'
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: ${PAPER_WIDTH_MM}mm ${heightMm}mm; margin: 3mm }
body { font-family: "Noto Sans", "DejaVu Sans", sans-serif; font-size: 12pt; margin: 0 }
h1 { font-size: 13pt; margin: 0 0 2mm; text-align: center }
.no { font-size: 40pt; font-weight: 700; text-align: center; margin: 1mm 0 }
.tag { text-align: center; font-weight: 700; border: 2px solid #000; padding: 1mm; margin: 1mm 0 }
table { width: 100%; border-collapse: collapse; margin-top: 2mm }
td { vertical-align: top; padding: 1mm 0; border-bottom: 1px dashed #000 }
.q { width: 9mm; font-weight: 700 } .r { text-align: right; white-space: nowrap }
.d { font-size: 9.5pt } .tot { font-size: 15pt; font-weight: 700; text-align: right; margin-top: 2mm }
p { margin: 1mm 0; text-align: center; font-size: 10pt } .big { font-size: 13pt; font-weight: 700 }
</style></head><body>
<h1>${esc(t.storeName)}</h1>
<div class="tag">${copy === 'bar' ? 'PHIẾU QUẦY · ' : ''}${dine}</div>
<div class="no">#${esc(t.orderNo)}</div>
<p>${esc(time)}${t.phone ? ` · TV ${esc(t.phone)}` : ''}</p>
<table>${rows}</table>
<div class="tot">${money(t.total)}</div>
${footer}
</body></html>`
}

async function printHtml(printer, html, label) {
  if (!printer) {
    console.log(`─── ${label}（未設定印表機，只印在畫面）───`)
    console.log(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    return { printer: null, mode: 'console-stub' }
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-'))
  const htmlFile = path.join(dir, 'ticket.html')
  const pdfFile = path.join(dir, 'ticket.pdf')
  try {
    fs.writeFileSync(htmlFile, html)
    await run(CHROMIUM_BIN, ['--headless', '--no-sandbox', '--no-pdf-header-footer', `--print-to-pdf=${pdfFile}`, `file://${htmlFile}`], { timeout: 20000 })
    await run('lp', ['-d', printer, pdfFile], { timeout: 10000 })
    return { printer, mode: 'cups' }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

app.post('/print/ticket', async (req, res) => {
  const t = req.body?.ticket
  if (!t || !Array.isArray(t.lines)) return res.status(400).json({ ok: false, error: 'ticket required' })
  const [kiosk, bar] = await Promise.allSettled([
    printHtml(KIOSK_PRINTER, ticketHtml(t, 'customer'), 'CUSTOMER'),
    printHtml(BAR_PRINTER, ticketHtml(t, 'bar'), 'BAR'),
  ])
  const result = r => (r.status === 'fulfilled' ? { ok: true, ...r.value } : { ok: false, error: String(r.reason?.message || r.reason) })
  const out = { customer: result(kiosk), bar: result(bar) }
  if (!out.customer.ok || !out.bar.ok) console.error('print/ticket failed', out)
  res.status(out.customer.ok && out.bar.ok ? 200 : 502).json({ ok: out.customer.ok && out.bar.ok, ...out })
})

app.get('/health', (_, res) =>
  res.json({ ok: true, kioskPrinter: KIOSK_PRINTER || null, barPrinter: BAR_PRINTER || null })
)

app.post('/print/receipt', async (req, res) => {
  try {
    const result = await printReceipt(req.body)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/print/kitchen', async (req, res) => {
  try {
    const result = await printReceipt({ ...req.body, label: 'KITCHEN' })
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** 從本機佇列推送到雲端 */
app.post('/sync/push', async (_, res) => {
  if (!DEVICE_KEY || !AIGATE_URL) {
    return res.status(400).json({ error: 'DEVICE_KEY and AIGATE_URL required' })
  }
  const q = loadQueue()
  const remain = []
  let synced = 0
  for (const item of q) {
    try {
      const r = await fetch(`${AIGATE_URL}/api/pos/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-terminal-key': DEVICE_KEY },
        body: JSON.stringify(item.payload),
      })
      if (!r.ok) throw new Error(await r.text())
      synced++
    } catch {
      remain.push(item)
    }
  }
  saveQueue(remain)
  res.json({ synced, pending: remain.length })
})

/** 拉取菜單寫入本機 */
app.post('/sync/pull', async (_, res) => {
  if (!DEVICE_KEY || !AIGATE_URL) {
    return res.status(400).json({ error: 'DEVICE_KEY and AIGATE_URL required' })
  }
  const r = await fetch(`${AIGATE_URL}/api/pos/sync/menu`, {
    headers: { 'x-terminal-key': DEVICE_KEY },
  })
  const data = await r.json()
  if (data.changed) {
    fs.writeFileSync(path.join('./data', 'menu.json'), JSON.stringify(data, null, 2))
  }
  res.json({ revision: data.revision, changed: data.changed })
})

app.listen(PORT, () => {
  console.log(`POS bridge on :${PORT} (printer: stub)`)
})
