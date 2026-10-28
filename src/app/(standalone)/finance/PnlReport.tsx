'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Plus, X, Columns3, LineChart, Settings2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getStoreKindLabel, type PnlLine } from './pnl-schema'
import { CompareView, TrendView } from './PnlViews'
import PnlSchemaEditor from './PnlSchemaEditor'
import PnlImportSchema from './PnlImportSchema'

import type { Store } from './PnlViews'

export default function PnlReport() {
  const t = useTranslations('FinancePage')
  const [mode, setMode] = useState<'compare' | 'trend'>('compare')
  const [stores, setStores] = useState<Store[]>([])
  const [lines, setLines] = useState<PnlLine[]>([])
  const [loadingSchema, setLoadingSchema] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [importing, setImporting] = useState(false)

  // 共用：載入門市清單（兩種檢視都要）
  const loadStores = useCallback(async (): Promise<Store[]> => {
    const res = await fetch('/api/hr/pnl')
    const j = await res.json()
    setStores(j.stores ?? [])
    return j.stores ?? []
  }, [])

  // 載入自訂科目樹（首次由後端種入預設 + 建一個 A門市）
  const loadSchema = useCallback(async () => {
    setLoadingSchema(true)
    try {
      const res = await fetch('/api/hr/pnl/schema')
      const j = await res.json()
      setLines(j.lines ?? [])
    } finally { setLoadingSchema(false) }
  }, [])

  useEffect(() => { loadStores(); loadSchema() }, [loadStores, loadSchema])

  if (editing) {
    return (
      <PnlSchemaEditor
        initial={lines}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); loadSchema(); loadStores() }}
      />
    )
  }

  if (importing) {
    return (
      <PnlImportSchema
        onClose={() => setImporting(false)}
        onSaved={() => { setImporting(false); loadSchema(); loadStores() }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
          <button onClick={() => setMode('compare')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
            style={mode === 'compare' ? { background: 'white', color: 'var(--primary)' } : { color: '#6b7280' }}>
            <Columns3 className="h-4 w-4" />{t('multiStoreCompare')}
          </button>
          <button onClick={() => setMode('trend')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
            style={mode === 'trend' ? { background: 'white', color: 'var(--primary)' } : { color: '#6b7280' }}>
            <LineChart className="h-4 w-4" />{t('singleStoreTrend')}
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setImporting(true)} className="gap-1.5 h-8 ml-auto">
          <Upload className="h-4 w-4" />{t('reportImport')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5 h-8">
          <Settings2 className="h-4 w-4" />{t('lineSettingsTitle')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="gap-1.5 h-8">
          <Plus className="h-4 w-4" />{t('addStore')}
        </Button>
      </div>

      {adding && <AddStoreForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); loadStores() }} nextSort={stores.length} />}

      {loadingSchema ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : stores.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">
          {t('noStoresYetHint')}
        </div>
      ) : mode === 'compare' ? (
        <CompareView lines={lines} />
      ) : (
        <TrendView stores={stores} lines={lines} />
      )}
    </div>
  )
}

function AddStoreForm({ onClose, onSaved, nextSort }: { onClose: () => void; onSaved: () => void; nextSort: number }) {
  const t = useTranslations('FinancePage')
  const STORE_KIND_LABEL = getStoreKindLabel(t)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [nameVi, setNameVi] = useState('')
  const [kind, setKind] = useState('store')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!code.trim() || !name.trim()) { setErr(t('codeAndNameRequired')); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/hr/pnl/stores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, name_vi: nameVi, kind, sort: nextSort }),
      })
      const j = await res.json()
      if (!res.ok) { setErr(j.error ?? t('saveFailed')); return }
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border bg-gray-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('addStore')}</span>
        <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-500">{t('codeLabel')}</label>
          <Input value={code} onChange={e => setCode(e.target.value)} placeholder="BACH_MAI" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">{t('displayNameLabel')}</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('storeNamePlaceholder')} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">{t('viNameLabel')}</label>
          <Input value={nameVi} onChange={e => setNameVi(e.target.value)} placeholder="BACH MAI" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">{t('typeLabel')}</label>
          <select value={kind} onChange={e => setKind(e.target.value)}
            className="h-8 w-full rounded-md border bg-background px-2 text-sm">
            {Object.entries(STORE_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving} className="gap-1.5 h-8">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{t('save')}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose} className="h-8">{t('cancel')}</Button>
      </div>
    </div>
  )
}
