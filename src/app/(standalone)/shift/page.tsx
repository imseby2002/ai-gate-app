'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CalendarDays, AlertCircle, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StoreSelect, useStoreOptions } from '@/components/store/StoreSelect'
import { EvaluationTab, type EvalEmployee } from '@/components/hr/EvaluationTab'
import { ScheduleBoard } from '@/components/shift/ScheduleBoard'

export default function ShiftPage() {
  const t = useTranslations('Shift')
  const { status: storeStatus, options: storeOptions, store, setStore, locked: lockedStore } = useStoreOptions()
  const [view, setView] = useState<'schedule' | 'evaluation'>('schedule')
  const isAdmin = storeStatus === 'loading' ? null : storeStatus === 'ok'

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">{t('adminOnly')}</p></div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><CalendarDays className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="ml-auto"><Link href="/store-inventory"><Button variant="outline" size="sm" className="gap-1.5"><Store className="h-4 w-4" />{t('inventory')}</Button></Link></div>
      </div>

      <Card className="p-3 flex flex-wrap items-end gap-3">
        <label className="space-y-1 inline-block">
          <span className="block text-xs text-gray-500">{t('store')}{lockedStore ? ` 🔒` : ''}</span>
          <StoreSelect value={store} onChange={setStore} options={storeOptions} locked={lockedStore} placeholder={t('storePlaceholder')} />
        </label>
        <div className="ml-auto flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-900 p-1">
          {(['schedule', 'evaluation'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-md text-sm ${view === v ? 'bg-white dark:bg-gray-800 shadow-sm font-medium' : 'text-gray-500'}`}>
              {v === 'schedule' ? t('tabSchedule') : t('tabEvaluation')}
            </button>
          ))}
        </div>
      </Card>

      {!store ? <div className="text-center py-10 text-gray-400 text-sm">{t('selectStoreFirst')}</div>
        : view === 'evaluation' ? <StoreEvaluation store={store} />
        : <ScheduleBoard key={store} store={store} />}
    </div>
  )
}

// 門市員工評分：只列該門市在職員工，評分資料與人事頁同一份
function StoreEvaluation({ store }: { store: string }) {
  const [data, setData] = useState<{ store: string; emps: EvalEmployee[] } | null>(null)
  useEffect(() => {
    fetch(`/api/shift/employees?store=${encodeURIComponent(store)}`).then(r => r.ok ? r.json() : { employees: [] })
      .then(d => setData({ store, emps: d.employees ?? [] }))
  }, [store])
  const loading = data?.store !== store
  return <Card className="p-4"><EvaluationTab employees={loading ? [] : data!.emps} loading={loading} store={store} allowImport={false} kinds={['store']} /></Card>
}
