#!/usr/bin/env node
// AI-GATE 桌面連接器
//   node src/index.mjs pair XXXX-XXXX   以網頁產生的配對碼配對這台電腦
//   node src/index.mjs run              常駐：領取網頁任務並定時同步 AdsPower 設定檔
//   node src/index.mjs sync             立即同步一次
//   node src/index.mjs status           檢查 AI-GATE 與 AdsPower 連線
import os from 'node:os'
import readline from 'node:readline/promises'
import { loadConfig, saveConfig, CONFIG_PATH } from './config.mjs'
import { createAigate } from './aigate.mjs'
import { createAdsPower } from './adspower.mjs'
import { handleTask, syncProfiles } from './tasks.mjs'

const log = msg => console.log(`[${new Date().toLocaleString()}] ${msg}`)
const sleep = ms => new Promise(r => setTimeout(r, ms))

function requireToken(cfg) {
  if (!cfg.token) throw new Error('尚未配對。請到 AI-GATE「社群矩陣 → 帳號矩陣 → 桌面連接器」產生配對碼')
}

async function cmdPair(code) {
  if (!code) { console.error('用法：npm run pair -- XXXX-XXXX'); process.exit(1) }
  const cfg = loadConfig()
  const res = await createAigate({ ...cfg, token: '' }).pair(code, `${os.hostname()}（${process.platform === 'win32' ? 'Windows' : process.platform}）`)
  saveConfig({ ...cfg, token: res.token, deviceId: res.device?.id })
  log(`配對成功：${res.device?.name}。設定已存於 ${CONFIG_PATH}`)
}

async function cmdStatus() {
  const cfg = loadConfig()
  requireToken(cfg)
  const ads = createAdsPower(cfg)
  try { await ads.status(); log(`AdsPower Local API 正常（${cfg.adspowerUrl}）`) } catch (e) { log(`AdsPower：${e.message}`) }
  try {
    const { profiles } = await createAigate(cfg).profiles()
    log(`AI-GATE 連線正常，可同步帳號 ${profiles.length} 個`)
  } catch (e) { log(`AI-GATE：${e.message}`) }
}

async function cmdSync() {
  const cfg = loadConfig()
  requireToken(cfg)
  await syncProfiles({ ads: createAdsPower(cfg), aigate: createAigate(cfg), cfg, log })
  saveConfig(cfg)
}

async function cmdRun() {
  const cfg = loadConfig()
  requireToken(cfg)
  const ctx = { ads: createAdsPower(cfg), aigate: createAigate(cfg), cfg, log }
  log('AI-GATE 桌面連接器已啟動（Ctrl+C 結束）')

  let nextSync = 0
  for (;;) {
    try {
      if (Date.now() >= nextSync) {
        await syncProfiles(ctx).catch(e => log(`自動同步失敗：${e.message}`))
        saveConfig(cfg)
        nextSync = Date.now() + cfg.syncMinutes * 60 * 1000
      }
      const { tasks } = await ctx.aigate.claimTasks()
      for (const task of tasks) {
        try {
          const result = await handleTask(task, ctx)
          await ctx.aigate.reportTask(task.id, 'done', result ?? {})
        } catch (e) {
          log(`任務失敗（${task.type}）：${e.message}`)
          await ctx.aigate.reportTask(task.id, 'failed', { error: e.message }).catch(() => {})
        }
      }
    } catch (e) {
      if (e.status === 401) {
        saveConfig({ ...cfg, token: undefined })
        throw new Error(`${e.message}。已清除舊配對，請重新開啟程式並輸入新的配對碼`)
      }
      log(`連線錯誤：${e.message}`)
    }
    await sleep(cfg.pollSeconds * 1000)
  }
}

// 雙擊 .exe（無參數）：未配對就先詢問配對碼，再常駐執行；出錯時停住視窗讓使用者看得到訊息
async function cmdDefault() {
  const cfg = loadConfig()
  if (!cfg.token) {
    console.log('歡迎使用 AI-GATE 桌面連接器')
    console.log('請到 AI-GATE「社群矩陣 → 帳號矩陣 → 桌面連接器」按「產生配對碼」')
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const code = (await rl.question('請輸入配對碼（XXXX-XXXX）：')).trim()
    rl.close()
    await cmdPair(code)
  }
  await cmdRun()
}

async function pauseOnError(e) {
  console.error(`\n錯誤：${e.message}`)
  if (process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    await rl.question('按 Enter 關閉視窗…')
    rl.close()
  }
  process.exit(1)
}

const [cmd, arg] = process.argv.slice(2)
const commands = { pair: () => cmdPair(arg), run: cmdRun, sync: cmdSync, status: cmdStatus }
if (!cmd) {
  cmdDefault().catch(pauseOnError)
} else if (!commands[cmd]) {
  console.log('用法：pair <配對碼> | run | sync | status（不帶參數＝引導配對後常駐）')
  process.exit(1)
} else {
  commands[cmd]().catch(e => { console.error(e.message); process.exit(1) })
}
