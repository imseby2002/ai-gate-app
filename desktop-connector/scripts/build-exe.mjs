// 打包成單一執行檔（Node.js Single Executable Application）
//   1. esbuild 合併成單一 CommonJS 檔
//   2. node --experimental-sea-config 產生 blob
//   3. 複製目前的 node 執行檔，postject 注入 blob
// 在 Windows 執行產出 AI-GATE-Connector.exe；在其他系統執行則產出該系統的執行檔（供測試）
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const dist = path.join(root, 'dist')
const isWin = process.platform === 'win32'
const exe = path.join(dist, isWin ? 'AI-GATE-Connector.exe' : 'ai-gate-connector')

fs.rmSync(dist, { recursive: true, force: true })
fs.mkdirSync(dist, { recursive: true })

await build({
  entryPoints: [path.join(root, 'src/index.mjs')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: path.join(dist, 'connector.cjs'),
})

const seaConfig = path.join(dist, 'sea-config.json')
fs.writeFileSync(seaConfig, JSON.stringify({
  main: path.join(dist, 'connector.cjs'),
  output: path.join(dist, 'sea-prep.blob'),
  disableExperimentalSEAWarning: true,
}))
execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], { stdio: 'inherit' })

fs.copyFileSync(process.execPath, exe)
if (isWin) {
  // 官方 node.exe 帶有簽章，注入前需移除（有安裝 signtool 時）
  try { execFileSync('signtool', ['remove', '/s', exe], { stdio: 'ignore' }) } catch { /* 無 signtool 可略過 */ }
}

const postject = path.join(root, 'node_modules', '.bin', isWin ? 'postject.cmd' : 'postject')
const args = [exe, 'NODE_SEA_BLOB', path.join(dist, 'sea-prep.blob'), '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2']
if (process.platform === 'darwin') args.push('--macho-segment-name', 'NODE_SEA')
execFileSync(postject, args, { stdio: 'inherit', shell: isWin })

console.log(`完成：${exe}`)
