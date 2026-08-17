// 零依賴 .xlsx 讀取器（server 端）。解析 ZIP（中央目錄）+ zlib inflateRaw + 解析 sheet XML。
// 只取需要的資料：每個 worksheet 的儲存格值（字串/數字）。與既有 xlsx.ts（寫出）互補。
import { inflateRawSync } from 'zlib'

export type Cell = string | number | null
export type Rows = Cell[][]

interface ZipEntry { name: string; method: number; compSize: number; offset: number }

// ── ZIP：以中央目錄取得各檔案（大小/位移可靠，不受 data descriptor 影響）──
function readZipEntries(buf: Buffer): Map<string, Buffer> {
  // 找 EOCD（End Of Central Directory，簽名 0x06054b50），從尾端往前找
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('不是有效的 xlsx（找不到 ZIP EOCD）')
  const cdCount = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16) // 中央目錄起始位移

  const entries: ZipEntry[] = []
  for (let i = 0; i < cdCount; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const offset = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    entries.push({ name, method, compSize, offset })
    p += 46 + nameLen + extraLen + commentLen
  }

  const out = new Map<string, Buffer>()
  for (const e of entries) {
    // 本地檔頭：30 固定 + name + extra，之後才是壓縮資料
    const lhNameLen = buf.readUInt16LE(e.offset + 26)
    const lhExtraLen = buf.readUInt16LE(e.offset + 28)
    const start = e.offset + 30 + lhNameLen + lhExtraLen
    const comp = buf.subarray(start, start + e.compSize)
    let data: Buffer
    if (e.method === 0) data = comp                       // STORE
    else if (e.method === 8) data = inflateRawSync(comp)  // DEFLATE
    else throw new Error(`不支援的壓縮方式 ${e.method}`)
    out.set(e.name, data)
  }
  return out
}

// ── 極簡 XML 取值工具 ──
function decodeEntities(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
}

// sharedStrings.xml → 字串陣列（依序）
function parseSharedStrings(xml?: Buffer): string[] {
  if (!xml) return []
  const s = xml.toString('utf8')
  const out: string[] = []
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g
  let m: RegExpExecArray | null
  while ((m = siRe.exec(s))) {
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g
    let text = '', tm: RegExpExecArray | null
    while ((tm = tRe.exec(m[1]))) text += decodeEntities(tm[1])
    out.push(text)
  }
  return out
}

function colToIndex(ref: string): number {
  const m = /^([A-Z]+)/.exec(ref)
  if (!m) return 0
  let n = 0
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

// 解析單一 worksheet XML → Rows
function parseSheet(xml: Buffer, shared: string[]): Rows {
  const s = xml.toString('utf8')
  const rows: Rows = []
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g
  let rm: RegExpExecArray | null
  while ((rm = rowRe.exec(s))) {
    const cells: Cell[] = []
    const cRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
    let cm: RegExpExecArray | null
    while ((cm = cRe.exec(rm[2]))) {
      const attrs = cm[1]
      const inner = cm[2] ?? ''
      const refM = /r="([A-Z]+\d+)"/.exec(attrs)
      const idx = refM ? colToIndex(refM[1]) : cells.length
      const tM = /t="([^"]+)"/.exec(attrs)
      const type = tM ? tM[1] : 'n'
      let val: Cell = null
      if (type === 's') {
        const vM = /<v>([\s\S]*?)<\/v>/.exec(inner)
        if (vM) val = shared[parseInt(vM[1])] ?? ''
      } else if (type === 'inlineStr') {
        const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g
        let text = '', tm: RegExpExecArray | null
        while ((tm = tRe.exec(inner))) text += decodeEntities(tm[1])
        val = text
      } else if (type === 'str') {
        const vM = /<v>([\s\S]*?)<\/v>/.exec(inner)
        if (vM) val = decodeEntities(vM[1])
      } else { // 'n' 或未標型別
        const vM = /<v>([\s\S]*?)<\/v>/.exec(inner)
        if (vM) { const num = Number(vM[1]); val = Number.isNaN(num) ? vM[1] : num }
      }
      while (cells.length < idx) cells.push(null)
      cells[idx] = val
    }
    rows.push(cells)
  }
  return rows
}

// workbook.xml + rels → 依序的 [sheetName, 檔名]
function mapSheets(files: Map<string, Buffer>): { name: string; file: string }[] {
  const wb = files.get('xl/workbook.xml')?.toString('utf8') ?? ''
  const rels = files.get('xl/_rels/workbook.xml.rels')?.toString('utf8') ?? ''
  const relMap = new Map<string, string>()
  const relRe = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>/g
  let r: RegExpExecArray | null
  while ((r = relRe.exec(rels))) {
    let target = r[2]
    if (!target.startsWith('xl/')) target = 'xl/' + target.replace(/^\//, '')
    relMap.set(r[1], target)
  }
  const out: { name: string; file: string }[] = []
  const shRe = /<sheet\b([^>]*)\/?>/g
  let m: RegExpExecArray | null
  while ((m = shRe.exec(wb))) {
    const nameM = /name="([^"]*)"/.exec(m[1])
    const ridM = /r:id="([^"]+)"/.exec(m[1])
    if (!nameM) continue
    const file = ridM ? relMap.get(ridM[1]) : undefined
    out.push({ name: decodeEntities(nameM[1]), file: file ?? '' })
  }
  return out
}

export interface XlsxWorkbook { sheetNames: string[]; sheet(name: string): Rows }

export function readXlsx(buf: Buffer): XlsxWorkbook {
  const files = readZipEntries(buf)
  const shared = parseSharedStrings(files.get('xl/sharedStrings.xml'))
  const mapping = mapSheets(files)
  const cache = new Map<string, Rows>()
  return {
    sheetNames: mapping.map(s => s.name),
    sheet(name: string): Rows {
      if (cache.has(name)) return cache.get(name)!
      const entry = mapping.find(s => s.name === name)
      const data = entry && files.get(entry.file)
      const rows = data ? parseSheet(data, shared) : []
      cache.set(name, rows)
      return rows
    },
  }
}
