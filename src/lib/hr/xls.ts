// 純 TS 舊版 .xls (OLE2 + BIFF8) 讀取器 —— 零套件，只用 Buffer。
// 針對考勤機（E7HR）匯出的單一工作表；已用真實檔全表 62,194 格逐格驗證吻合。
// 支援：LABELSST(SST 字串，含 CONTINUE 續接)、LABEL、RK、MULRK、NUMBER、FORMULA(快取結果)。

interface Rec { type: number; data: Buffer }

function readOLE(buf: Buffer): Record<string, Buffer> {
  if (buf.readUInt32LE(0) !== 0xe011cfd0) throw new Error('not an OLE2/.xls file')
  const secSize = 1 << buf.readUInt16LE(30)
  const miniSize = 1 << buf.readUInt16LE(32)
  const firstDir = buf.readUInt32LE(48)
  const miniCutoff = buf.readUInt32LE(56)
  const firstMiniFat = buf.readUInt32LE(60)
  const firstDifat = buf.readUInt32LE(68)
  const nDifat = buf.readUInt32LE(72)
  const secOff = (s: number) => (s + 1) * secSize

  const fatSectors: number[] = []
  for (let i = 0; i < 109; i++) {
    const v = buf.readUInt32LE(76 + i * 4)
    if (v === 0xffffffff) break
    fatSectors.push(v)
  }
  let ds = firstDifat, cnt = nDifat
  while (ds !== 0xffffffff && cnt-- > 0) {
    const base = secOff(ds)
    const perSec = secSize / 4
    for (let i = 0; i < perSec - 1; i++) {
      const v = buf.readUInt32LE(base + i * 4)
      if (v !== 0xffffffff) fatSectors.push(v)
    }
    ds = buf.readUInt32LE(base + (perSec - 1) * 4)
  }

  const FAT: number[] = []
  for (const fsec of fatSectors) {
    const base = secOff(fsec)
    for (let i = 0; i < secSize / 4; i++) FAT.push(buf.readUInt32LE(base + i * 4))
  }
  const readChain = (start: number): Buffer => {
    const parts: Buffer[] = []
    let s = start, guard = 0
    while (s !== 0xfffffffe && s !== 0xffffffff && guard++ < FAT.length + 10) {
      parts.push(buf.subarray(secOff(s), secOff(s) + secSize))
      s = FAT[s]
    }
    return Buffer.concat(parts)
  }

  const dirBuf = readChain(firstDir)
  const entries: { name: string; type: number; start: number; size: number }[] = []
  for (let off = 0; off + 128 <= dirBuf.length; off += 128) {
    const nameLen = dirBuf.readUInt16LE(off + 64)
    if (nameLen === 0) continue
    entries.push({
      name: dirBuf.toString('utf16le', off, off + Math.max(0, nameLen - 2)),
      type: dirBuf.readUInt8(off + 66),
      start: dirBuf.readUInt32LE(off + 116),
      size: dirBuf.readUInt32LE(off + 120),
    })
  }

  const root = entries.find(e => e.type === 5)
  const miniStream = root ? readChain(root.start) : Buffer.alloc(0)
  const miniFatBuf = firstMiniFat === 0xfffffffe ? Buffer.alloc(0) : readChain(firstMiniFat)
  const MINIFAT: number[] = []
  for (let i = 0; i + 4 <= miniFatBuf.length; i += 4) MINIFAT.push(miniFatBuf.readUInt32LE(i))
  const readMiniChain = (start: number, size: number): Buffer => {
    const parts: Buffer[] = []
    let s = start, guard = 0
    while (s !== 0xfffffffe && s !== 0xffffffff && guard++ < MINIFAT.length + 10) {
      parts.push(miniStream.subarray(s * miniSize, s * miniSize + miniSize))
      s = MINIFAT[s]
    }
    return Buffer.concat(parts).subarray(0, size)
  }

  const streams: Record<string, Buffer> = {}
  for (const e of entries) {
    if (e.type !== 2) continue
    streams[e.name] = e.size < miniCutoff ? readMiniChain(e.start, e.size) : readChain(e.start).subarray(0, e.size)
  }
  return streams
}

function rkNum(rk: number): number {
  let v: number
  if (rk & 2) { v = rk >> 2 }
  else {
    const dv = new DataView(new ArrayBuffer(8))
    dv.setUint32(0, 0, true)
    dv.setUint32(4, rk & 0xfffffffc, true)
    v = dv.getFloat64(0, true)
  }
  return (rk & 1) ? v / 100 : v
}

function parseSST(records: Rec[], startIdx: number): string[] {
  const first = records[startIdx].data
  const cstUnique = first.readUInt32LE(4)
  let recI = startIdx
  let data = first
  let pos = 8
  const strings: string[] = []
  let fHighByte = 0

  const ensure = () => { while (pos >= data.length) { recI++; data = records[recI].data; pos = 0 } }
  const crossContinue = () => {
    recI++; data = records[recI].data
    fHighByte = data.readUInt8(0) & 0x01
    pos = 1
  }
  const readU16 = (): number => {
    ensure()
    if (data.length - pos >= 2) { const v = data.readUInt16LE(pos); pos += 2; return v }
    const b0 = data.readUInt8(pos); pos += 1; recI++; data = records[recI].data; pos = 0
    const b1 = data.readUInt8(pos); pos += 1; return b0 | (b1 << 8)
  }
  const readU8 = (): number => { ensure(); const v = data.readUInt8(pos); pos += 1; return v }
  const readU32 = (): number => { const lo = readU16(); const hi = readU16(); return (lo | (hi << 16)) >>> 0 }
  const skip = (n: number) => {
    while (n > 0) {
      ensure()
      const avail = data.length - pos
      if (avail >= n) { pos += n; n = 0 } else { n -= avail; pos = data.length }
    }
  }

  for (let s = 0; s < cstUnique; s++) {
    const cch = readU16()
    const grbit = readU8()
    fHighByte = grbit & 0x01
    let cRun = 0, cbExt = 0
    if (grbit & 0x08) cRun = readU16()
    if (grbit & 0x04) cbExt = readU32()
    let str = ''
    let remaining = cch
    while (remaining > 0) {
      ensure()
      const avail = data.length - pos
      if (fHighByte) {
        const canChars = Math.min(remaining, avail >> 1)
        if (canChars > 0) { str += data.toString('utf16le', pos, pos + canChars * 2); pos += canChars * 2; remaining -= canChars }
        if (remaining > 0) crossContinue()
      } else {
        const canChars = Math.min(remaining, avail)
        if (canChars > 0) { str += data.toString('latin1', pos, pos + canChars); pos += canChars; remaining -= canChars }
        if (remaining > 0) crossContinue()
      }
    }
    skip(cRun * 4)
    skip(cbExt)
    strings[s] = str
  }
  return strings
}

export type XlsCell = string | number

// 讀 .xls → 2D 陣列 rows[r][c]（空格為 ''）
export function xlsToRows(buf: Buffer): XlsCell[][] {
  const streams = readOLE(buf)
  const wb = streams['Workbook'] || streams['Book']
  if (!wb) throw new Error('no Workbook stream in .xls')

  const records: Rec[] = []
  let p = 0
  while (p + 4 <= wb.length) {
    const type = wb.readUInt16LE(p)
    const len = wb.readUInt16LE(p + 2)
    records.push({ type, data: wb.subarray(p + 4, p + 4 + len) })
    p += 4 + len
  }

  let sst: string[] = []
  for (let i = 0; i < records.length; i++) {
    if (records[i].type === 0x00fc) { sst = parseSST(records, i); break }
  }

  const cells: Record<string, XlsCell> = {}
  let maxRow = 0, maxCol = 0
  const put = (r: number, c: number, v: XlsCell) => {
    cells[r + ',' + c] = v
    if (r > maxRow) maxRow = r
    if (c > maxCol) maxCol = c
  }

  for (const rec of records) {
    const d = rec.data
    switch (rec.type) {
      case 0x00fd: { const r = d.readUInt16LE(0), c = d.readUInt16LE(2); put(r, c, sst[d.readUInt32LE(6)] ?? ''); break }
      case 0x0204: {
        const r = d.readUInt16LE(0), c = d.readUInt16LE(2), cch = d.readUInt16LE(6), grbit = d.readUInt8(8)
        put(r, c, (grbit & 1) ? d.toString('utf16le', 9, 9 + cch * 2) : d.toString('latin1', 9, 9 + cch)); break
      }
      case 0x027e: { const r = d.readUInt16LE(0), c = d.readUInt16LE(2); put(r, c, rkNum(d.readUInt32LE(6))); break }
      case 0x00bd: {
        const r = d.readUInt16LE(0), cFirst = d.readUInt16LE(2), cLast = d.readUInt16LE(d.length - 2)
        let off = 4
        for (let c = cFirst; c <= cLast; c++) { put(r, c, rkNum(d.readUInt32LE(off + 2))); off += 6 }
        break
      }
      case 0x0203: { const r = d.readUInt16LE(0), c = d.readUInt16LE(2); put(r, c, d.readDoubleLE(6)); break }
      case 0x0006: {
        const r = d.readUInt16LE(0), c = d.readUInt16LE(2)
        if (d.readUInt16LE(12) !== 0xffff) put(r, c, d.readDoubleLE(6))
        break
      }
      default: break
    }
  }

  const rows: XlsCell[][] = []
  for (let r = 0; r <= maxRow; r++) {
    const row: XlsCell[] = []
    for (let c = 0; c <= maxCol; c++) row.push(cells[r + ',' + c] ?? '')
    rows.push(row)
  }
  return rows
}
