#!/usr/bin/env node
// 通用自動化 worker 進入點。各部門任務放在 tasks/ 下，於此註冊。
// 用法：node run.mjs <task> [--key value ...]
// 例：  node run.mjs ivt-upload --page stock-taking --file ./IVT盤點.xlsx
import 'dotenv/config'

const TASKS = {
  'ivt-upload': () => import('./tasks/ivt-upload.mjs'),
  // 日後其他部門：'xxx-download': () => import('./tasks/xxx-download.mjs'),
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
      out[key] = val
    }
  }
  return out
}

const [, , taskName, ...rest] = process.argv
if (!taskName || !TASKS[taskName]) {
  console.error(`未知任務。可用：${Object.keys(TASKS).join(', ')}`)
  console.error('用法：node run.mjs <task> [--key value ...]')
  process.exit(2)
}

const mod = await TASKS[taskName]()
await mod.run(parseArgs(rest))
