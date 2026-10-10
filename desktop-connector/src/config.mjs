// 設定檔存在使用者目錄（Windows：%APPDATA%\ai-gate-connector\config.json），內含裝置 token，勿外流
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dir = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'ai-gate-connector')
  : path.join(os.homedir(), '.ai-gate-connector')
const file = path.join(dir, 'config.json')

export const DEFAULTS = {
  appUrl: 'https://www.im-tourist.com',
  adspowerUrl: 'http://127.0.0.1:50325',
  adspowerApiKey: '',
  adspowerGroupName: 'AI-GATE',
  pollSeconds: 5,
  syncMinutes: 10,
}

// 只持久化配對與群組資訊；網址、金鑰以環境變數為準（優先於設定檔）
const PERSISTED = ['token', 'deviceId', 'adspowerGroupId', 'appUrl', 'adspowerUrl']

function envOverrides() {
  return Object.fromEntries(Object.entries({
    appUrl: process.env.AIGATE_URL,
    adspowerUrl: process.env.ADSPOWER_API,
    adspowerApiKey: process.env.ADSPOWER_API_KEY,
  }).filter(([, v]) => v))
}

export function loadConfig() {
  let saved = {}
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { /* 首次執行 */ }
  return { ...DEFAULTS, ...saved, ...envOverrides() }
}

export function saveConfig(cfg) {
  fs.mkdirSync(dir, { recursive: true })
  const out = Object.fromEntries(PERSISTED.filter(k => cfg[k] != null).map(k => [k, cfg[k]]))
  fs.writeFileSync(file, JSON.stringify(out, null, 2), { mode: 0o600 })
}

export const CONFIG_PATH = file
