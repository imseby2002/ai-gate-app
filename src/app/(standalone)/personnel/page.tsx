'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Users, Loader2, AlertCircle, Search, Trash2, Building2, CheckCircle2, Bell, FileSpreadsheet, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ExcelImportModal } from '@/components/common/ExcelImportModal'
import { EmployeeWhitelistManager } from '@/components/admin/EmployeeWhitelistManager'
import type { ImportColumn } from '@/lib/excel/universal-import'
import { PersonDetail } from '@/components/hr/PersonDetail'

const PERSONNEL_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'name', label: '姓名', required: true, example: '阮小芳', aliases: ['name', '全名'] },
  { key: 'gender', label: '性別', example: '女', aliases: ['性別', 'gender'] },
  { key: 'native_place', label: '籍貫', example: '胡志明市', aliases: ['籍貫', 'native_place'] },
  { key: 'birthday', label: '生日', example: '1998-05-20', aliases: ['生日', '出生年月日', 'birthday'] },
  { key: 'id_number', label: '身分證號', example: '079198001234', aliases: ['身分證', '身分證號', 'id_number', 'CCCD'] },
  { key: 'education', label: '學歷', example: '大學', aliases: ['學歷', 'education'] },
  { key: 'phone', label: '電話', example: '0901234567', aliases: ['電話', '手機', 'phone'] },
  { key: 'email', label: '個人Email', example: 'staff@gmail.com', aliases: ['email', 'Email', '電子信箱', '信箱'] },
  { key: 'company_email', label: '公司Email', example: 'staff@company.com', aliases: ['公司Email', 'company_email'] },
  { key: 'position', label: '職務', example: '店長', aliases: ['職稱', '職務', 'position'] },
  { key: 'store', label: '門市', example: 'YL', aliases: ['門市', '單位', 'store'] },
  { key: 'staff_category', label: '正兼職', example: '正職', aliases: ['正兼職', 'staff_category', '兼職別'] },
  { key: 'payroll_no', label: '薪資編號', example: 'PR001', aliases: ['薪資編號', 'payroll_no'] },
  { key: 'address', label: '地址', example: '胡志明市第一郡', aliases: ['地址', 'address'] },
  { key: 'zalo_user_id', label: 'ZALO', example: '0901234567', aliases: ['ZALO', 'zalo', 'zalo_user_id'] },
]

interface PersonLite { id: string; name: string; position: string; store: string; staff_category: string; stage: string; hired_employee_id: string | null; doc_missing: number; doc_total: number }

export default function PersonnelPage() {
  const t = useTranslations('Personnel')
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [showWhitelist, setShowWhitelist] = useState(false)

  useEffect(() => { fetch('/api/hr/personnel').then(r => setIsAdmin(r.status !== 403)) }, [])
  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">{t('adminOnly')}</p></div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={showWhitelist ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={() => setShowWhitelist(v => !v)}
          >
            <Mail className="h-4 w-4" />
            {t('employeeWhitelist')}
          </Button>
          <Link href="/hr"><Button variant="outline" size="sm" className="gap-1.5"><Building2 className="h-4 w-4" />{t('hrManagement')}</Button></Link>
        </div>
      </div>

      {showWhitelist && (
        <EmployeeWhitelistManager mode="company" />
      )}

      {selected ? <PersonDetail id={selected} onBack={() => setSelected(null)} /> : <PeopleList onOpen={setSelected} />}
    </div>
  )
}

function PeopleList({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useTranslations('Personnel')
  const [people, setPeople] = useState<PersonLite[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [tick, setTick] = useState(0)

  const reload = () => setTick(x => x + 1)

  const removePerson = async (p: PersonLite) => {
    const isHired = !!p.hired_employee_id
    const promptMsg = isHired
      ? t('confirmDeleteHired', { name: p.name || t('thisPerson') })
      : t('confirmDeleteApplicant', { name: p.name || t('thisList') })
    if (!confirm(promptMsg)) return
    const res = await fetch('/api/hr/personnel', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id }),
    })
    if (res.ok) {
      reload()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? t('deleteFailed'))
    }
  }

  useEffect(() => {
    fetch('/api/hr/personnel').then(r => r.ok ? r.json() : { people: [] }).then(d => { setPeople(d.people ?? []); setLoading(false) })
  }, [tick])

  const filtered = people.filter(p => !q || (p.name || '').toLowerCase().includes(q.toLowerCase()) || (p.store || '').toLowerCase().includes(q.toLowerCase()))
  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="pl-9" /></div>
        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setShowImport(true)}>
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          {t('bulkImport')}
        </Button>
        <RemindButton />
      </div>

      {showImport && (
        <ExcelImportModal
          title="批次匯入 / 更新人員資料"
          description="支援 Excel (.xlsx) 與 CSV 檔。若身分證號、Email 或姓名電話相符將自動更新，否則新增。"
          columns={PERSONNEL_IMPORT_COLUMNS}
          columnsNs="PersonnelImport"
          templateFilename="人員資料範本"
          sheetName="人員名冊"
          onClose={() => setShowImport(false)}
          onSuccess={reload}
          onSubmit={async rows => {
            const res = await fetch('/api/hr/personnel/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows }),
            })
            return await res.json()
          }}
        />
      )}

      {filtered.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">{t('noData')}</div>
        : <div className="grid gap-2">{filtered.map(p => (
          <div key={p.id} className="flex items-center gap-2">
            <button onClick={() => onOpen(p.id)} className="text-left flex-1 min-w-0">
              <Card className="p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name || t('unnamed')}</span>
                    <span className="text-xs text-gray-400">{p.position}{p.store ? `・${p.store}` : ''}</span>
                    <span className={`text-[11px] px-1.5 rounded ${!p.hired_employee_id ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                      {p.staff_category === 'parttime' || p.staff_category === 'hourly' ? t('parttime') : p.staff_category === 'fulltime' ? t('fulltime') : p.hired_employee_id ? t('active') : t('applying')}
                    </span>
                  </div>
                </div>
                {p.doc_missing > 0
                  ? <span className="text-xs text-amber-600 shrink-0">{t('docsMissing', { missing: p.doc_missing, total: p.doc_total })}</span>
                  : <span className="text-xs text-emerald-600 shrink-0 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{t('docsComplete')}</span>}
              </Card>
            </button>
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-10 w-10 p-0 shrink-0"
              title={t('deleteThisList')}
              onClick={() => removePerson(p)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}</div>}
    </div>
  )
}

function RemindButton() {
  const t = useTranslations('Personnel')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const run = async () => {
    setBusy(true); setMsg('')
    const res = await fetch('/api/hr/doc-reminders', { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    setMsg(res.ok ? t('notifiedCount', { notified: d.notified ?? 0, pending: d.hr_pending ?? 0 }) : (d.error ?? t('failed')))
  }
  return (
    <div className="flex items-center gap-2 shrink-0">
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
      <Button size="sm" variant="outline" className="gap-1.5" onClick={run} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}{t('sendMissingReminder')}</Button>
    </div>
  )
}
