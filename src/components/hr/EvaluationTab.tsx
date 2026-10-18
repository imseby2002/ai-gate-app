'use client'

// 人員評估表（由管理／主管填寫）。人事頁與門市排班頁共用。
import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Trash2, X, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ExcelImportModal } from '@/components/common/ExcelImportModal'
import type { ImportColumn } from '@/lib/excel/universal-import'

const fmt = (n: number, locale: string) => Math.round(n).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  )
}

const EVALUATION_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'name', label: '員工姓名', required: true, example: '王小明', aliases: ['name', '姓名', '員工姓名'] },
  { key: 'attendance_no', label: '考勤工號', example: '001', aliases: ['attendance_no', '考勤工號', '出勤編號'] },
  { key: 'year', label: '年', example: new Date().getFullYear(), aliases: ['year', '年', '年度'] },
  { key: 'month', label: '月', example: new Date().getMonth() + 1, aliases: ['month', '月', '月份'] },
  { key: 'bonus', label: '獎金', example: 3000, aliases: ['bonus', '獎金'] },
  { key: 'reward', label: '獎勵金額', example: 1000, aliases: ['reward', '獎勵金額', '獎勵'] },
  { key: 'penalty', label: '懲罰扣款', example: 0, aliases: ['penalty', '懲罰扣款', '懲罰'] },
  { key: 'score', label: '評分', example: 85, aliases: ['score', '評分', '考績'] },
  { key: 'notes', label: '評語備註', example: '出勤良好表現優異', aliases: ['notes', '評語', '備註'] },
]

interface EvalItem { kind: 'reward' | 'penalty'; label: string; amount: number }
interface Evaluation {
  id: string; employee_id: string; year: number; month: number
  rating: string; bonus: number; items: EvalItem[]
  reward_total: number; penalty_total: number; notes: string; evaluator: string
}
const RATINGS = ['', '優', '佳', '普', '待改進']

export interface EvalEmployee { id: string; name: string; store?: string | null; status: string }

// store：只看該門市員工（門市排班頁使用）；allowImport：顯示 Excel 批次匯入（限人事頁）
export function EvaluationTab({ employees, loading, store, allowImport = true }: { employees: EvalEmployee[]; loading: boolean; store?: string; allowImport?: boolean }) {
  const t = useTranslations('HrPage')
  const locale = useLocale()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [evals, setEvals] = useState<Record<string, Evaluation>>({})
  const [editing, setEditing] = useState<{ emp: EvalEmployee; draft: Partial<Evaluation> } | null>(null)
  const [busy, setBusy] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/hr/evaluations?year=${year}&month=${month}${store ? `&store=${encodeURIComponent(store)}` : ''}`)
    if (!res.ok) return
    const d = await res.json()
    const map: Record<string, Evaluation> = {}
    for (const e of (d.evaluations ?? []) as Evaluation[]) map[e.employee_id] = e
    setEvals(map)
  }, [year, month, store])
  useEffect(() => { load() }, [load])

  const active = employees.filter(e => e.status === 'active')

  const openEdit = (emp: EvalEmployee) => {
    const ev = evals[emp.id]
    setEditing({
      emp,
      draft: ev
        ? { ...ev, items: [...(ev.items ?? [])] }
        : { rating: '', bonus: 0, items: [], notes: '', evaluator: '' },
    })
  }

  const draftTotals = (d: Partial<Evaluation>) => {
    const items = d.items ?? []
    const reward = items.filter(i => i.kind === 'reward').reduce((s, i) => s + (Number(i.amount) || 0), 0)
    const penalty = items.filter(i => i.kind === 'penalty').reduce((s, i) => s + (Number(i.amount) || 0), 0)
    const net = (Number(d.bonus) || 0) + reward - penalty
    return { reward, penalty, net }
  }

  const saveEdit = async () => {
    if (!editing) return
    setBusy(true)
    const res = await fetch('/api/hr/evaluations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: editing.emp.id, year, month, ...editing.draft }),
    })
    setBusy(false)
    if (res.ok) { setEditing(null); load() }
    else alert((await res.json().catch(() => ({}))).error ?? t('saveFailed'))
  }

  const setDraft = (patch: Partial<Evaluation>) => setEditing(e => e ? { ...e, draft: { ...e.draft, ...patch } } : e)
  const addItem = (kind: 'reward' | 'penalty') =>
    setEditing(e => e ? { ...e, draft: { ...e.draft, items: [...(e.draft.items ?? []), { kind, label: '', amount: 0 }] } } : e)
  const setItem = (idx: number, patch: Partial<EvalItem>) =>
    setEditing(e => {
      if (!e) return e
      const items = [...(e.draft.items ?? [])]
      items[idx] = { ...items[idx], ...patch }
      return { ...e, draft: { ...e.draft, items } }
    })
  const removeItem = (idx: number) =>
    setEditing(e => e ? { ...e, draft: { ...e.draft, items: (e.draft.items ?? []).filter((_, i) => i !== idx) } } : e)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold">{t('evaluationTitle')}</h3>
          <p className="text-sm text-gray-500">{t('evaluationDesc')}</p>
        </div>
        <div className="flex items-center gap-2">
          {allowImport && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowImport(true)}>
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />{t('batchImport')}
            </Button>
          )}
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">
            {[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{t('yearSuffix', { y })}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{t('monthOption', { m })}</option>)}
          </select>
        </div>
      </div>

      {allowImport && showImport && (
        <ExcelImportModal
          title="批次匯入 / 更新考核獎懲資料"
          description="支援 .xlsx, .xls 與 .csv 檔案。請填寫員工姓名或考勤工號。"
          columns={EVALUATION_IMPORT_COLUMNS}
          columnsNs="HrImport.evaluation"
          templateFilename="員工考核獎懲範本"
          sheetName="考核獎懲"
          onClose={() => setShowImport(false)}
          onSuccess={load}
          onSubmit={async rows => {
            const res = await fetch('/api/hr/evaluations/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows }),
            })
            return await res.json()
          }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : active.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">{t('noActiveEmployees')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-2">{t('nameColLabel')}</th><th className="pr-2">{t('storeLabel')}</th><th className="pr-2">{t('ratingLabel')}</th>
                <th className="pr-2 text-right">{t('bonusLabel')}</th><th className="pr-2 text-right">{t('rewardLabel')}</th>
                <th className="pr-2 text-right">{t('penaltyLabel')}</th><th className="pr-2 text-right">{t('netRewardPenaltyLabel')}</th><th></th>
              </tr>
            </thead>
            <tbody>
              {active.map(emp => {
                const ev = evals[emp.id]
                const net = ev ? (Number(ev.bonus) + Number(ev.reward_total) - Number(ev.penalty_total)) : 0
                return (
                  <tr key={emp.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-medium">{emp.name}</td>
                    <td className="pr-2 text-gray-500">{emp.store || '—'}</td>
                    <td className="pr-2">{ev?.rating || '—'}</td>
                    <td className="pr-2 text-right">{ev ? fmt(Number(ev.bonus), locale) : '—'}</td>
                    <td className="pr-2 text-right text-emerald-600">{ev ? fmt(Number(ev.reward_total), locale) : '—'}</td>
                    <td className="pr-2 text-right text-red-500">{ev ? fmt(Number(ev.penalty_total), locale) : '—'}</td>
                    <td className="pr-2 text-right font-semibold">{ev ? fmt(net, locale) : '—'}</td>
                    <td className="text-right">
                      <button onClick={() => openEdit(emp)} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">
                        {ev ? t('edit') : t('fillIn')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (() => {
        const totals = draftTotals(editing.draft)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
            <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t('evalModalTitle', { name: editing.emp.name, year, month })}</h3>
                <button onClick={() => setEditing(null)}><X className="h-5 w-5 text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label={t('ratingLabel')}>
                  <select value={editing.draft.rating ?? ''} onChange={e => setDraft({ rating: e.target.value })} className="w-full h-9 rounded-md border px-2 text-sm">
                    {RATINGS.map(r => <option key={r} value={r}>{r || t('notRatedYet')}</option>)}
                  </select>
                </Field>
                <Field label={t('bonusLabel')}><Input type="number" value={String(editing.draft.bonus ?? 0)} onChange={e => setDraft({ bonus: Number(e.target.value) || 0 })} /></Field>
                <Field label={t('evaluatorLabel')}><Input value={editing.draft.evaluator ?? ''} onChange={e => setDraft({ evaluator: e.target.value })} /></Field>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('rewardPenaltyDetailLabel')}</span>
                  <div className="flex gap-1">
                    <button onClick={() => addItem('reward')} className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">{t('addReward')}</button>
                    <button onClick={() => addItem('penalty')} className="text-xs px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200">{t('addPenalty')}</button>
                  </div>
                </div>
                {(editing.draft.items ?? []).length === 0 && <p className="text-xs text-gray-400">{t('noItemsYet')}</p>}
                {(editing.draft.items ?? []).map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded ${it.kind === 'reward' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      {it.kind === 'reward' ? t('rewardLabel') : t('penaltyLabel')}
                    </span>
                    <Input value={it.label} onChange={e => setItem(i, { label: e.target.value })} placeholder={t('itemDescPlaceholder')} />
                    <Input type="number" value={String(it.amount)} onChange={e => setItem(i, { amount: Number(e.target.value) || 0 })} placeholder={t('amountPlaceholder')} />
                    <button onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>

              <Field label={t('notesLabel')}>
                <textarea value={editing.draft.notes ?? ''} onChange={e => setDraft({ notes: e.target.value })} className="w-full rounded-md border px-2 py-1.5 text-sm" rows={2} />
              </Field>

              <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-gray-500">{t('rewardColonAmount', { n: fmt(totals.reward, locale) })}　{t('penaltyColonAmount', { n: fmt(totals.penalty, locale) })}</span>
                <span className="font-semibold">{t('netRewardPenaltyColon')}{fmt(totals.net, locale)}</span>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>{t('cancel')}</Button>
                <Button size="sm" onClick={saveEdit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}</Button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
