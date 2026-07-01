'use client'

import { useState, useMemo } from 'react'
import { Loader2, Plus, Trash2, ChevronUp, ChevronDown, Save, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PnlLine, PnlCompute, PnlLineKind } from './pnl-schema'

type Row = PnlLine & { _rid: string }

const KIND_LABEL: Record<PnlLineKind, string> = {
  revenue: '營業額', detail: '明細(可錄入)', subtotal: '小計/公式', compare: '比較',
}

let ridSeq = 0
const newRid = () => `r${Date.now()}_${ridSeq++}`
const genCode = () => `line_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

export default function PnlSchemaEditor({ initial, onClose, onSaved }: {
  initial: PnlLine[]
  onClose: () => void
  onSaved: () => void
}) {
  const [rows, setRows] = useState<Row[]>(() => initial.map(l => ({ ...l, _rid: newRid() })))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const sections = useMemo(
    () => Array.from(new Set(rows.map(r => String(r.section || '')).filter(Boolean))),
    [rows]
  )
  // 可被公式引用的科目（排除自己在各列處理）
  const codeOpts = rows.map(r => ({ code: r.code, label: r.zh || r.code }))

  const patch = (rid: string, p: Partial<Row>) =>
    setRows(rs => rs.map(r => r._rid === rid ? { ...r, ...p } : r))

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= rows.length) return
    setRows(rs => { const n = [...rs]; [n[idx], n[j]] = [n[j], n[idx]]; return n })
  }

  const addRow = () => setRows(rs => [...rs, {
    _rid: newRid(), code: genCode(), zh: '', vi: '', section: '', kind: 'detail', compute: null,
  }])

  const removeRow = (rid: string) => setRows(rs => rs.filter(r => r._rid !== rid))

  const setKind = (rid: string, kind: PnlLineKind) => patch(rid, {
    kind,
    compute: kind === 'subtotal' ? { op: 'sum', codes: [] } : null,
  })

  const save = async () => {
    if (rows.length === 0) { setErr('至少需保留一個科目'); return }
    if (rows.some(r => !r.zh.trim())) { setErr('每個科目都需填中文名'); return }
    setSaving(true); setErr('')
    try {
      const lines = rows.map((r, i) => ({
        code: r.code, zh: r.zh.trim(), vi: r.vi.trim(),
        section: String(r.section || '').trim(), kind: r.kind,
        compute: r.kind === 'subtotal' ? r.compute : null, sort: i,
      }))
      const res = await fetch('/api/hr/pnl/schema', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      })
      const j = await res.json()
      if (!res.ok) { setErr(j.error ?? '儲存失敗'); return }
      onSaved()
    } catch { setErr('儲存失敗') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div>
          <h3 className="text-sm font-semibold">科目設定</h3>
          <p className="text-xs text-gray-400">自訂損益表科目、順序與小計公式。改動不影響已輸入的數字。</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4" />取消
          </Button>
          <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}儲存
          </Button>
        </div>
      </div>

      {err && (
        <p className="flex items-center gap-1.5 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" />{err}
        </p>
      )}

      <div className="rounded-xl border divide-y">
        {rows.map((r, idx) => (
          <div key={r._rid} className="p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex flex-col pt-1">
                <button onClick={() => move(idx, -1)} disabled={idx === 0}
                  className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => move(idx, 1)} disabled={idx === rows.length - 1}
                  className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400">中文名 *</label>
                  <Input value={r.zh} onChange={e => patch(r._rid, { zh: e.target.value })} className="h-8 text-sm" placeholder="例：電費" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400">越文名</label>
                  <Input value={r.vi} onChange={e => patch(r._rid, { vi: e.target.value })} className="h-8 text-sm" placeholder="tien dien" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400">分區(供 sumSection 用)</label>
                  <Input list="pnl-sections" value={String(r.section || '')} onChange={e => patch(r._rid, { section: e.target.value })} className="h-8 text-sm" placeholder="opex" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400">類型</label>
                  <select value={r.kind} onChange={e => setKind(r._rid, e.target.value as PnlLineKind)}
                    className="h-8 w-full rounded-md border bg-background px-2 text-sm">
                    {(Object.keys(KIND_LABEL) as PnlLineKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={() => removeRow(r._rid)} className="pt-6 text-gray-300 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {r.kind === 'subtotal' && (
              <ComputeEditor
                value={(r.compute as PnlCompute | null) ?? { op: 'sum', codes: [] }}
                onChange={c => patch(r._rid, { compute: c })}
                codeOpts={codeOpts.filter(o => o.code !== r.code)}
                sections={sections}
              />
            )}
          </div>
        ))}
      </div>

      <datalist id="pnl-sections">
        {sections.map(s => <option key={s} value={s} />)}
      </datalist>

      <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
        <Plus className="h-4 w-4" />新增科目
      </Button>
    </div>
  )
}

// ── 小計公式編輯器 ──
function ComputeEditor({ value, onChange, codeOpts, sections }: {
  value: PnlCompute
  onChange: (c: PnlCompute) => void
  codeOpts: { code: string; label: string }[]
  sections: string[]
}) {
  const CodeSel = ({ v, on }: { v: string; on: (c: string) => void }) => (
    <select value={v} onChange={e => on(e.target.value)}
      className="h-7 rounded-md border bg-background px-2 text-xs min-w-[120px]">
      <option value="">— 選科目 —</option>
      {codeOpts.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
    </select>
  )

  const setOp = (op: PnlCompute['op']) => {
    if (op === 'sum') onChange({ op: 'sum', codes: [] })
    else if (op === 'sumSection') onChange({ op: 'sumSection', section: sections[0] ?? '' })
    else if (op === 'sub') onChange({ op: 'sub', left: '', right: '' })
    else onChange({ op: 'subMany', base: '', minus: [] })
  }

  return (
    <div className="ml-8 rounded-lg border bg-gray-50 p-2.5 space-y-2">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-gray-500">公式</span>
        <select value={value.op} onChange={e => setOp(e.target.value as PnlCompute['op'])}
          className="h-7 rounded-md border bg-background px-2 text-xs">
          <option value="sum">加總指定科目</option>
          <option value="sumSection">加總某分區明細</option>
          <option value="sub">相減 (A − B)</option>
          <option value="subMany">A 減去多項</option>
        </select>

        {value.op === 'sumSection' && (
          <select value={value.section} onChange={e => onChange({ op: 'sumSection', section: e.target.value })}
            className="h-7 rounded-md border bg-background px-2 text-xs">
            <option value="">— 選分區 —</option>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        {value.op === 'sub' && (
          <>
            <CodeSel v={value.left} on={c => onChange({ ...value, left: c })} />
            <span className="text-gray-400">−</span>
            <CodeSel v={value.right} on={c => onChange({ ...value, right: c })} />
          </>
        )}
      </div>

      {value.op === 'sum' && (
        <div className="flex flex-wrap items-center gap-1.5">
          {value.codes.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <span className="text-gray-400 text-xs">＋</span>}
              <CodeSel v={c} on={nc => onChange({ op: 'sum', codes: value.codes.map((x, j) => j === i ? nc : x) })} />
              <button onClick={() => onChange({ op: 'sum', codes: value.codes.filter((_, j) => j !== i) })}
                className="text-gray-300 hover:text-red-500"><X className="h-3 w-3" /></button>
            </span>
          ))}
          <button onClick={() => onChange({ op: 'sum', codes: [...value.codes, ''] })}
            className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"><Plus className="h-3 w-3" />加科目</button>
        </div>
      )}

      {value.op === 'subMany' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <CodeSel v={value.base} on={c => onChange({ ...value, base: c })} />
          <span className="text-gray-400 text-xs">減去</span>
          {value.minus.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <span className="text-gray-400 text-xs">，</span>}
              <CodeSel v={c} on={nc => onChange({ ...value, minus: value.minus.map((x, j) => j === i ? nc : x) })} />
              <button onClick={() => onChange({ ...value, minus: value.minus.filter((_, j) => j !== i) })}
                className="text-gray-300 hover:text-red-500"><X className="h-3 w-3" /></button>
            </span>
          ))}
          <button onClick={() => onChange({ ...value, minus: [...value.minus, ''] })}
            className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"><Plus className="h-3 w-3" />加項目</button>
        </div>
      )}
    </div>
  )
}
