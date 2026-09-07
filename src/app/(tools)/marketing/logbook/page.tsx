'use client'

import { useState, useEffect, useCallback } from 'react'
import { NotebookPen, Sparkles, Loader2, CheckCircle2, XCircle } from 'lucide-react'

interface LogItem { id: string; skill_id: string; skill_label: string; summary: string; status: string; credits: number; created_at: string }
interface SkillAgg { label: string; count: number; credits: number }
interface Data { items: LogItem[]; total: number; credits: number; bySkill: SkillAgg[]; days: number }

const DAYS = [7, 30, 90]
const fmt = (n: number) => Math.round(n * 100) / 100

export default function LogbookPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [report, setReport] = useState('')
  const [gen, setGen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/marketing/logbook?days=' + days)
    if (r.status === 403) { setForbidden(true); setLoading(false); return }
    setData(await r.json().catch(() => null))
    setLoading(false)
  }, [days])
  useEffect(() => { load() }, [load])

  async function genReport() {
    setGen(true); setReport('')
    const r = await fetch('/api/marketing/logbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days }) })
    const j = await r.json().catch(() => ({})); setGen(false)
    setReport(j.report || j.error || '產生失敗')
  }

  if (forbidden) return <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">需開通行銷模組才能使用</div>

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center"><NotebookPen className="h-5 w-5 text-indigo-600" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">製作日誌</h1>
          <p className="text-sm text-gray-500">每次行銷製作自動記錄，並可產生 AI 製作報告</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
            {DAYS.map(d => <option key={d} value={d}>近 {d} 天</option>)}
          </select>
          <button onClick={genReport} disabled={gen} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {gen ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}產生製作報告
          </button>
        </div>
      </div>

      {report && <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm text-gray-800 whitespace-pre-wrap">{report}</div>}

      {loading || !data ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-white p-4"><div className="text-xs text-gray-500">製作次數</div><div className="mt-1 text-xl font-bold text-gray-900">{data.total}</div></div>
          <div className="rounded-xl border bg-white p-4"><div className="text-xs text-gray-500">花費點數</div><div className="mt-1 text-xl font-bold text-gray-900">{fmt(data.credits)}</div></div>
          <div className="rounded-xl border bg-white p-4 col-span-2"><div className="text-xs text-gray-500">使用最多</div><div className="mt-1 text-sm font-medium text-gray-800 truncate">{data.bySkill[0] ? `${data.bySkill[0].label}（${data.bySkill[0].count} 次）` : '—'}</div></div>
        </div>

        {data.bySkill.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.bySkill.map(s => (
              <span key={s.label} className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-xs text-gray-700">
                {s.label}<span className="text-gray-400">×{s.count}</span>
              </span>
            ))}
          </div>
        )}

        <div className="rounded-xl border bg-white divide-y">
          {data.items.length === 0 ? <div className="py-16 text-center text-sm text-gray-400">近 {data.days} 天內尚無製作紀錄</div>
            : data.items.map(it => (
              <div key={it.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                {it.status === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
                <span className="font-medium text-gray-800 shrink-0">{it.skill_label}</span>
                <span className="flex-1 truncate text-gray-500">{it.summary || '—'}</span>
                {it.credits > 0 && <span className="text-xs text-gray-400 shrink-0">{fmt(it.credits)} 點</span>}
                <span className="text-xs text-gray-400 shrink-0">{new Date(it.created_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
        </div>
      </>}
    </div>
  )
}
