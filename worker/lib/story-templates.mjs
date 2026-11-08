// 多分鏡配音影片的畫面版型（HTML → Playwright 截圖成 PNG，再由 ffmpeg 合成）
// 版型概念（每段：標題＋畫面＋字幕）參考 Pixelle-Video（AIDC-AI，Apache-2.0），HTML/CSS 為本專案自行撰寫。

export const SIZES = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const FONT = `'Noto Sans CJK TC', 'Noto Sans TC', 'Noto Sans CJK SC', 'Noto Sans', 'PingFang TC', 'Microsoft JhengHei', sans-serif`

function page(width, height, css, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0}
body{width:${width}px;height:${height}px;overflow:hidden;font-family:${FONT};position:relative}
${css}
</style></head><body>${body}</body></html>`
}

// 標題在上、圖片置中、字幕在下（淺色底）
function classic({ width, height, title, narration, image }) {
  const pad = Math.round(width * 0.06)
  const fs = Math.round(width * 0.046)
  return page(width, height, `
body{background:linear-gradient(180deg,#f7f7f5 0%,#ecebe6 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${pad}px;padding:${pad}px;box-sizing:border-box}
.title{font-size:${Math.round(fs * 1.25)}px;font-weight:800;color:#1f2933;text-align:center;line-height:1.3;max-width:90%}
.img{width:100%;flex:1;min-height:0;border-radius:${Math.round(pad / 2)}px;background:url("${esc(image)}") center/cover no-repeat;box-shadow:0 20px 50px rgba(0,0,0,.18)}
.sub{font-size:${fs}px;font-weight:600;color:#1f2933;text-align:center;line-height:1.5;max-width:92%}`,
  `${title ? `<div class="title">${esc(title)}</div>` : ''}<div class="img"></div><div class="sub">${esc(narration)}</div>`)
}

// 圖片滿版、底部漸層＋白色字幕
function fullbleed({ width, height, title, narration, image }) {
  const pad = Math.round(width * 0.07)
  const fs = Math.round(width * 0.05)
  return page(width, height, `
body{background:#000 url("${esc(image)}") center/cover no-repeat}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.45) 0%,rgba(0,0,0,0) 22%,rgba(0,0,0,0) 55%,rgba(0,0,0,.78) 100%)}
.title{position:absolute;top:${pad}px;left:${pad}px;right:${pad}px;font-size:${Math.round(fs * 1.1)}px;font-weight:800;color:#fff;text-align:center;text-shadow:0 2px 12px rgba(0,0,0,.6)}
.sub{position:absolute;bottom:${Math.round(pad * 1.6)}px;left:${pad}px;right:${pad}px;font-size:${fs}px;font-weight:700;color:#fff;text-align:center;line-height:1.5;text-shadow:0 2px 10px rgba(0,0,0,.8)}`,
  `<div class="shade"></div>${title ? `<div class="title">${esc(title)}</div>` : ''}<div class="sub">${esc(narration)}</div>`)
}

// 模糊背景＋白色卡片（圖＋字幕）
function card({ width, height, title, narration, image }) {
  const pad = Math.round(width * 0.07)
  const fs = Math.round(width * 0.044)
  return page(width, height, `
.bg{position:absolute;inset:-40px;background:url("${esc(image)}") center/cover no-repeat;filter:blur(36px) brightness(.75)}
.wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${pad}px;box-sizing:border-box;gap:${Math.round(pad / 1.5)}px}
.title{font-size:${Math.round(fs * 1.2)}px;font-weight:800;color:#fff;text-align:center;text-shadow:0 2px 12px rgba(0,0,0,.5)}
.card{width:100%;background:rgba(255,255,255,.94);border-radius:${pad}px;padding:${Math.round(pad / 1.6)}px;box-sizing:border-box;display:flex;flex-direction:column;gap:${Math.round(pad / 1.8)}px;box-shadow:0 24px 60px rgba(0,0,0,.35)}
.img{width:100%;aspect-ratio:${width >= height ? '16/9' : '4/5'};border-radius:${Math.round(pad / 2)}px;background:url("${esc(image)}") center/cover no-repeat}
.sub{font-size:${fs}px;font-weight:600;color:#1f2933;text-align:center;line-height:1.5}`,
  `<div class="bg"></div><div class="wrap">${title ? `<div class="title">${esc(title)}</div>` : ''}<div class="card"><div class="img"></div><div class="sub">${esc(narration)}</div></div></div>`)
}

const TEMPLATES = { classic, fullbleed, card }

/** 產生單一分鏡畫面的 HTML；image 為本機檔案的 file:// 網址 */
export function renderFrameHtml(template, aspect, { title, narration, image }) {
  const { width, height } = SIZES[aspect] ?? SIZES['9:16']
  const fn = TEMPLATES[template] ?? classic
  return { html: fn({ width, height, title, narration, image }), width, height }
}
