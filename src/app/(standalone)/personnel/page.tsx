'use client'

import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import Link from 'next/link'
import { Users, ArrowLeft, Loader2, AlertCircle, Search, FileText, Upload, Trash2, ExternalLink, Save, Building2, CheckCircle2, XCircle, DollarSign, Bell, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ExcelImportModal } from '@/components/common/ExcelImportModal'
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

const CATEGORY_LABEL: Record<string, string> = { recruit: '勞動', insurance: '保險', tax: '所得稅' }
const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('zh-TW')

interface PersonLite { id: string; name: string; position: string; store: string; staff_category: string; stage: string; hired_employee_id: string | null; doc_missing: number; doc_total: number }
interface DocSpec { type: string; label: string; copy: string; categories: string[] }
interface DocRow { id: string; doc_type: string; label: string; file_name: string; url: string; uploaded_at: string }
interface Checklist { doc_key: string; original_received: boolean; copy_received: boolean; note: string }
interface Contract { id: string; contract_no: string; sign_date: string | null; start_date: string | null; end_date: string | null; file_name: string; url: string; note: string }
interface Employee { base_salary: number; hourly_rate: number; employment_type: string; insurance_required: boolean; insurance_status: string; insurance_salary: number; attendance_no: string; bank_name: string; bank_account: string; department: string; position: string }
interface Payroll { year: number; month: number; base_salary: number; allowances: number; deductions: number; bonus: number; net_pay: number; status: string }
interface Person { id: string; name: string; gender: string; native_place: string; birthday: string | null; id_number: string; education: string; email: string; company_email: string; zalo_user_id: string; payroll_no: string; position: string; store: string; staff_category: string; address: string; phone: string; apply_token: string; profile_text: string; hired_employee_id?: string | null }

export default function PersonnelPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => { fetch('/api/hr/personnel').then(r => setIsAdmin(r.status !== 403)) }, [])
  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅管理者可使用人員資料</p></div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">人員資料</h1>
          <p className="text-sm text-gray-500">基本資料、文件、薪資獎金與勞動合同</p>
        </div>
        <div className="ml-auto"><Link href="/hr"><Button variant="outline" size="sm" className="gap-1.5"><Building2 className="h-4 w-4" />人事管理</Button></Link></div>
      </div>
      {selected ? <PersonDetail id={selected} onBack={() => setSelected(null)} /> : <PeopleList onOpen={setSelected} />}
    </div>
  )
}

function PeopleList({ onOpen }: { onOpen: (id: string) => void }) {
  const [people, setPeople] = useState<PersonLite[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [tick, setTick] = useState(0)

  const reload = () => setTick(t => t + 1)

  const removePerson = async (p: PersonLite) => {
    const isHired = !!p.hired_employee_id
    const promptMsg = isHired
      ? `確定刪除「${p.name || '此人員'}」？\n此人員已轉為正式員工，刪除將清除應徵與相關人事文件紀錄。`
      : `確定刪除應徵者「${p.name || '此名單'}」？\n此動作將徹底刪除其應徵資料、文件紀錄，無法復原。`
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
      alert(d.error ?? '刪除失敗')
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
        <div className="relative flex-1 min-w-[200px]"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋姓名或門市…" className="pl-9" /></div>
        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setShowImport(true)}>
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          批次匯入 (Excel/CSV)
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

      {filtered.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">無人員資料</div>
        : <div className="grid gap-2">{filtered.map(p => (
          <div key={p.id} className="flex items-center gap-2">
            <button onClick={() => onOpen(p.id)} className="text-left flex-1 min-w-0">
              <Card className="p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name || '（未命名）'}</span>
                    <span className="text-xs text-gray-400">{p.position}{p.store ? `・${p.store}` : ''}</span>
                    <span className={`text-[11px] px-1.5 rounded ${!p.hired_employee_id ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                      {p.staff_category === 'parttime' ? '兼職' : p.staff_category === 'fulltime' ? '正職' : p.hired_employee_id ? '在職' : '應徵中'}
                    </span>
                  </div>
                </div>
                {p.doc_missing > 0
                  ? <span className="text-xs text-amber-600 shrink-0">缺件 {p.doc_missing}/{p.doc_total}</span>
                  : <span className="text-xs text-emerald-600 shrink-0 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />文件齊</span>}
              </Card>
            </button>
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-10 w-10 p-0 shrink-0"
              title="刪除此名單"
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
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const run = async () => {
    setBusy(true); setMsg('')
    const res = await fetch('/api/hr/doc-reminders', { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    setMsg(res.ok ? `已通知 ${d.notified ?? 0} 人；紙本待收 ${d.hr_pending ?? 0}` : (d.error ?? '失敗'))
  }
  return (
    <div className="flex items-center gap-2 shrink-0">
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
      <Button size="sm" variant="outline" className="gap-1.5" onClick={run} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}寄缺件提醒</Button>
    </div>
  )
}

function PersonDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<{ person: Person; documents: DocRow[]; checklist: Checklist[]; contracts: Contract[]; employee: Employee | null; payroll: Payroll[]; evaluations: unknown[]; catalog: DocSpec[] } | null>(null)
  const [tick, setTick] = useState(0)
  const [form, setForm] = useState<Partial<Person>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch(`/api/hr/personnel?id=${id}`).then(r => r.ok ? r.json() : null).then(d => { if (d) { setData(d); setForm(d.person) } })
  }, [id, tick])
  const reload = () => setTick(t => t + 1)

  if (!data) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  const set = (patch: Partial<Person>) => setForm(p => ({ ...p, ...patch }))
  const save = async () => {
    setSaving(true); setMsg('')
    const res = await fetch('/api/hr/personnel', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...form }) })
    setSaving(false); setMsg(res.ok ? '已儲存' : '儲存失敗')
  }

  const removeCurrent = async () => {
    const personName = data?.person?.name || '此人員'
    const isHired = !!data?.person?.hired_employee_id
    const promptMsg = isHired
      ? `確定刪除「${personName}」？\n此人員已轉為正式員工，刪除將清除應徵與相關人事文件紀錄。`
      : `確定刪除應徵者「${personName}」？\n此動作將徹底刪除其應徵資料、文件紀錄，無法復原。`
    if (!confirm(promptMsg)) return
    setDeleting(true)
    const res = await fetch('/api/hr/personnel', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDeleting(false)
    if (res.ok) {
      alert(`已成功刪除「${personName}」`)
      onBack()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? '刪除失敗')
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
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />返回清單</button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          onClick={removeCurrent}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          刪除名單
        </Button>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-sm">基本資料</h3>
          <div className="flex items-center gap-2">{msg && <span className="text-xs text-gray-500">{msg}</span>}<Button size="sm" onClick={save} disabled={saving} className="gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}儲存</Button></div>
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          {([['姓名', 'name'], ['性別', 'gender'], ['籍貫', 'native_place'], ['生日', 'birthday', 'date'], ['身分證號', 'id_number'], ['學歷', 'education'], ['職務', 'position'], ['門市／單位', 'store'], ['薪資編號', 'payroll_no'], ['出勤編號兼職別', 'staff_category'], ['電話', 'phone'], ['個人 Email', 'email', 'email'], ['公司 Email', 'company_email', 'email'], ['ZALO', 'zalo_user_id'], ['地址', 'address']] as [string, keyof Person, string?][]).map(f => <div key={f[1]}>{F(f)}</div>)}
        </div>
        <p className="text-[11px] text-gray-400">個人連結（應徵起一路一致）：<code>/apply/edit/{data.person.apply_token}</code></p>
      </Card>

      {/* 文件清單 */}
      <Card className="p-4 space-y-2">
        <h3 className="font-semibold text-sm flex items-center gap-1.5"><FileText className="h-4 w-4" />文件清單</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b"><th className="py-1.5 pr-2">文件</th><th className="pr-2">用途</th><th className="pr-2">紙本</th><th className="pr-2 text-center">已上傳</th><th className="pr-2">紙本已收</th><th className="pr-2"></th></tr></thead>
            <tbody>{data.catalog.filter(c => c.type !== 'other').map(spec => {
              const doc = haveDoc.get(spec.type)
              const paper = paperOf.get(spec.type)
              return (
                <tr key={spec.type} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">{spec.label}</td>
                  <td className="pr-2 text-[11px] text-gray-400">{spec.categories.map(c => CATEGORY_LABEL[c] ?? c).join('／')}</td>
                  <td className="pr-2 text-xs text-gray-400">{spec.copy === 'original' ? '正本' : spec.copy === 'both' ? '正+影' : '影本'}</td>
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
          <h3 className="font-semibold text-sm flex items-center gap-1.5"><DollarSign className="h-4 w-4" />薪資獎金</h3>
          <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
            <span>底薪 {fmt(data.employee.base_salary)}</span>
            {data.employee.hourly_rate > 0 && <span>時薪 {fmt(data.employee.hourly_rate)}</span>}
            <span>保險 {data.employee.insurance_required ? `需保（${data.employee.insurance_status || '—'}）` : '免'}</span>
            {data.employee.attendance_no && <span>出勤編號 {data.employee.attendance_no}</span>}
          </div>
          {data.payroll.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b"><th className="py-1 pr-2">月份</th><th className="pr-2 text-right">底薪</th><th className="pr-2 text-right">加給</th><th className="pr-2 text-right">扣款</th><th className="pr-2 text-right">獎金</th><th className="pr-2 text-right">實發</th><th className="pr-2">狀態</th></tr></thead>
                <tbody>{data.payroll.map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1 pr-2">{p.year}/{p.month}</td>
                    <td className="pr-2 text-right tabular-nums">{fmt(p.base_salary)}</td>
                    <td className="pr-2 text-right tabular-nums">{fmt(p.allowances)}</td>
                    <td className="pr-2 text-right tabular-nums text-red-500">{fmt(p.deductions)}</td>
                    <td className="pr-2 text-right tabular-nums text-emerald-600">{fmt(p.bonus)}</td>
                    <td className="pr-2 text-right tabular-nums font-medium">{fmt(p.net_pay)}</td>
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
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const run = async () => {
    setBusy(true); setMsg('')
    const res = await fetch('/api/hr/personnel/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) { setMsg(`已彙整（處理 ${d.used} 份文件）`); onChange() } else setMsg(d.error ?? '失敗')
  }
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-1.5"><FileText className="h-4 w-4 text-indigo-500" />AI 彙整基本資料</h3>
        <div className="flex items-center gap-2">{msg && <span className="text-xs text-gray-500">{msg}</span>}
          <Button size="sm" variant="outline" onClick={run} disabled={busy || !hasDocs} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{profileText ? '重新彙整' : 'AI 彙整'}</Button></div>
      </div>
      {!hasDocs && <p className="text-xs text-gray-400">尚無上傳文件可供彙整。</p>}
      {profileText
        ? <pre className="text-xs text-gray-600 whitespace-pre-wrap max-h-80 overflow-y-auto bg-gray-50 rounded-lg p-3">{profileText}</pre>
        : hasDocs && <p className="text-xs text-gray-400">尚未彙整。點「AI 彙整」讓 AI 讀取已上傳文件，整理成完整基本資料（日後選材可用）。</p>}
    </Card>
  )
}

function ContractSection({ candidateId, contracts, onChange }: { candidateId: string; contracts: Contract[]; onChange: () => void }) {
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
    else alert((await res.json().catch(() => ({}))).error ?? '儲存失敗')
  }
  const remove = async (id: string) => { if (!confirm('刪除此合同？')) return; await fetch('/api/hr/contracts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); onChange() }

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between"><h3 className="font-semibold text-sm">勞動合同</h3><Button size="sm" variant="outline" onClick={() => setAdding(a => !a)}>{adding ? '取消' : '＋新增合同'}</Button></div>
      {adding && (
        <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1"><span className="text-xs text-gray-500">合同編號</span><Input value={f.contract_no} onChange={e => setF({ ...f, contract_no: e.target.value })} className="h-9" /></label>
            <label className="space-y-1"><span className="text-xs text-gray-500">簽署日</span><Input type="date" value={f.sign_date} onChange={e => setF({ ...f, sign_date: e.target.value })} className="h-9" /></label>
            <label className="space-y-1"><span className="text-xs text-gray-500">起始日</span><Input type="date" value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} className="h-9" /></label>
            <label className="space-y-1"><span className="text-xs text-gray-500">到期日</span><Input type="date" value={f.end_date} onChange={e => setF({ ...f, end_date: e.target.value })} className="h-9" /></label>
          </div>
          <input ref={fileRef} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)} />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />{file ? file.name : '簽署合同檔（可選）'}</Button>
            <Button size="sm" className="ml-auto" onClick={add} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '儲存'}</Button>
          </div>
        </div>
      )}
      {contracts.length === 0 ? <p className="text-xs text-gray-400">尚無合同</p>
        : <div className="grid gap-1">{contracts.map(c => (
          <div key={c.id} className="flex items-center gap-2 text-sm border-b last:border-0 py-1.5">
            <span className="font-medium">{c.contract_no || '（無編號）'}</span>
            <span className="text-xs text-gray-400">{c.sign_date ?? ''}{c.start_date ? ` ${c.start_date}~${c.end_date ?? ''}` : ''}</span>
            {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="text-primary ml-auto"><ExternalLink className="h-4 w-4" /></a>}
            <button onClick={() => remove(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
          </div>))}</div>}
    </Card>
  )
}
