// 打包 AI-GATE 桌面連接器（檔名一律英文，避免舊版解壓縮工具把中文檔名變亂碼）
//
//   node scripts/build-exe.mjs           只打包目前系統的單一執行檔（開發測試用）
//   node scripts/build-exe.mjs --windows 在 Windows 打包所有 Windows 版本（GitHub Actions 使用）：
//     AI-GATE-Connector.exe              Win10/11 64 位元
//     AI-GATE-Connector-x86.exe          Win10/11 32 位元
//     AI-GATE-Connector-arm64.exe        Win11 ARM（Surface 等）
//     AI-GATE-Connector-Win7-x64.zip     Win7／8／8.1 64 位元（解壓後雙擊 Start-Connector.cmd）
//     AI-GATE-Connector-Win7-x86.zip     Win7／8／8.1 32 位元
//
// Win10/11：Node.js 22 Single Executable Application（esbuild 合併成單檔 → SEA blob → postject 注入 node.exe）。
// Win7／8：Node.js 22 不支援，改用最後支援 Win7 的 Node.js 12.22.12，附 node.exe 與程式的免安裝壓縮檔。
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const dist = path.join(root, 'dist')
const work = path.join(dist, '.work')
const isWin = process.platform === 'win32'
const allWindows = process.argv.includes('--windows')

const LEGACY_NODE = '12.22.12'
// ws 的選用加速模組不打包，執行時找不到會自動略過
const EXTERNAL = ['bufferutil', 'utf-8-validate']

fs.rmSync(dist, { recursive: true, force: true })
fs.mkdirSync(work, { recursive: true })

async function bundle(target, outfile) {
  await build({
    entryPoints: [path.join(root, 'src/index.mjs')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target,
    external: EXTERNAL,
    outfile,
  })
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下載失敗 ${url}：HTTP ${res.status}`)
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  return dest
}

/** 把 SEA blob 注入指定的 node 執行檔 */
function inject(nodeBinary, exe, blob) {
  fs.copyFileSync(nodeBinary, exe)
  if (isWin) {
    // 官方 node.exe 帶有簽章，注入前需移除（有安裝 signtool 時）
    try { execFileSync('signtool', ['remove', '/s', exe], { stdio: 'ignore' }) } catch { /* 無 signtool 可略過 */ }
  }
  const postject = path.join(root, 'node_modules', '.bin', isWin ? 'postject.cmd' : 'postject')
  const args = [exe, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2']
  if (process.platform === 'darwin') args.push('--macho-segment-name', 'NODE_SEA')
  execFileSync(postject, args, { stdio: 'inherit', shell: isWin })
  console.log(`完成：${path.relative(root, exe)}`)
}

// ── 新版（Node 22 單一執行檔）──
const modernCjs = path.join(work, 'connector.cjs')
await bundle('node22', modernCjs)
const blob = path.join(work, 'sea-prep.blob')
const seaConfig = path.join(work, 'sea-config.json')
fs.writeFileSync(seaConfig, JSON.stringify({ main: modernCjs, output: blob, disableExperimentalSEAWarning: true }))
execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], { stdio: 'inherit' })

if (!allWindows) {
  inject(process.execPath, path.join(dist, isWin ? 'AI-GATE-Connector.exe' : 'ai-gate-connector'), blob)
  process.exit(0)
}

if (!isWin) throw new Error('--windows 需在 Windows 上執行')
if (process.arch !== 'x64') throw new Error('--windows 需用 64 位元 Node.js 執行')

// SEA blob 與 Node 版本綁定，其他架構一律下載同版本的官方 node.exe
const v = process.versions.node
inject(process.execPath, path.join(dist, 'AI-GATE-Connector.exe'), blob)
for (const arch of ['x86', 'arm64']) {
  const nodeExe = await download(`https://nodejs.org/dist/v${v}/win-${arch}/node.exe`, path.join(work, `node-${v}-${arch}.exe`))
  inject(nodeExe, path.join(dist, `AI-GATE-Connector-${arch}.exe`), blob)
}

// ── Win7／8 版（Node 12 免安裝壓縮檔）──
const legacyCjs = path.join(work, 'connector-legacy.cjs')
await bundle('node12', legacyCjs)
const LAUNCHER = [
  '@echo off',
  'chcp 65001 >nul',
  'title AI-GATE Connector',
  'cd /d "%~dp0"',
  'node.exe connector.cjs %*',
  '',
].join('\r\n')
const README = [
  'AI-GATE 桌面連接器（Windows 7／8／8.1 版）',
  '',
  '1. 把整個資料夾解壓縮到固定位置（例如 C:\\AI-GATE-Connector），不要在壓縮檔內直接執行',
  '2. 雙擊 Start-Connector.cmd，輸入 AI-GATE 網頁產生的配對碼',
  '3. 之後每次雙擊 Start-Connector.cmd 即可啟動',
  '',
  '需求：AdsPower 已開啟並啟用 Local API。Windows 10／11 請改用 AI-GATE-Connector.exe。',
  '',
].join('\r\n')

for (const arch of ['x64', 'x86']) {
  const folder = path.join(work, `win7-${arch}`, 'AI-GATE-Connector')
  fs.mkdirSync(folder, { recursive: true })
  await download(`https://nodejs.org/dist/v${LEGACY_NODE}/win-${arch}/node.exe`, path.join(folder, 'node.exe'))
  fs.copyFileSync(legacyCjs, path.join(folder, 'connector.cjs'))
  fs.writeFileSync(path.join(folder, 'Start-Connector.cmd'), LAUNCHER)
  fs.writeFileSync(path.join(folder, 'README.txt'), `\ufeff${README}`)
  const zip = path.join(dist, `AI-GATE-Connector-Win7-${arch}.zip`)
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Compress-Archive -Path '${folder}' -DestinationPath '${zip}' -Force`], { stdio: 'inherit' })
  console.log(`完成：${path.relative(root, zip)}`)
}

fs.rmSync(work, { recursive: true, force: true })
