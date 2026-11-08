// 多分鏡配音影片合成：向主 app 領取任務 → 逐段請主 app 產圖＋配音 → 套版型截圖 → ffmpeg 合成 → 上傳 → 回報
// 用法：node run.mjs video-render            處理一筆後結束（沒有任務就直接結束）
//       node run.mjs video-render --loop     常駐，每 POLL_SECONDS 秒檢查一次
// 需要：APP_BASE_URL、WORKER_SECRET；系統需安裝 ffmpeg / ffprobe 與中文字型（見 README）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { env } from '../lib/browser.mjs'
import { renderFrameHtml } from '../lib/story-templates.mjs'

const FFMPEG = env('FFMPEG_PATH', 'ffmpeg')
const FFPROBE = env('FFPROBE_PATH', 'ffprobe')
const FPS = 30
const TAIL_SECONDS = 0.35 // 每段旁白後留一點空白，換段不擠

function api(action, body) {
  const base = env('APP_BASE_URL').replace(/\/$/, '')
  const secret = env('WORKER_SECRET')
  if (!base || !secret) throw new Error('缺 APP_BASE_URL / WORKER_SECRET')
  return fetch(`${base}/api/worker/video-render/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-worker-secret': secret },
    body: JSON.stringify(body ?? {}),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`${action} 失敗 (HTTP ${res.status})：${data.error ?? ''}`)
    return data
  })
}

function exec(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = '', err = ''
    p.stdout.on('data', (d) => { out += d })
    p.stderr.on('data', (d) => { err += d })
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} 結束碼 ${code}：${err.slice(-800)}`))))
  })
}

async function download(url, file) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下載失敗 (HTTP ${res.status})：${url}`)
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
}

async function mediaDuration(file) {
  const out = await exec(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file])
  const sec = Number(out.trim())
  if (!(sec > 0)) throw new Error(`無法取得長度：${file}`)
  return sec
}

/** 背景音樂：BGM_DIR 內隨機挑一首（請自備有授權的音樂） */
function pickBgm() {
  const dir = env('BGM_DIR')
  if (!dir || !fs.existsSync(dir)) return null
  const files = fs.readdirSync(dir).filter((f) => /\.(mp3|m4a|aac|wav)$/i.test(f))
  return files.length ? path.join(dir, files[Math.floor(Math.random() * files.length)]) : null
}

async function renderJob(job, browser) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `story-${job.id}-`))
  try {
    const page = await browser.newPage()
    const segments = []
    let total = 0

    for (let i = 0; i < job.scenes.length; i++) {
      const { scene } = await api('scene', { jobId: job.id, index: i })
      const img = path.join(dir, `img-${i}`)
      const audio = path.join(dir, `voice-${i}.mp3`)
      await download(scene.image_url, img)
      await download(scene.audio_url, audio)

      // 版型 HTML 存成檔案再開啟，才能讀到本機圖片
      const { html, width, height } = renderFrameHtml(job.template, job.aspect, {
        title: i === 0 ? job.title : '',
        narration: scene.narration,
        image: pathToFileURL(img).href,
      })
      const htmlFile = path.join(dir, `frame-${i}.html`)
      fs.writeFileSync(htmlFile, html)
      await page.setViewportSize({ width, height })
      await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' })
      await page.evaluate(() => document.fonts.ready)
      const frame = path.join(dir, `frame-${i}.png`)
      await page.screenshot({ path: frame })

      const dur = (await mediaDuration(audio)) + TAIL_SECONDS
      total += dur
      const seg = path.join(dir, `seg-${i}.mp4`)
      // 單張畫面以 zoompan 展開成整段影格並緩慢放大（Ken Burns），音訊補靜音到段落長度；各段參數一致才能無損串接
      const frames = Math.ceil(dur * FPS)
      await exec(FFMPEG, [
        '-y', '-i', frame, '-i', audio,
        '-filter_complex',
        `[0:v]scale=${width * 2}:${height * 2},zoompan=z='min(zoom+0.0006,1.08)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${FPS},format=yuv420p[v];[1:a]apad,aresample=44100[a]`,
        '-map', '[v]', '-map', '[a]', '-t', dur.toFixed(3),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', String(FPS),
        '-c:a', 'aac', '-b:a', '160k', '-ac', '2', '-ar', '44100',
        seg,
      ])
      segments.push(seg)
      console.log(JSON.stringify({ job: job.id, scene: i + 1, of: job.scenes.length, seconds: Number(dur.toFixed(2)) }))
    }
    await page.close()

    const list = path.join(dir, 'list.txt')
    fs.writeFileSync(list, segments.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join('\n'))
    const joined = path.join(dir, 'joined.mp4')
    await exec(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', joined])

    let output = joined
    const bgm = job.bgm ? pickBgm() : null
    if (bgm) {
      output = path.join(dir, 'final.mp4')
      const vol = env('BGM_VOLUME', '0.12')
      await exec(FFMPEG, [
        '-y', '-i', joined, '-stream_loop', '-1', '-i', bgm,
        '-filter_complex', `[1:a]volume=${vol},afade=t=out:st=${Math.max(0, total - 1.5).toFixed(2)}:d=1.5[b];[0:a][b]amix=inputs=2:duration=first:dropout_transition=0[a]`,
        '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', output,
      ])
    }

    const { signedUrl } = await api('upload-url', { jobId: job.id })
    const up = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
      body: fs.readFileSync(output),
    })
    if (!up.ok) throw new Error(`上傳失敗 (HTTP ${up.status})：${(await up.text()).slice(0, 300)}`)

    await api('complete', { jobId: job.id, ok: true, durationSec: Number(total.toFixed(2)) })
    console.log(JSON.stringify({ ok: true, job: job.id, seconds: Number(total.toFixed(2)) }))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

async function processOne(browser) {
  const { job } = await api('claim')
  if (!job) return false
  try {
    await renderJob(job, browser)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(JSON.stringify({ ok: false, job: job.id, error: message }))
    await api('complete', { jobId: job.id, ok: false, error: message }).catch(() => {})
  }
  return true
}

export async function run(args) {
  const browser = await chromium.launch({ headless: true, executablePath: env('CHROMIUM_PATH') || undefined })
  try {
    if (args.loop !== 'true') {
      const did = await processOne(browser)
      if (!did) console.log(JSON.stringify({ ok: true, idle: true }))
      return
    }
    const wait = Number(env('POLL_SECONDS', '15')) * 1000
    for (;;) {
      const did = await processOne(browser).catch((e) => {
        console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
        return false
      })
      if (!did) await new Promise((r) => setTimeout(r, wait))
    }
  } finally {
    await browser.close()
  }
}

