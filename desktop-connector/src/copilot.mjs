// Copilot 帶入：在 AdsPower 瀏覽器開啟目標社團並把文案放進剪貼簿，發布由使用者自己按。
// 瀏覽器 CDP 位址取自 AdsPower start 回傳的 ws.puppeteer（AdsPower 官方 local-api-mcp schemas.ts）。
import { execFile } from 'node:child_process'

/** 透過 Chrome DevTools Protocol 在已開啟的瀏覽器新增分頁並切到前景 */
export function openTab(wsUrl, url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
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

/** 寫入系統剪貼簿；Windows 以 PowerShell Set-Clipboard（Base64 傳遞避免編碼與跳脫問題） */
export function copyToClipboard(text) {
  return new Promise(resolve => {
    if (process.platform === 'win32') {
      const b64 = Buffer.from(text, 'utf8').toString('base64')
      const script = `Set-Clipboard -Value ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')))`
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true }, err => resolve(!err))
      return
    }
    const cmd = process.platform === 'darwin' ? 'pbcopy' : 'xclip'
    const args = process.platform === 'darwin' ? [] : ['-selection', 'clipboard']
    const child = execFile(cmd, args, err => resolve(!err))
    child.on('error', () => resolve(false))
    child.stdin?.end(text)
  })
}
