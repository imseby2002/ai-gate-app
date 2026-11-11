// 相容層：讓連接器同時能在 Node 22（Win10/11 單一執行檔）與 Node 12（Win7 版）執行。
// Node 22 有內建 fetch／WebSocket，直接使用；Node 12 沒有，改用 http(s) 與 ws 套件。
import http from 'node:http'
import https from 'node:https'
import readline from 'node:readline'
import WsClient from 'ws'

/** 精簡版 fetch：只支援連接器用到的 method、headers、body 與 res.ok／status／json()／text() */
function fetchLite(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request(u, {
      method,
      headers: { ...headers, ...(body != null ? { 'Content-Length': Buffer.byteLength(body) } : {}) },
      timeout: 30000,
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: async () => text,
          json: async () => JSON.parse(text),
        })
      })
      res.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('連線逾時')))
    req.on('error', reject)
    if (body != null) req.write(body)
    req.end()
  })
}

export const httpFetch = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : fetchLite

/** WebSocket：有內建就用內建，否則用 ws 套件（同樣支援 addEventListener 與 ev.data） */
export function openWebSocket(url) {
  return typeof globalThis.WebSocket === 'function' ? new globalThis.WebSocket(url) : new WsClient(url)
}

/** 在主控台詢問一行輸入（不使用 readline/promises，Node 12 也能用） */
export function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, answer => { rl.close(); resolve(answer) })
  })
}
