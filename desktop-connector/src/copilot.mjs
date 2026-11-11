// Copilot 帶入：在 AdsPower 瀏覽器開啟目標社團並把文案放進剪貼簿，發布由使用者自己按。
// 瀏覽器 CDP 位址取自 AdsPower start 回傳的 ws.puppeteer（AdsPower 官方 local-api-mcp schemas.ts）。
import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { openWebSocket } from './compat.mjs'

/** 透過 Chrome DevTools Protocol 在已開啟的瀏覽器新增分頁並切到前景 */
export function openTab(wsUrl, url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = openWebSocket(wsUrl)
    const timer = setTimeout(() => { ws.close(); reject(new Error('連線瀏覽器逾時')) }, timeoutMs)
    let id = 0
    const pending = new Map()
    const send = (method, params) => new Promise((res, rej) => {
      const msgId = ++id
      pending.set(msgId, { res, rej })
      ws.send(JSON.stringify({ id: msgId, method, params }))
    })
    const done = (err, value) => { clearTimeout(timer); ws.close(); err ? reject(err) : resolve(value) }

    ws.addEventListener('message', ev => {
      const msg = JSON.parse(String(ev.data))
      const p = pending.get(msg.id)
      if (!p) return
      pending.delete(msg.id)
      msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result)
    })
    ws.addEventListener('error', () => done(new Error('無法連線到 AdsPower 瀏覽器')))
    ws.addEventListener('open', async () => {
      try {
        const { targetId } = await send('Target.createTarget', { url })
        await send('Target.activateTarget', { targetId }).catch(() => {})
        done(null, targetId)
      } catch (e) {
        done(e)
      }
    })
  })
}

/** Windows 內建 clip.exe（Win7 起都有）：以 UTF-16LE＋BOM 傳入才能正確處理中文 */
function clipExe(text) {
  return new Promise(resolve => {
    const child = execFile('clip.exe', [], { windowsHide: true }, err => resolve(!err))
    child.on('error', () => resolve(false))
    child.stdin.end(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]))
  })
}

/**
 * 寫入系統剪貼簿；Windows 先用 PowerShell Set-Clipboard（Base64 傳遞避免編碼與跳脫問題），
 * Win7 內建的 PowerShell 2.0 沒有 Set-Clipboard，失敗時改用 clip.exe
 */
export function copyToClipboard(text) {
  return new Promise(resolve => {
    if (process.platform === 'win32') {
      const b64 = Buffer.from(text, 'utf8').toString('base64')
      const script = `Set-Clipboard -Value ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')))`
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true },
        err => (err ? clipExe(text).then(resolve) : resolve(true)))
      return
    }
    const cmd = process.platform === 'darwin' ? 'pbcopy' : 'xclip'
    const args = process.platform === 'darwin' ? [] : ['-selection', 'clipboard']
    const child = execFile(cmd, args, err => resolve(!err))
    child.on('error', () => resolve(false))
    child.stdin?.end(text)
  })
}

/** LINE 電腦版執行檔：LINE_PATH 環境變數，或預設安裝位置 %LOCALAPPDATA%\LINE\bin\LineLauncher.exe */
export function findLinePc() {
  const candidates = [
    process.env.LINE_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'LINE', 'bin', 'LineLauncher.exe'),
  ].filter(Boolean)
  return candidates.find(p => fs.existsSync(p)) ?? null
}

/** 開啟（或切到）LINE 電腦版；已開啟時 LINE 會把既有視窗帶到前景 */
export function launchLinePc() {
  const exe = findLinePc()
  if (!exe) throw new Error('找不到 LINE 電腦版，請先安裝，或設定環境變數 LINE_PATH 指向 LineLauncher.exe')
  const child = spawn(exe, [], { detached: true, stdio: 'ignore', windowsHide: false })
  child.on('error', () => {})
  child.unref()
  return exe
}
