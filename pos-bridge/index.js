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
 */
import express from 'express'
import fs from 'fs'
import path from 'path'

const app = express()
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

app.get('/health', (_, res) => res.json({ ok: true, printer: 'stub' }))

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
