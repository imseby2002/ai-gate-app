'use client'

import { useState, useEffect, useCallback, useRef, type ChangeEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  FileText, Upload, Loader2, AlertCircle, Plus, Trash2, X, Bell,
  Building2, CalendarClock, ExternalLink, FileSpreadsheet, Sparkles,
  CheckCircle2, AlertTriangle, ShieldCheck, DollarSign, ChevronDown, ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ExcelImportModal } from '@/components/common/ExcelImportModal'
import type { ImportColumn } from '@/lib/excel/universal-import'

const AFFAIRS_DOC_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'title', label: '文件標題', required: true, example: '台北忠孝門市房屋租賃契約書', aliases: ['title', '文件標題', '標題', '合約名稱'] },
  { key: 'doc_type', label: '文件類別', example: '門市租約', aliases: ['doc_type', '文件類別', '類別', '合約類型'] },
  { key: 'store_code', label: '門市代碼', example: 'ZX', aliases: ['store_code', '門市代碼', '門市編號', '門市'] },
  { key: 'counterparty', label: '簽約對象/出租人', example: '房東 王大明', aliases: ['counterparty', '簽約對象', '出租人', '房東', '發證機關'] },
  { key: 'effective_date', label: '生效起日', example: '2025-01-01', aliases: ['effective_date', '生效起日', '起日', '簽約日'] },
  { key: 'expiry_date', label: '到期日', example: '2027-12-31', aliases: ['expiry_date', '到期日', '迄日', '到期日期'] },
  { key: 'deposit', label: '押金', example: 100000, aliases: ['deposit', '押金', '保證金'] },
  { key: 'monthly_rent', label: '月租金/費用', example: 50000, aliases: ['monthly_rent', '月租金', '租金', '金額'] },
  { key: 'payment_day', label: '每月繳款日', example: 5, aliases: ['payment_day', '每月繳款日', '繳費日', '付款日'] },
  { key: 'notes', label: '備註', example: '押金兩個月，水電自付', aliases: ['notes', '備註', '說明'] },
]

type Tab = 'docs' | 'settings'
interface StoreOpt { code: string; name: string; region: string }

interface Doc {
  id: string
  doc_type: string
  title: string
  store_code: string
  counterparty: string
  effective_date: string | null
  expiry_date: string | null
  payment_day: number | null
  deposit: number | null
  monthly_rent: number | null
  contract_text: string
  is_renewed: boolean
  remind_days_before: number
  remind_days_stage2: number
  remind_days_urgent: number
  pay_remind_days_before: number
  pay_remind_days_2: number
  status: string
  file_name: string
  url: string
  note: string
  confirmed: boolean
}

interface AffairSettings {
  external_telegram: string
  external_email: string
  external_zalo: string
  general_telegram: string
  general_email: string
  general_zalo: string
  cashier_telegram: string
  cashier_email: string
  cashier_zalo: string
  gm_telegram: string
  gm_email: string
  gm_zalo: string
  default_expiry_stage1_days: number
  default_expiry_stage2_days: number
  default_expiry_urgent_days: number
  default_pay_stage1_days: number
  default_pay_stage2_days: number
}

const TYPE_COLOR: Record<string, { color: string; badge: string }> = {
  lease:           { color: 'text-blue-600',    badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  sanitary_cert:   { color: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  company_license: { color: 'text-purple-600',  badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  patent_cert:     { color: 'text-amber-600',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  contract:        { color: 'text-cyan-600',    badge: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  license:         { color: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  other:           { color: 'text-slate-600',   badge: 'bg-slate-50 text-slate-700 border-slate-200' },
}

const TYPE_ORDER = ['lease', 'sanitary_cert', 'company_license', 'patent_cert', 'contract', 'other']

const todayStr = () => new Date().toISOString().slice(0, 10)

function daysUntil(d: string | null): number | null {
  if (!d) return null
  const ms = new Date(d + 'T00:00:00').getTime() - new Date(todayStr() + 'T00:00:00').getTime()
  return Math.round(ms / 86400000)
}

export default function AffairsPage() {
  const t = useTranslations('Affairs')
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('docs')

  useEffect(() => {
    fetch('/api/affairs/settings').then(r => { setIsAdmin(r.status !== 403) })
  }, [])

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2">
        <AlertCircle className="h-12 w-12 mx-auto text-amber-400" />
        <p className="font-semibold">{t('adminOnly')}</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/office">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Building2 className="h-4 w-4" />{t('companyPortal')}
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {([['docs', t('tabDocs'), <FileText key="a" className="h-4 w-4" />], ['settings', t('tabSettings'), <Bell key="b" className="h-4 w-4" />]] as [Tab, string, ReactNode][]).map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {tab === 'docs' && <DocsTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  )
}

// ── 文件列表 Tab ──
function DocsTab() {
  const t = useTranslations('Affairs')
  const TYPE_CONFIG: Record<string, { label: string; color: string; badge: string }> = Object.fromEntries(
    TYPE_ORDER.map(k => [k, { label: t(`type_${k}`), ...TYPE_COLOR[k] }])
  )
  const [docs, setDocs] = useState<Doc[]>([])
  const [stores, setStores] = useState<StoreOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [editing, setEditing] = useState<Partial<Doc> | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = () => setTick(x => x + 1)

  useEffect(() => {
    setLoading(true)
    const qs = filterType ? `?doc_type=${filterType}` : ''
    fetch(`/api/affairs/documents${qs}`)
      .then(r => r.ok ? r.json() : { documents: [] })
      .then(d => { setDocs(d.documents ?? []); setLoading(false) })
  }, [filterType, tick])

  useEffect(() => {
    fetch('/api/fin/stores')
      .then(r => r.ok ? r.json() : { stores: [] })
      .then(d => setStores(d.stores ?? []))
  }, [])

  const storeName = (code: string) => stores.find(s => s.code === code)?.name || code

  // 即將到期看板（30天內）
  const upcoming = docs
    .filter(d => d.status === 'active')
    .map(d => {
      const exd = daysUntil(d.expiry_date)
      const expiryDue = exd !== null && exd <= (d.remind_days_before || 30)
      return { d, exd, expiryDue }
    })
    .filter(x => x.expiryDue)
    .sort((a, b) => (a.exd ?? 0) - (b.exd ?? 0))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-9 rounded-lg border px-3 text-sm bg-card">
          <option value="">{t('allTypes')}</option>
          {TYPE_ORDER.map(tk => <option key={tk} value={tk}>{TYPE_CONFIG[tk]?.label ?? tk}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowImport(true)}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />{t('bulkImport')}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setEditing({ doc_type: 'lease', remind_days_before: 30, remind_days_stage2: 15, remind_days_urgent: 7, pay_remind_days_before: 3, pay_remind_days_2: 1 })}>
            <Plus className="h-4 w-4" />{t('newDocument')}
          </Button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          title="批次匯入外務證照與租約"
          description="支援 .xlsx, .xls 與 .csv 檔案。若文件標題相符將自動更新。"
          columns={AFFAIRS_DOC_IMPORT_COLUMNS}
          templateFilename="外務證照與門市租約範本"
          sheetName="合約證照清單"
          onClose={() => setShowImport(false)}
          onSuccess={reload}
          onSubmit={async rows => {
            const res = await fetch('/api/affairs/documents/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows }),
            })
            return await res.json()
          }}
        />
      )}

      {upcoming.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50/70 space-y-2">
          <div className="text-sm font-bold text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-600" />
              {t('upcomingTracking', { n: upcoming.length })}
            </div>
            <span className="text-xs text-amber-700 font-normal">{t('multiStageReminder')}</span>
          </div>
          <div className="grid gap-1.5">
            {upcoming.slice(0, 8).map(({ d, exd }) => {
              const isUrgent = exd !== null && exd <= (d.remind_days_urgent || 7)
              const cfg = TYPE_CONFIG[d.doc_type] ?? TYPE_CONFIG.other
              return (
                <div key={d.id} className="text-xs flex items-center gap-2 p-1.5 bg-white/80 rounded border border-amber-200">
                  <span className={`px-2 py-0.5 rounded border text-[11px] font-medium ${cfg.badge}`}>{cfg.label}</span>
                  <span className="font-semibold text-slate-800">{d.title || t('unnamed')}</span>
                  {d.store_code && <span className="text-slate-500">[{storeName(d.store_code)}]</span>}
                  {d.counterparty && <span className="text-slate-400">· {d.counterparty}</span>}
                  {d.is_renewed && <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-medium">{t('renewed')}</span>}
                  <span className={`ml-auto tabular-nums font-bold ${exd !== null && exd < 0 ? 'text-red-700' : isUrgent ? 'text-red-600 animate-pulse' : 'text-amber-700'}`}>
                    {exd !== null && exd < 0 ? t('overdueDays', { n: -exd }) : isUrgent ? t('urgentDaysLeft', { n: exd! }) : t('daysLeft', { n: exd! })}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-gray-400" /></div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm border-2 border-dashed rounded-xl">{t('noDocsYet')}</div>
      ) : (
        <div className="grid gap-2.5">
          {docs.map(d => {
            const exd = daysUntil(d.expiry_date)
            const cfg = TYPE_CONFIG[d.doc_type] ?? TYPE_CONFIG.other
            const isUrgent = exd !== null && exd <= (d.remind_days_urgent || 7)
            return (
              <Card key={d.id} className="p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">{d.title || t('unnamed')}</span>
                      {d.store_code && (
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {storeName(d.store_code)}
                        </span>
                      )}
                      {d.is_renewed ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">{t('renewedFull')}</span>
                      ) : d.status === 'archived' ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{t('archived')}</span>
                      ) : null}
                    </div>

                    <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1 pt-1">
                      {d.counterparty && <span><b>{t('counterpartyLabel')}</b>{d.counterparty}</span>}
                      {d.effective_date && <span><b>{t('effectiveDateLabel')}</b>{d.effective_date}</span>}
                      {d.expiry_date && (
                        <span className={isUrgent ? 'text-red-600 font-bold' : exd !== null && exd <= (d.remind_days_before || 30) ? 'text-amber-600 font-medium' : ''}>
                          <b>{t('expiryDateLabel')}</b>{d.expiry_date}{exd !== null ? ` (${exd < 0 ? t('overdueDaysShort', { n: -exd }) : t('daysLeftShort', { n: exd })})` : ''}
                        </span>
                      )}
                      {d.doc_type === 'lease' && (
                        <>
                          {d.monthly_rent && <span><b>{t('monthlyRentLabel')}</b>NT$ {Number(d.monthly_rent).toLocaleString()}</span>}
                          {d.deposit && <span><b>{t('depositLabel')}</b>NT$ {Number(d.deposit).toLocaleString()}</span>}
                          {d.payment_day && <span><b>{t('paymentDayLabel')}</b>{t('paymentDayValue', { day: d.payment_day })}</span>}
                        </>
                      )}
                    </div>

                    {d.note && <div className="text-xs text-slate-400 mt-0.5">{t('noteLabel')}{d.note}</div>}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {d.url && (
                      <a href={d.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-indigo-600 p-1.5 rounded hover:bg-slate-100" title={t('viewFile')}>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setEditing(d)} className="text-xs h-8">
                      {t('edit')}
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <DocModal
          doc={editing}
          stores={stores}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload() }}
        />
      )}
    </div>
  )
}

// ── 編輯 / 新增合約 Modal ──
function DocModal({ doc, stores, onClose, onSaved }: { doc: Partial<Doc>; stores: StoreOpt[]; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('Affairs')
  const TYPE_CONFIG: Record<string, { label: string; color: string; badge: string }> = Object.fromEntries(
    TYPE_ORDER.map(k => [k, { label: t(`type_${k}`), ...TYPE_COLOR[k] }])
  )
  const isNew = !doc.id
  const [f, setF] = useState<Partial<Doc>>({ ...doc })
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [showAdvancedDays, setShowAdvancedDays] = useState(false)
  const [showContractText, setShowContractText] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<Doc>) => setF(p => ({ ...p, ...patch }))

  // 🤖 AI 自動辨識
  const handleAiExtract = async () => {
    if (!file) {
      alert(t('selectFileFirst'))
      fileRef.current?.click()
      return
    }
    setAiAnalyzing(true)
    setErr('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/affairs/documents/ai-extract', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? t('aiExtractFailed'))
      const d = json.data
      set({
        title: d.title || f.title || file.name.replace(/\.[^/.]+$/, ''),
        doc_type: d.doc_type || f.doc_type || 'lease',
        counterparty: d.counterparty || f.counterparty,
        deposit: d.deposit ?? f.deposit,
        monthly_rent: d.monthly_rent ?? f.monthly_rent,
        payment_day: d.payment_day ?? f.payment_day,
        effective_date: d.effective_date ?? f.effective_date,
        expiry_date: d.expiry_date ?? f.expiry_date,
        contract_text: d.contract_text || f.contract_text,
        note: d.note ? (f.note ? `${f.note}；${d.note}` : d.note) : f.note,
      })
      alert(t('aiExtractSuccess'))
    } catch (e: any) {
      setErr(e.message)
    }
    setAiAnalyzing(false)
  }

  const save = async () => {
    setBusy(true); setErr('')
    try {
      if (isNew) {
        const fd = new FormData()
        if (file) fd.append('file', file)
        fd.append('doc_type', f.doc_type ?? 'lease')
        for (const k of ['title', 'store_code', 'counterparty', 'note', 'contract_text'] as const) {
          fd.append(k, String(f[k] ?? ''))
        }
        if (f.effective_date) fd.append('effective_date', f.effective_date)
        if (f.expiry_date) fd.append('expiry_date', f.expiry_date)
        if (f.payment_day) fd.append('payment_day', String(f.payment_day))
        if (f.deposit) fd.append('deposit', String(f.deposit))
        if (f.monthly_rent) fd.append('monthly_rent', String(f.monthly_rent))
        fd.append('is_renewed', f.is_renewed ? 'true' : 'false')
        fd.append('remind_days_before', String(f.remind_days_before ?? 30))
        fd.append('remind_days_stage2', String(f.remind_days_stage2 ?? 15))
        fd.append('remind_days_urgent', String(f.remind_days_urgent ?? 7))
        fd.append('pay_remind_days_before', String(f.pay_remind_days_before ?? 3))
        fd.append('pay_remind_days_2', String(f.pay_remind_days_2 ?? 1))

        const res = await fetch('/api/affairs/documents', { method: 'POST', body: fd })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? t('saveFailed'))
        onSaved()
      } else {
        const res = await fetch('/api/affairs/documents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: f.id,
            doc_type: f.doc_type,
            title: f.title,
            store_code: f.store_code,
            counterparty: f.counterparty,
            effective_date: f.effective_date || null,
            expiry_date: f.expiry_date || null,
            payment_day: f.payment_day || null,
            deposit: f.deposit || null,
            monthly_rent: f.monthly_rent || null,
            contract_text: f.contract_text || '',
            is_renewed: !!f.is_renewed,
            remind_days_before: f.remind_days_before,
            remind_days_stage2: f.remind_days_stage2,
            remind_days_urgent: f.remind_days_urgent,
            pay_remind_days_before: f.pay_remind_days_before,
            pay_remind_days_2: f.pay_remind_days_2,
            note: f.note,
            status: f.status,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? t('updateFailed'))
        onSaved()
      }
    } catch (e: any) {
      setErr(e.message)
    }
    setBusy(false)
  }

  const remove = async () => {
    if (!confirm(t('confirmDeleteDoc'))) return
    await fetch('/api/affairs/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: f.id }),
    })
    onSaved()
  }

  const isLease = f.doc_type === 'lease'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 space-y-4 shadow-2xl border" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="font-bold text-lg text-slate-900">{isNew ? t('newDocModalTitle') : t('editDocModalTitle')}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t('modalSubtitle')}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        {/* 檔案上傳與 AI 辨識按鈕 */}
        {isNew && (
          <div className="p-3.5 rounded-xl border bg-indigo-50/50 border-indigo-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" hidden onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)} accept=".pdf,.png,.jpg,.jpeg,.webp" />
              <Button variant="outline" size="sm" className="gap-1.5 bg-white" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" />{file ? file.name : t('selectScanFile')}
              </Button>
            </div>
            <Button
              size="sm"
              onClick={handleAiExtract}
              disabled={aiAnalyzing || !file}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm shrink-0"
            >
              {aiAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t('aiExtractButton')}
            </Button>
          </div>
        )}

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-700">{t('docTypeRequired')}</span>
              <select value={f.doc_type ?? 'lease'} onChange={e => set({ doc_type: e.target.value })} className="w-full h-9 rounded-lg border px-2 text-sm bg-background">
                {TYPE_ORDER.map(tk => <option key={tk} value={tk}>{TYPE_CONFIG[tk]?.label ?? tk}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-700">{t('storeOptional')}</span>
              <select value={f.store_code ?? ''} onChange={e => set({ store_code: e.target.value })} className="w-full h-9 rounded-lg border px-2 text-sm bg-background">
                <option value="">{t('companyWideOption')}</option>
                {stores.map(s => <option key={s.code} value={s.code}>{s.name || s.code}</option>)}
              </select>
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-700">{t('docTitleRequired')}</span>
            <Input value={f.title ?? ''} onChange={e => set({ title: e.target.value })} placeholder={t('docTitlePlaceholder')} />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-700">{t('counterpartyFieldLabel')}</span>
            <Input value={f.counterparty ?? ''} onChange={e => set({ counterparty: e.target.value })} placeholder={t('counterpartyPlaceholder')} />
          </label>

          {/* 租約專屬：租金、押金與付款日 */}
          {isLease && (
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-gray-700">{t('monthlyRentField')}</span>
                <Input type="number" value={f.monthly_rent ? String(f.monthly_rent) : ''} onChange={e => set({ monthly_rent: Number(e.target.value) || undefined })} placeholder="50000" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-gray-700">{t('depositField')}</span>
                <Input type="number" value={f.deposit ? String(f.deposit) : ''} onChange={e => set({ deposit: Number(e.target.value) || undefined })} placeholder="100000" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-gray-700">{t('paymentDayField')}</span>
                <Input type="number" value={f.payment_day ? String(f.payment_day) : ''} onChange={e => set({ payment_day: Number(e.target.value) || undefined })} placeholder="5" />
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-700">{t('effectiveDateField')}</span>
              <Input type="date" value={f.effective_date ?? ''} onChange={e => set({ effective_date: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-700">{t('expiryDateFieldRequired')}</span>
              <Input type="date" value={f.expiry_date ?? ''} onChange={e => set({ expiry_date: e.target.value })} />
            </label>
          </div>

          {/* 續約標記 */}
          <div className="flex items-center gap-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={!!f.is_renewed}
                onChange={e => set({ is_renewed: e.target.checked })}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>{t('renewedCheckboxLabel')}</span>
            </label>
          </div>

          {/* 提醒天數自訂區塊（可折疊） */}
          <div className="border rounded-xl p-3 bg-slate-50/50 space-y-2">
            <button
              type="button"
              onClick={() => setShowAdvancedDays(!showAdvancedDays)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-indigo-600"
            >
              <span>⚙️ {t('customReminderDays')}</span>
              {showAdvancedDays ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showAdvancedDays && (
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs border-t">
                <label className="space-y-1">
                  <span className="text-gray-500">{t('expiryStage1Label')}</span>
                  <Input type="number" value={String(f.remind_days_before ?? 30)} onChange={e => set({ remind_days_before: Number(e.target.value) || 0 })} />
                </label>
                <label className="space-y-1">
                  <span className="text-gray-500">{t('expiryStage2Label')}</span>
                  <Input type="number" value={String(f.remind_days_stage2 ?? 15)} onChange={e => set({ remind_days_stage2: Number(e.target.value) || 0 })} />
                </label>
                <label className="space-y-1">
                  <span className="text-gray-500">{t('expiryStage3Label')}</span>
                  <Input type="number" value={String(f.remind_days_urgent ?? 7)} onChange={e => set({ remind_days_urgent: Number(e.target.value) || 0 })} />
                </label>
                {isLease && (
                  <>
                    <label className="space-y-1">
                      <span className="text-gray-500">{t('payStage1Label')}</span>
                      <Input type="number" value={String(f.pay_remind_days_before ?? 3)} onChange={e => set({ pay_remind_days_before: Number(e.target.value) || 0 })} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-gray-500">{t('payStage2Label')}</span>
                      <Input type="number" value={String(f.pay_remind_days_2 ?? 1)} onChange={e => set({ pay_remind_days_2: Number(e.target.value) || 0 })} />
                    </label>
                  </>
                )}
              </div>
            )}
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-gray-700">{t('noteSummaryField')}</span>
            <Input value={f.note ?? ''} onChange={e => set({ note: e.target.value })} placeholder={t('noteSummaryPlaceholder')} />
          </label>

          {/* 完整文字合約（AI 萃取後儲存） */}
          <div className="border rounded-xl p-3 bg-slate-50/50 space-y-2">
            <button
              type="button"
              onClick={() => setShowContractText(!showContractText)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-indigo-600"
            >
              <span>📜 {t('fullContractText')} {f.contract_text ? t('textExtracted') : t('canBeEmpty')}</span>
              {showContractText ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showContractText && (
              <textarea
                value={f.contract_text ?? ''}
                onChange={e => set({ contract_text: e.target.value })}
                rows={6}
                placeholder={t('contractTextPlaceholder')}
                className="w-full p-2 text-xs rounded-lg border font-mono bg-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>
        </div>

        {err && <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">{err}</p>}

        <div className="flex justify-between items-center pt-3 border-t">
          {!isNew ? (
            <button onClick={remove} className="text-red-500 hover:text-red-700 flex items-center gap-1 text-xs">
              <Trash2 className="h-4 w-4" />{t('deleteDocument')}
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>{t('cancel')}</Button>
            <Button size="sm" onClick={save} disabled={busy || aiAnalyzing} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('confirmSave')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 通知設定 Tab ──
function SettingsTab() {
  const t = useTranslations('Affairs')
  const [cfg, setCfg] = useState<AffairSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/affairs/settings')
    if (res.ok) setCfg(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!cfg) return
    setBusy(true)
    const res = await fetch('/api/affairs/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    })
    setBusy(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  if (!cfg) return <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-gray-400" /></div>
  const set = (patch: Partial<AffairSettings>) => setCfg(c => c ? { ...c, ...patch } : c)

  const roles: [string, keyof AffairSettings, keyof AffairSettings, keyof AffairSettings, string][] = [
    [t('roleExternal'), 'external_telegram', 'external_email', 'external_zalo', t('roleExternalHint')],
    [t('roleGeneral'), 'general_telegram', 'general_email', 'general_zalo', t('roleGeneralHint')],
    [t('roleCashier'), 'cashier_telegram', 'cashier_email', 'cashier_zalo', t('roleCashierHint')],
    [t('roleGm'), 'gm_telegram', 'gm_email', 'gm_zalo', t('roleGmHint')],
  ]

  return (
    <div className="space-y-5">
      <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-1">
        <p className="font-bold flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-indigo-600" />
          {t('multiChannelTitle')}
        </p>
        <p>• <b>{t('zaloPersonalLabel')}</b>：{t('zaloPersonalDesc')}</p>
        <p>• <b>{t('customDefaultDaysLabel')}</b>：{t('customDefaultDaysDesc')}</p>
      </div>

      {/* 角色管道設定 */}
      <div className="grid gap-3">
        {roles.map(([label, tgKey, emailKey, zaloKey, hint]) => (
          <Card key={label} className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>{label}</span>
                <span className="text-xs text-muted-foreground font-normal">· {hint}</span>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-2 text-xs">
              <label className="space-y-1">
                <span className="text-gray-500 font-medium">Telegram Chat ID</span>
                <Input value={String(cfg[tgKey] ?? '')} onChange={e => set({ [tgKey]: e.target.value } as Partial<AffairSettings>)} placeholder="123456789" />
              </label>
              <label className="space-y-1">
                <span className="text-gray-500 font-medium">Email</span>
                <Input value={String(cfg[emailKey] ?? '')} onChange={e => set({ [emailKey]: e.target.value } as Partial<AffairSettings>)} placeholder="user@example.com" />
              </label>
              <label className="space-y-1">
                <span className="text-indigo-600 font-semibold">🔵 {t('zaloPersonalField')}</span>
                <Input value={String(cfg[zaloKey] ?? '')} onChange={e => set({ [zaloKey]: e.target.value } as Partial<AffairSettings>)} placeholder={t('zaloUserIdPlaceholder')} />
              </label>
            </div>
          </Card>
        ))}
      </div>

      {/* 預設天數調整 */}
      <Card className="p-4 space-y-3">
        <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4 text-indigo-600" />
          {t('globalDefaultDaysTitle')}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg space-y-2 border">
            <div className="font-semibold text-slate-700">💰 {t('leasePaymentNoticeDays')}</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-gray-500">{t('firstAdvanceDays')}</span>
                <Input type="number" value={String(cfg.default_pay_stage1_days ?? 3)} onChange={e => set({ default_pay_stage1_days: Number(e.target.value) || 0 })} />
              </label>
              <label className="space-y-1">
                <span className="text-gray-500">{t('secondImmediateDays')}</span>
                <Input type="number" value={String(cfg.default_pay_stage2_days ?? 1)} onChange={e => set({ default_pay_stage2_days: Number(e.target.value) || 0 })} />
              </label>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg space-y-2 border">
            <div className="font-semibold text-slate-700">📄 {t('expiryTrackingStages')}</div>
            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1">
                <span className="text-gray-500">{t('stage1Negotiate')}</span>
                <Input type="number" value={String(cfg.default_expiry_stage1_days ?? 30)} onChange={e => set({ default_expiry_stage1_days: Number(e.target.value) || 0 })} />
              </label>
              <label className="space-y-1">
                <span className="text-gray-500">{t('stage2Track')}</span>
                <Input type="number" value={String(cfg.default_expiry_stage2_days ?? 15)} onChange={e => set({ default_expiry_stage2_days: Number(e.target.value) || 0 })} />
              </label>
              <label className="space-y-1">
                <span className="text-gray-500">{t('stage3Urgent')}</span>
                <Input type="number" value={String(cfg.default_expiry_urgent_days ?? 7)} onChange={e => set({ default_expiry_urgent_days: Number(e.target.value) || 0 })} />
              </label>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <RunRemindersButton />
        <Button size="sm" onClick={save} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? t('savedSuccess') : t('saveNotificationSettings')}
        </Button>
      </div>
    </div>
  )
}

function RunRemindersButton() {
  const t = useTranslations('Affairs')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const run = async () => {
    setBusy(true); setMsg('')
    const res = await fetch('/api/affairs/run-reminders', { method: 'POST' })
    setBusy(false)
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? t('remindersRunComplete', { expiry: d.expiry ?? 0, payment: d.payment ?? 0 }) : (d.error ?? t('runFailed')))
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
        {t('checkAndSendNow')}
      </Button>
      {msg && <span className="text-xs text-slate-600">{msg}</span>}
    </div>
  )
}
