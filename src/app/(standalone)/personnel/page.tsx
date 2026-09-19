'use client'

import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Users, ArrowLeft, Loader2, AlertCircle, Search, FileText, Upload, Trash2, ExternalLink, Save, Building2, CheckCircle2, XCircle, DollarSign, Bell, FileSpreadsheet, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ExcelImportModal } from '@/components/common/ExcelImportModal'
import { EmployeeWhitelistManager } from '@/components/admin/EmployeeWhitelistManager'
import type { ImportColumn } from '@/lib/excel/universal-import'

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

const fmt = (n: number, locale: string) => Math.round(Number(n) || 0).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')

interface PersonLite { id: string; name: string; position: string; store: string; staff_category: string; stage: string; hired_employee_id: string | null; doc_missing: number; doc_total: number }
interface DocSpec { type: string; label: string; copy: string; categories: string[] }
interface DocRow { id: string; doc_type: string; label: string; file_name: string; url: string; uploaded_at: string }
interface Checklist { doc_key: string; original_received: boolean; copy_received: boolean; note: string }
interface Contract { id: string; contract_no: string; sign_date: string | null; start_date: string | null; end_date: string | null; file_name: string; url: string; note: string }
interface Employee { base_salary: number; hourly_rate: number; employment_type: string; insurance_required: boolean; insurance_status: string; insurance_salary: number; attendance_no: string; bank_name: string; bank_account: string; department: string; position: string }
interface Payroll { year: number; month: number; base_salary: number; allowances: number; deductions: number; bonus: number; net_pay: number; status: string }
interface Person { id: string; name: string; gender: string; native_place: string; birthday: string | null; id_number: string; education: string; email: string; company_email: string; zalo_user_id: string; payroll_no: string; position: string; store: string; staff_category: string; address: string; phone: string; apply_token: string; profile_text: string; hired_employee_id?: string | null }

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
                      {p.staff_category === 'parttime' ? t('parttime') : p.staff_category === 'fulltime' ? t('fulltime') : p.hired_employee_id ? t('active') : t('applying')}
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

function PersonDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useTranslations('Personnel')
  const locale = useLocale()
  const CATEGORY_LABEL: Record<string, string> = { recruit: t('categoryRecruit'), insurance: t('categoryInsurance'), tax: t('categoryTax') }
  const [data, setData] = useState<{ person: Person; documents: DocRow[]; checklist: Checklist[]; contracts: Contract[]; employee: Employee | null; payroll: Payroll[]; evaluations: unknown[]; catalog: DocSpec[] } | null>(null)
  const [tick, setTick] = useState(0)
  const [form, setForm] = useState<Partial<Person>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch(`/api/hr/personnel?id=${id}`).then(r => r.ok ? r.json() : null).then(d => { if (d) { setData(d); setForm(d.person) } })
  }, [id, tick])
  const reload = () => setTick(x => x + 1)

  if (!data) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  const set = (patch: Partial<Person>) => setForm(p => ({ ...p, ...patch }))
  const save = async () => {
    setSaving(true); setMsg('')
    const res = await fetch('/api/hr/personnel', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...form }) })
    setSaving(false); setMsg(res.ok ? t('saved') : t('saveFailed'))
  }

  const removeCurrent = async () => {
    const personName = data?.person?.name || t('thisPerson')
    const isHired = !!data?.person?.hired_employee_id
    const promptMsg = isHired
      ? t('confirmDeleteHired', { name: personName })
      : t('confirmDeleteApplicant', { name: personName })
    if (!confirm(promptMsg)) return
    setDeleting(true)
    const res = await fetch('/api/hr/personnel', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDeleting(false)
    if (res.ok) {
      alert(t('deleteSuccess', { name: personName }))
      onBack()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? t('deleteFailed'))
    }
  }

  const haveDoc = new Map(data.documents.map(d => [d.doc_type, d]))
  const paperOf = new Map(data.checklist.map(c => [c.doc_key, c]))
  const togglePaper = async (doc_key: string, v: boolean) => {
    await fetch('/api/hr/candidates/checklist', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_id: id, doc_key, original_received: v }) })
    reload()
  }

  const F = ([label, key, type]: [string, keyof Person, string?]) => (
    <label className="space-y-1"><span className="text-xs text-gray-500">{label}</span>
      <Input type={type ?? 'text'} value={String(form[key] ?? '')} onChange={e => set({ [key]: e.target.value } as Partial<Person>)} className="h-9" /></label>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />{t('backToList')}</button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          onClick={removeCurrent}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {t('deleteThisList')}
        </Button>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-sm">{t('basicInfo')}</h3>
          <div className="flex items-center gap-2">{msg && <span className="text-xs text-gray-500">{msg}</span>}<Button size="sm" onClick={save} disabled={saving} className="gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t('save')}</Button></div>
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          {([[t('fieldName'), 'name'], [t('fieldGender'), 'gender'], [t('fieldNativePlace'), 'native_place'], [t('fieldBirthday'), 'birthday', 'date'], [t('fieldIdNumber'), 'id_number'], [t('fieldEducation'), 'education'], [t('fieldPosition'), 'position'], [t('fieldStore'), 'store'], [t('fieldPayrollNo'), 'payroll_no'], [t('fieldStaffCategory'), 'staff_category'], [t('fieldPhone'), 'phone'], [t('fieldEmail'), 'email', 'email'], [t('fieldCompanyEmail'), 'company_email', 'email'], ['ZALO', 'zalo_user_id'], [t('fieldAddress'), 'address']] as [string, keyof Person, string?][]).map(f => <div key={f[1]}>{F(f)}</div>)}
        </div>
        <p className="text-[11px] text-gray-400">{t('personalLink')}<code>/apply/edit/{data.person.apply_token}</code></p>
      </Card>

      {/* 文件清單 */}
      <Card className="p-4 space-y-2">
        <h3 className="font-semibold text-sm flex items-center gap-1.5"><FileText className="h-4 w-4" />{t('documentList')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b"><th className="py-1.5 pr-2">{t('colDocument')}</th><th className="pr-2">{t('colPurpose')}</th><th className="pr-2">{t('colPaperType')}</th><th className="pr-2 text-center">{t('colUploaded')}</th><th className="pr-2">{t('colPaperReceived')}</th><th className="pr-2"></th></tr></thead>
            <tbody>{data.catalog.filter(c => c.type !== 'other').map(spec => {
              const doc = haveDoc.get(spec.type)
              const paper = paperOf.get(spec.type)
              return (
                <tr key={spec.type} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">{spec.label}</td>
                  <td className="pr-2 text-[11px] text-gray-400">{spec.categories.map(c => CATEGORY_LABEL[c] ?? c).join('／')}</td>
                  <td className="pr-2 text-xs text-gray-400">{spec.copy === 'original' ? t('paperOriginal') : spec.copy === 'both' ? t('paperBoth') : t('paperCopy')}</td>
                  <td className="pr-2 text-center">{doc ? <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" /> : <XCircle className="h-4 w-4 text-gray-300 inline" />}</td>
                  <td className="pr-2"><input type="checkbox" checked={!!paper?.original_received} onChange={e => togglePaper(spec.type, e.target.checked)} /></td>
                  <td className="pr-2">{doc?.url && <a href={doc.url} target="_blank" rel="noreferrer" className="text-primary"><ExternalLink className="h-4 w-4" /></a>}</td>
                </tr>
              )
            })}</tbody></table>
        </div>
      </Card>

      {/* 薪資獎金 */}
      {data.employee && (
        <Card className="p-4 space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-1.5"><DollarSign className="h-4 w-4" />{t('payroll')}</h3>
          <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
            <span>{t('baseSalary', { amount: fmt(data.employee.base_salary, locale) })}</span>
            {data.employee.hourly_rate > 0 && <span>{t('hourlyRate', { amount: fmt(data.employee.hourly_rate, locale) })}</span>}
            <span>{t('insurance', { status: data.employee.insurance_required ? t('insuranceRequired', { status: data.employee.insurance_status || '—' }) : t('insuranceExempt') })}</span>
            {data.employee.attendance_no && <span>{t('attendanceNo', { no: data.employee.attendance_no })}</span>}
          </div>
          {data.payroll.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b"><th className="py-1 pr-2">{t('colMonth')}</th><th className="pr-2 text-right">{t('colBaseSalary')}</th><th className="pr-2 text-right">{t('colAllowances')}</th><th className="pr-2 text-right">{t('colDeductions')}</th><th className="pr-2 text-right">{t('colBonus')}</th><th className="pr-2 text-right">{t('colNetPay')}</th><th className="pr-2">{t('colStatus')}</th></tr></thead>
                <tbody>{data.payroll.map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1 pr-2">{p.year}/{p.month}</td>
                    <td className="pr-2 text-right tabular-nums">{fmt(p.base_salary, locale)}</td>
                    <td className="pr-2 text-right tabular-nums">{fmt(p.allowances, locale)}</td>
                    <td className="pr-2 text-right tabular-nums text-red-500">{fmt(p.deductions, locale)}</td>
                    <td className="pr-2 text-right tabular-nums text-emerald-600">{fmt(p.bonus, locale)}</td>
                    <td className="pr-2 text-right tabular-nums font-medium">{fmt(p.net_pay, locale)}</td>
                    <td className="pr-2 text-xs text-gray-400">{p.status}</td>
                  </tr>))}</tbody></table>
            </div>
          )}
        </Card>
      )}

      {/* AI 彙整基本資料 */}
      <AiProfileSection id={id} profileText={data.person.profile_text} hasDocs={data.documents.length > 0} onChange={reload} />

      {/* 勞動合同 */}
      <ContractSection candidateId={id} contracts={data.contracts} onChange={reload} />
    </div>
  )
}

function AiProfileSection({ id, profileText, hasDocs, onChange }: { id: string; profileText: string; hasDocs: boolean; onChange: () => void }) {
  const t = useTranslations('Personnel')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const run = async () => {
    setBusy(true); setMsg('')
    const res = await fetch('/api/hr/personnel/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) { setMsg(t('aiSummarized', { used: d.used })); onChange() } else setMsg(d.error ?? t('failed'))
  }
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-1.5"><FileText className="h-4 w-4 text-indigo-500" />{t('aiProfileTitle')}</h3>
        <div className="flex items-center gap-2">{msg && <span className="text-xs text-gray-500">{msg}</span>}
          <Button size="sm" variant="outline" onClick={run} disabled={busy || !hasDocs} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{profileText ? t('reSummarize') : t('aiSummarize')}</Button></div>
      </div>
      {!hasDocs && <p className="text-xs text-gray-400">{t('noDocsToSummarize')}</p>}
      {profileText
        ? <pre className="text-xs text-gray-600 whitespace-pre-wrap max-h-80 overflow-y-auto bg-gray-50 rounded-lg p-3">{profileText}</pre>
        : hasDocs && <p className="text-xs text-gray-400">{t('notSummarizedYet')}</p>}
    </Card>
  )
}

function ContractSection({ candidateId, contracts, onChange }: { candidateId: string; contracts: Contract[]; onChange: () => void }) {
  const t = useTranslations('Personnel')
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ contract_no: '', sign_date: '', start_date: '', end_date: '', note: '' })
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const add = async () => {
    setBusy(true)
    const fd = new FormData()
    fd.append('candidate_id', candidateId)
    Object.entries(f).forEach(([k, v]) => fd.append(k, v))
    if (file) fd.append('file', file)
    const res = await fetch('/api/hr/contracts', { method: 'POST', body: fd })
    setBusy(false)
    if (res.ok) { setAdding(false); setF({ contract_no: '', sign_date: '', start_date: '', end_date: '', note: '' }); setFile(null); onChange() }
    else alert((await res.json().catch(() => ({}))).error ?? t('saveFailed'))
  }
  const remove = async (id: string) => { if (!confirm(t('confirmDeleteContract'))) return; await fetch('/api/hr/contracts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); onChange() }

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between"><h3 className="font-semibold text-sm">{t('laborContract')}</h3><Button size="sm" variant="outline" onClick={() => setAdding(a => !a)}>{adding ? t('cancel') : t('addContract')}</Button></div>
      {adding && (
        <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1"><span className="text-xs text-gray-500">{t('contractNo')}</span><Input value={f.contract_no} onChange={e => setF({ ...f, contract_no: e.target.value })} className="h-9" /></label>
            <label className="space-y-1"><span className="text-xs text-gray-500">{t('signDate')}</span><Input type="date" value={f.sign_date} onChange={e => setF({ ...f, sign_date: e.target.value })} className="h-9" /></label>
            <label className="space-y-1"><span className="text-xs text-gray-500">{t('startDate')}</span><Input type="date" value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} className="h-9" /></label>
            <label className="space-y-1"><span className="text-xs text-gray-500">{t('endDate')}</span><Input type="date" value={f.end_date} onChange={e => setF({ ...f, end_date: e.target.value })} className="h-9" /></label>
          </div>
          <input ref={fileRef} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)} />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />{file ? file.name : t('signedContractFile')}</Button>
            <Button size="sm" className="ml-auto" onClick={add} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}</Button>
          </div>
        </div>
      )}
      {contracts.length === 0 ? <p className="text-xs text-gray-400">{t('noContracts')}</p>
        : <div className="grid gap-1">{contracts.map(c => (
          <div key={c.id} className="flex items-center gap-2 text-sm border-b last:border-0 py-1.5">
            <span className="font-medium">{c.contract_no || t('noContractNo')}</span>
            <span className="text-xs text-gray-400">{c.sign_date ?? ''}{c.start_date ? ` ${c.start_date}~${c.end_date ?? ''}` : ''}</span>
            {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="text-primary ml-auto"><ExternalLink className="h-4 w-4" /></a>}
            <button onClick={() => remove(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
          </div>))}</div>}
    </Card>
  )
}
