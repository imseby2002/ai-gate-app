'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Building2, ArrowLeft, Loader2, AlertCircle, Plus, Trash2, Save, Store, Search, FileSpreadsheet, Camera, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ExcelImportModal } from '@/components/common/ExcelImportModal'
import type { ImportColumn } from '@/lib/excel/universal-import'

const fmt = (n: number, locale: string) => Math.round(Number(n) || 0).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')
const UNIT_TYPE_VALUES = ['store', 'office', 'factory', 'kitchen', 'gm', 'rd', 'audit', 'cashier', 'affairs', 'marketing', 'general', 'accounting', 'hr', 'repair']

const UNIT_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'code', label: '單位編號', required: true, example: 'YL', aliases: ['code', '編號', '代碼', '門市代碼'] },
  { key: 'name', label: '單位名稱', required: true, example: '怡朗店', aliases: ['name', '名稱', '門市名稱'] },
  { key: 'unit_type', label: '類型', example: '門市', aliases: ['unit_type', '類型', '單位類型'] },
  { key: 'short_name', label: '簡稱', example: '怡朗', aliases: ['short_name', '簡稱'] },
  { key: 'region', label: '區域', example: '胡志明', aliases: ['region', '區域', '地區'] },
  { key: 'base_hourly_rate', label: '基本時薪', example: 25000, aliases: ['base_hourly_rate', '基本時薪', '時薪'] },
  { key: 'electricity_no', label: '電號', example: 'PE01234567', aliases: ['electricity_no', '電號', '電費編號'] },
  { key: 'water_no', label: '水號', example: 'PW01234567', aliases: ['water_no', '水號', '水費編號'] },
  { key: 'address', label: '地址', example: '胡志明市第一郡...', aliases: ['address', '地址'] },
  { key: 'active', label: '啟用狀態', example: '是', aliases: ['active', '啟用', '狀態'] },
]

interface Unit {
  id: string; code: string; name: string; region: string; active: boolean
  unit_type: string; short_name: string; electricity_no: string; water_no: string; address: string; base_hourly_rate: number
}

export default function UnitsPage() {
  const t = useTranslations('Units')
  const locale = useLocale()
  const UNIT_TYPES = UNIT_TYPE_VALUES.map(value => ({ value, label: t(`type_${value}`) }))
  const TYPE_LABEL = Object.fromEntries(UNIT_TYPES.map(u => [u.value, u.label]))
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [defaultRate, setDefaultRate] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = () => setTick(t => t + 1)

  useEffect(() => {
    fetch('/api/fin/stores').then(r => { if (r.status === 403) { setIsAdmin(false); return null } setIsAdmin(true); return r.json() })
      .then(d => { if (d) setUnits(d.stores ?? []); setLoading(false) })
    fetch('/api/fin/unit-settings').then(r => r.ok ? r.json() : null).then(d => { if (d) setDefaultRate(d.default_hourly_rate ?? 0) })
  }, [tick])

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">{t('needLogin')}</p></div>
    </div>
  )
  const selected = units.find(u => u.id === sel) ?? null

  const saveDefault = async (v: number) => {
    setDefaultRate(v)
    await fetch('/api/fin/unit-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ default_hourly_rate: v }) })
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{t('badge')}</span>
          </div>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          title="批次匯入 / 更新單位資料"
          description="支援 .xlsx, .xls 與 .csv 檔案。若單位編號相符將自動更新，否則新增。"
          columns={UNIT_IMPORT_COLUMNS}
          templateFilename="單位資料範本"
          sheetName="單位清單"
          onClose={() => setShowImport(false)}
          onSuccess={reload}
          onSubmit={async rows => {
            const res = await fetch('/api/fin/stores/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows }),
            })
            return await res.json()
          }}
        />
      )}

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : selected ? <UnitDetail unit={selected} defaultRate={defaultRate} onBack={() => setSel(null)} onSaved={reload} />
        : (
          <div className="space-y-3">
            <Card className="p-3 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm"><span className="text-gray-500">{t('defaultRateLabel')}</span>
                <Input type="number" defaultValue={String(defaultRate)} onBlur={e => saveDefault(Number(e.target.value) || 0)} className="w-28 h-9" /></label>
              <span className="text-xs text-gray-400">{t('defaultRateHint')}</span>
            </Card>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-9 rounded-md border px-2 text-sm">
                <option value="">{t('allTypes')}</option>{UNIT_TYPES.map(ut => <option key={ut.value} value={ut.value}>{ut.label}</option>)}
              </select>
              <div className="relative flex-1 min-w-[200px]"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="pl-9" /></div>
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setShowImport(true)}>
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />{t('bulkImport')}
              </Button>
              <NewUnitButton onCreated={id => { reload(); setSel(id) }} />
            </div>
            {units.filter(u => (!filterType || u.unit_type === filterType) && (!q || u.name.toLowerCase().includes(q.toLowerCase()) || u.code.toLowerCase().includes(q.toLowerCase()))).map(u => (
              <button key={u.id} onClick={() => setSel(u.id)} className="text-left w-full">
                <Card className="p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="font-medium">{u.name || u.code}</span>
                      <span className="text-xs text-gray-400">{u.code}</span>
                      <span className="text-[11px] px-1.5 rounded bg-gray-100 text-gray-500">{TYPE_LABEL[u.unit_type] ?? u.unit_type}</span>
                      {!u.active && <span className="text-xs text-red-400">{t('inactive')}</span>}
                    </div>
                    <div className="text-xs text-gray-400">{u.region ? `${u.region}・` : ''}{u.address || t('noAddress')}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400">{t('hourlyRate', { amount: fmt(u.base_hourly_rate || defaultRate, locale) })}</span>
                    {u.unit_type === 'store' && (
                      <Link
                        href="/mkt"
                        onClick={e => e.stopPropagation()}
                        className="text-[11px] font-medium text-pink-600 dark:text-pink-400 hover:text-pink-700 bg-pink-50 dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900/40 px-2 py-1 rounded-md flex items-center gap-1 border border-pink-200/60 dark:border-pink-800/40"
                        title={t('marketingLinkTitle')}
                      >
                        <Camera className="h-3 w-3" />
                        <span>{t('marketingLink')}</span>
                      </Link>
                    )}
                  </div>
                </Card>
              </button>
            ))}
            {units.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">{t('empty')}</div>}
          </div>
        )}
    </div>
  )
}

function NewUnitButton({ onCreated }: { onCreated: (id: string) => void }) {
  const t = useTranslations('Units')
  const [busy, setBusy] = useState(false)
  const add = async () => {
    const code = prompt(t('newUnitPrompt')); if (!code) return
    setBusy(true)
    const res = await fetch('/api/fin/stores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name: code, unit_type: 'store' }) })
    setBusy(false)
    const d = await res.json().catch(() => ({}))
    if (res.ok && d.id) onCreated(d.id); else alert(d.error ?? t('createFailed'))
  }
  return <Button size="sm" className="gap-1.5 shrink-0" onClick={add} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{t('newUnit')}</Button>
}

function UnitDetail({ unit, defaultRate, onBack, onSaved }: { unit: Unit; defaultRate: number; onBack: () => void; onSaved: () => void }) {
  const t = useTranslations('Units')
  const locale = useLocale()
  const UNIT_TYPES = UNIT_TYPE_VALUES.map(value => ({ value, label: t(`type_${value}`) }))
  const [f, setF] = useState<Unit>({ ...unit })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (patch: Partial<Unit>) => setF(p => ({ ...p, ...patch }))

  const save = async () => {
    setSaving(true); setMsg('')
    const res = await fetch('/api/fin/stores', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    setSaving(false); setMsg(res.ok ? t('saved') : (await res.json().catch(() => ({}))).error ?? t('saveFailed')); if (res.ok) onSaved()
  }
  const remove = async () => {
    if (!confirm(t('confirmDelete', { name: f.name || f.code }))) return
    const res = await fetch('/api/fin/stores', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id }) })
    if (res.ok) { onSaved(); onBack() } else alert((await res.json().catch(() => ({}))).error ?? t('deleteFailed'))
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />{t('backToList')}</button>
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-sm">{t('basicInfo')}</h3>
          <div className="flex items-center gap-2">{msg && <span className="text-xs text-gray-500">{msg}</span>}
            <button onClick={remove} className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1"><Trash2 className="h-4 w-4" />{t('delete')}</button>
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t('save')}</Button></div>
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('unitType')}</span>
            <select value={f.unit_type} onChange={e => set({ unit_type: e.target.value })} className="w-full h-9 rounded-md border px-2 text-sm">
              {UNIT_TYPES.map(ut => <option key={ut.value} value={ut.value}>{ut.label}</option>)}
            </select></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('unitCode')}</span><Input value={f.code} onChange={e => set({ code: e.target.value })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('name')}</span><Input value={f.name} onChange={e => set({ name: e.target.value })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('shortName')}</span><Input value={f.short_name} onChange={e => set({ short_name: e.target.value })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('region')}</span><Input value={f.region} onChange={e => set({ region: e.target.value })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('baseHourlyRate', { amount: fmt(defaultRate, locale) })}</span><Input type="number" value={String(f.base_hourly_rate)} onChange={e => set({ base_hourly_rate: Number(e.target.value) || 0 })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('electricityNo')}</span><Input value={f.electricity_no} onChange={e => set({ electricity_no: e.target.value })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('waterNo')}</span><Input value={f.water_no} onChange={e => set({ water_no: e.target.value })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('address')}</span><Input value={f.address} onChange={e => set({ address: e.target.value })} className="h-9" /></label>
        </div>
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.active} onChange={e => set({ active: e.target.checked })} />{t('active')}</label>
        </div>

        {/* 門市行銷圖文跨部門連動提示 */}
        {f.unit_type === 'store' && (
          <div className="p-3 bg-pink-50/70 dark:bg-pink-950/30 border border-pink-200/70 dark:border-pink-800/40 rounded-xl flex items-center justify-between gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-pink-600 shrink-0" />
              <div>
                <span className="font-semibold text-pink-950 dark:text-pink-200">{t('marketingHintTitle')}</span>
                <span className="text-muted-foreground ml-1">{t('marketingHintDesc')}</span>
              </div>
            </div>
            <Link
              href="/mkt"
              className="inline-flex items-center gap-1 font-semibold px-2.5 py-1 rounded bg-pink-600 text-white hover:bg-pink-700 transition-colors shrink-0 shadow-xs"
            >
              {t('openMarketing')}
            </Link>
          </div>
        )}
      </Card>
    </div>
  )
}
