'use client'

import { useState, useEffect, useCallback, useRef, ReactNode, type ChangeEvent } from 'react'
import Link from 'next/link'
import { Users, DollarSign, Calendar, Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronUp, Loader2, AlertCircle, Building2, Phone, Mail, Briefcase, CreditCard, Zap, Wallet, Upload, Shield, Clock, Download, UserPlus, ArrowRight, ClipboardCheck, Store, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CsvImportPanel, type CsvColumn, type ImportResult } from '@/components/hr/CsvImportPanel'

// ─── Types ───────────────────────────────────────────────────────
type Tab = 'recruitment' | 'employees' | 'evaluation' | 'payroll' | 'attendance' | 'insurance' | 'leave'

interface Employee {
  id: string
  name: string
  email: string
  phone: string
  department: string
  position: string
  employment_type: string
  hire_date: string | null
  base_salary: number
  bank_account: string
  id_number: string
  notes: string
  status: string
  staff_category: string
  insurance_required: boolean
  insurance_status: string
  insurance_number: string
  insurance_salary: number
  hourly_rate: number
  attendance_no: string
  store: string
  bank_name: string
  created_at: string
}

interface InsSettings { insurance_mode: string; insurance_threshold: number; insurance_currency: string }
const DEFAULT_INS_SETTINGS: InsSettings = { insurance_mode: 'threshold', insurance_threshold: 5000000, insurance_currency: 'VND' }

// 建議是否需投保：正職即刻投保；工讀依公司政策（全員 or 月薪超過門檻）
function suggestInsurance(staffCategory: string, monthlySalary: number, s: InsSettings): boolean {
  if (staffCategory === 'fulltime') return true
  if (s.insurance_mode === 'all') return true
  return monthlySalary > s.insurance_threshold
}

const STAFF_CATEGORIES = ['fulltime', 'hourly']
const INS_STATUSES = ['none', 'pending', 'enrolled']
const STAFF_LABEL: Record<string, string> = { fulltime: '正職', hourly: '工讀' }
const INS_STATUS_LABEL: Record<string, string> = { none: '不需投保', pending: '待投保', enrolled: '已投保' }

interface EvalSummary { bonus: number; reward: number; penalty: number }

interface Payroll {
  id: string
  employee_id: string
  year: number
  month: number
  base_salary: number
  allowances: number
  deductions: number
  bonus: number
  net_pay: number
  status: string
  paid_at: string | null
  notes: string
  hr_employees: { name: string; department: string; position: string } | null
}

interface Leave {
  id: string
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  days: number
  reason: string
  status: string
  notes: string
  created_at: string
  hr_employees: { name: string; department: string; position: string } | null
}

// ─── Constants ───────────────────────────────────────────────────
const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'intern']
const EMP_STATUS = ['active', 'inactive', 'resigned']
const LEAVE_TYPES = ['annual', 'sick', 'personal', 'maternity', 'paternity', 'unpaid', 'other']
const LEAVE_STATUS = ['approved', 'pending', 'rejected']
const PAYROLL_STATUS = ['pending', 'paid']

const EMPTY_EMP: Omit<Employee, 'id' | 'created_at'> = {
  name: '', email: '', phone: '', department: '', position: '',
  employment_type: 'full-time', hire_date: null, base_salary: 0,
  bank_account: '', id_number: '', notes: '', status: 'active',
  staff_category: 'fulltime', insurance_required: false, insurance_status: 'none',
  insurance_number: '', insurance_salary: 0,
  hourly_rate: 0, attendance_no: '', store: '', bank_name: '',
}

const LABELS: Record<string, string> = {
  'full-time': '全職', 'part-time': '兼職', 'contract': '約聘', 'intern': '實習',
  'active': '在職', 'inactive': '停職', 'resigned': '離職',
  'annual': '特休', 'sick': '病假', 'personal': '事假', 'maternity': '產假',
  'paternity': '陪產假', 'unpaid': '無薪假', 'other': '其他',
  'approved': '核准', 'pending': '待審', 'rejected': '拒絕',
  'paid': '已發放', 'pending_pay': '待發放',
  'income': '收入', 'expense': '支出',
}

const fmt = (n: number) => n.toLocaleString('zh-TW')
const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleDateString('zh-TW') : '—'

// ─── CSV 批次匯入欄位設定 ─────────────────────────────────────────
const EMP_TYPE_REV: Record<string, string> = { '全職': 'full-time', '兼職': 'part-time', '約聘': 'contract', '實習': 'intern' }
const EMP_STATUS_REV: Record<string, string> = { '在職': 'active', '停職': 'inactive', '離職': 'resigned' }
const toNum = (v: string) => Number(String(v).replace(/[,\s]/g, '')) || 0

const EMP_COLUMNS: CsvColumn[] = [
  { key: 'name', header: '姓名', required: true, example: '王小明' },
  { key: 'email', header: 'Email', example: 'ming@example.com' },
  { key: 'phone', header: '電話', example: '0912345678' },
  { key: 'department', header: '部門', example: '門市' },
  { key: 'position', header: '職稱', example: '店員' },
  { key: 'staff_category', header: '類別', example: '正職', map: v => (v.trim() === '工讀' || v.trim() === 'hourly' ? 'hourly' : 'fulltime') },
  { key: 'employment_type', header: '聘用類型', example: '全職', map: v => EMP_TYPE_REV[v.trim()] ?? (v.trim() || 'full-time') },
  { key: 'hire_date', header: '到職日', example: '2025-01-15', map: v => v.trim() || null },
  { key: 'base_salary', header: '底薪', example: '36000', map: toNum },
  { key: 'hourly_rate', header: '時薪', example: '0', map: toNum },
  { key: 'store', header: '門市', example: '' },
  { key: 'attendance_no', header: '考勤工号', example: '' },
  { key: 'bank_account', header: '銀行帳號', example: '' },
  { key: 'bank_name', header: '收款銀行', example: '' },
  { key: 'id_number', header: '身分證字號', example: '' },
  { key: 'status', header: '狀態', example: '在職', map: v => EMP_STATUS_REV[v.trim()] ?? (v.trim() || 'active') },
  { key: 'notes', header: '備註', example: '' },
]

const PAY_COLUMNS: CsvColumn[] = [
  { key: 'name', header: '員工姓名', required: true, example: '王小明' },
  { key: 'year', header: '年', required: true, example: String(new Date().getFullYear()), map: v => parseInt(v) || 0 },
  { key: 'month', header: '月', required: true, example: String(new Date().getMonth() + 1), map: v => parseInt(v) || 0 },
  { key: 'base_salary', header: '底薪', example: '36000', map: toNum },
  { key: 'allowances', header: '加給', example: '2000', map: toNum },
  { key: 'deductions', header: '扣除', example: '1000', map: toNum },
  { key: 'bonus', header: '獎金', example: '0', map: toNum },
  { key: 'notes', header: '備註', example: '' },
]

async function postBulk(url: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }),
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok) return { inserted: 0, errors: [{ line: 0, reason: d.error ?? `HTTP ${res.status}` }] }
  return { inserted: d.inserted ?? 0, errors: d.errors ?? [] }
}

// ─── Helpers ─────────────────────────────────────────────────────
function StatusBadge({ value, kind }: { value: string; kind: 'emp' | 'leave' | 'payroll' }) {
  const label = LABELS[value] ?? value
  const green = kind === 'emp' ? 'active' : kind === 'leave' ? 'approved' : 'paid'
  const red = kind === 'emp' ? 'resigned' : kind === 'leave' ? 'rejected' : ''
  const variant = value === green ? 'success' : value === red ? 'destructive' : 'secondary'
  return <Badge variant={variant as 'success' | 'destructive' | 'secondary'}>{label}</Badge>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function InputEl({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean
}) {
  return (
    <Input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled} className="h-8 text-sm" />
  )
}

function SelectEl({ value, onChange, options, disabled }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none disabled:opacity-50">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ─── Employee Form ────────────────────────────────────────────────
function EmployeeForm({ initial, onSave, onCancel, saving, settings }: {
  initial: Omit<Employee, 'id' | 'created_at'>
  onSave: (d: Omit<Employee, 'id' | 'created_at'>) => void
  onCancel: () => void
  saving: boolean
  settings: InsSettings
}) {
  const [d, setD] = useState(initial)
  const set = (k: keyof typeof d, v: string | number | boolean | null) => setD(prev => ({ ...prev, [k]: v }))
  const suggested = suggestInsurance(d.staff_category, Number(d.base_salary) || 0, settings)

  return (
    <div className="space-y-3 p-4 rounded-xl border bg-gray-50">
      <div className="grid grid-cols-2 gap-3">
        <Field label="姓名 *"><InputEl value={d.name} onChange={v => set('name', v)} placeholder="王小明" disabled={saving} /></Field>
        <Field label="部門"><InputEl value={d.department} onChange={v => set('department', v)} placeholder="業務部" disabled={saving} /></Field>
        <Field label="職稱"><InputEl value={d.position} onChange={v => set('position', v)} placeholder="業務專員" disabled={saving} /></Field>
        <Field label="類別 *">
          <SelectEl value={d.staff_category} onChange={v => set('staff_category', v)}
            options={STAFF_CATEGORIES.map(t => ({ value: t, label: STAFF_LABEL[t] }))} disabled={saving} />
        </Field>
        <Field label="僱用類型">
          <SelectEl value={d.employment_type} onChange={v => set('employment_type', v)}
            options={EMPLOYMENT_TYPES.map(t => ({ value: t, label: LABELS[t] ?? t }))} disabled={saving} />
        </Field>
        <Field label="電子郵件"><InputEl value={d.email} onChange={v => set('email', v)} type="email" placeholder="email@company.com" disabled={saving} /></Field>
        <Field label="電話"><InputEl value={d.phone} onChange={v => set('phone', v)} placeholder="0912345678" disabled={saving} /></Field>
        <Field label="到職日期"><InputEl value={d.hire_date ?? ''} onChange={v => set('hire_date', v || null)} type="date" disabled={saving} /></Field>
        <Field label="本薪（月）"><InputEl value={d.base_salary} onChange={v => set('base_salary', Number(v) || 0)} type="number" placeholder="45000" disabled={saving} /></Field>
        <Field label={d.staff_category === 'hourly' ? '時薪 ★' : '時薪'}><InputEl value={d.hourly_rate} onChange={v => set('hourly_rate', Number(v) || 0)} type="number" placeholder="工讀計時用" disabled={saving} /></Field>
        <Field label="門市"><InputEl value={d.store} onChange={v => set('store', v)} placeholder="對應考勤門市，如 giang vo" disabled={saving} /></Field>
        <Field label="考勤工号"><InputEl value={d.attendance_no} onChange={v => set('attendance_no', v)} placeholder="考勤機編號" disabled={saving} /></Field>
        <Field label="銀行帳號"><InputEl value={d.bank_account} onChange={v => set('bank_account', v)} placeholder="銀行代碼＋帳號" disabled={saving} /></Field>
        <Field label="收款銀行"><InputEl value={d.bank_name} onChange={v => set('bank_name', v)} placeholder="留空＝預設 TPBank" disabled={saving} /></Field>
        <Field label="身分證字號"><InputEl value={d.id_number} onChange={v => set('id_number', v)} placeholder="A123456789" disabled={saving} /></Field>
        <Field label="在職狀態">
          <SelectEl value={d.status} onChange={v => set('status', v)}
            options={EMP_STATUS.map(s => ({ value: s, label: LABELS[s] ?? s }))} disabled={saving} />
        </Field>
      </div>

      {/* 保險 */}
      <div className="space-y-2 rounded-lg border bg-white p-3 dark:bg-gray-900/40">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm font-medium">
            <input type="checkbox" checked={d.insurance_required} onChange={e => set('insurance_required', e.target.checked)} disabled={saving} className="h-4 w-4" />
            需投保
          </label>
          <span className="text-xs text-gray-500">
            （建議：{suggested ? '需要' : '不需要'}{d.staff_category === 'hourly' && settings.insurance_mode === 'threshold' ? `　工讀月薪 > ${fmt(settings.insurance_threshold)} ${settings.insurance_currency} 才需投保` : d.staff_category === 'fulltime' ? '　正職即刻投保' : ''}）
          </span>
          {d.insurance_required !== suggested && (
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs" disabled={saving}
              onClick={() => set('insurance_required', suggested)}>套用建議</Button>
          )}
        </div>
        {d.insurance_required && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="保險狀態">
              <SelectEl value={d.insurance_status} onChange={v => set('insurance_status', v)}
                options={INS_STATUSES.map(s => ({ value: s, label: INS_STATUS_LABEL[s] }))} disabled={saving} />
            </Field>
            <Field label="保險編號"><InputEl value={d.insurance_number} onChange={v => set('insurance_number', v)} placeholder="社保號" disabled={saving} /></Field>
            <Field label="投保薪資"><InputEl value={d.insurance_salary} onChange={v => set('insurance_salary', Number(v) || 0)} type="number" placeholder="0" disabled={saving} /></Field>
          </div>
        )}
      </div>

      <Field label="備註">
        <textarea value={d.notes} onChange={e => set('notes', e.target.value)} disabled={saving} rows={2}
          placeholder="其他說明..." className="w-full rounded-md border px-3 py-2 text-sm resize-none outline-none disabled:opacity-50" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>取消</Button>
        <Button size="sm" onClick={() => onSave(d)} disabled={!d.name.trim() || saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          儲存
        </Button>
      </div>
    </div>
  )
}

// ─── Payroll Form ─────────────────────────────────────────────────
function PayrollForm({ employees, initial, onSave, onCancel, saving, attHours, evals }: {
  employees: Employee[]
  initial: { employee_id: string; year: number; month: number; base_salary: number; allowances: number; deductions: number; bonus: number; notes: string }
  onSave: (d: typeof initial) => void
  onCancel: () => void
  saving: boolean
  attHours: Record<string, number>
  evals: Record<string, EvalSummary>
}) {
  const [d, setD] = useState(initial)
  const set = (k: keyof typeof d, v: string | number) => setD(prev => ({ ...prev, [k]: v }))
  const net = d.base_salary + d.allowances + d.bonus - d.deductions
  const emp = employees.find(e => e.id === d.employee_id)
  const hours = Math.round((attHours[d.employee_id] ?? 0) * 100) / 100
  const rate = emp?.hourly_rate ?? 0
  const byHours = Math.round(hours * rate)
  const ev = evals[d.employee_id]
  const evNet = ev ? ev.bonus + ev.reward - ev.penalty : 0

  return (
    <div className="space-y-3 p-4 rounded-xl border bg-gray-50">
      <div className="grid grid-cols-2 gap-3">
        <Field label="員工 *">
          <SelectEl value={d.employee_id} onChange={v => {
            const emp = employees.find(e => e.id === v)
            setD(prev => ({ ...prev, employee_id: v, base_salary: emp?.base_salary ?? prev.base_salary }))
          }}
            options={[{ value: '', label: '請選擇員工' }, ...employees.filter(e => e.status === 'active').map(e => ({ value: e.id, label: `${e.name}（${e.department || '無部門'}）` }))]}
            disabled={saving} />
        </Field>
        <Field label="年份 / 月份">
          <div className="flex gap-1">
            <InputEl value={d.year} onChange={v => set('year', Number(v) || 0)} type="number" placeholder="2026" disabled={saving} />
            <SelectEl value={String(d.month)} onChange={v => set('month', Number(v))}
              options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}月` }))}
              disabled={saving} />
          </div>
        </Field>
        <Field label="本薪（元）"><InputEl value={d.base_salary} onChange={v => set('base_salary', Number(v) || 0)} type="number" disabled={saving} /></Field>
        <Field label="補貼（元）"><InputEl value={d.allowances} onChange={v => set('allowances', Number(v) || 0)} type="number" disabled={saving} /></Field>
      </div>

      {d.employee_id && (hours > 0 || rate > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-white px-3 py-2 text-sm dark:bg-gray-900/40">
          <Clock className="h-4 w-4 text-gray-400" />
          <span className="text-gray-600">本月考勤時數 <b className="tabular-nums">{hours}</b>{rate > 0 && <> × 時薪 <b className="tabular-nums">{fmt(rate)}</b> = <b className="tabular-nums text-green-600">{fmt(byHours)}</b></>}</span>
          {rate > 0
            ? <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={saving} onClick={() => set('base_salary', byHours)}>帶入本薪</Button>
            : <span className="text-xs text-amber-600">（此員工未設時薪，請到員工管理填「時薪」）</span>}
        </div>
      )}

      {d.employee_id && ev && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-white px-3 py-2 text-sm dark:bg-gray-900/40">
          <ClipboardCheck className="h-4 w-4 text-gray-400" />
          <span className="text-gray-600">
            評估：獎金 <b className="tabular-nums">{fmt(ev.bonus)}</b>　獎勵 <b className="tabular-nums text-emerald-600">{fmt(ev.reward)}</b>　懲罰 <b className="tabular-nums text-red-500">{fmt(ev.penalty)}</b>　＝ 淨 <b className="tabular-nums">{fmt(evNet)}</b>
          </span>
          <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={saving} onClick={() => set('bonus', evNet)}>帶入評估獎懲</Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="扣款（勞健保等，元）"><InputEl value={d.deductions} onChange={v => set('deductions', Number(v) || 0)} type="number" disabled={saving} /></Field>
        <Field label="獎金（含評估獎懲，元）"><InputEl value={d.bonus} onChange={v => set('bonus', Number(v) || 0)} type="number" disabled={saving} /></Field>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-white border px-4 py-2.5">
        <span className="text-sm font-medium text-gray-600">實發金額</span>
        <span className={`text-lg font-bold ${net < 0 ? 'text-red-600' : 'text-green-600'}`}>NT$ {fmt(net)}</span>
      </div>
      <Field label="備註">
        <textarea value={d.notes} onChange={e => set('notes', e.target.value)} disabled={saving} rows={2}
          placeholder="備註..." className="w-full rounded-md border px-3 py-2 text-sm resize-none outline-none disabled:opacity-50" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>取消</Button>
        <Button size="sm" onClick={() => onSave(d)} disabled={!d.employee_id || !d.year || !d.month || saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          儲存
        </Button>
      </div>
    </div>
  )
}

// ─── Leave Form ───────────────────────────────────────────────────
function LeaveForm({ employees, initial, onSave, onCancel, saving }: {
  employees: Employee[]
  initial: { employee_id: string; leave_type: string; start_date: string; end_date: string; days: number; reason: string; status: string; notes: string }
  onSave: (d: typeof initial) => void
  onCancel: () => void
  saving: boolean
}) {
  const [d, setD] = useState(initial)
  const set = (k: keyof typeof d, v: string | number) => setD(prev => ({ ...prev, [k]: v }))

  return (
    <div className="space-y-3 p-4 rounded-xl border bg-gray-50">
      <div className="grid grid-cols-2 gap-3">
        <Field label="員工 *">
          <SelectEl value={d.employee_id} onChange={v => set('employee_id', v)}
            options={[{ value: '', label: '請選擇員工' }, ...employees.filter(e => e.status === 'active').map(e => ({ value: e.id, label: `${e.name}（${e.department || '無部門'}）` }))]}
            disabled={saving} />
        </Field>
        <Field label="假別">
          <SelectEl value={d.leave_type} onChange={v => set('leave_type', v)}
            options={LEAVE_TYPES.map(t => ({ value: t, label: LABELS[t] ?? t }))} disabled={saving} />
        </Field>
        <Field label="開始日期"><InputEl value={d.start_date} onChange={v => set('start_date', v)} type="date" disabled={saving} /></Field>
        <Field label="結束日期"><InputEl value={d.end_date} onChange={v => set('end_date', v)} type="date" disabled={saving} /></Field>
        <Field label="天數"><InputEl value={d.days} onChange={v => set('days', Number(v) || 0)} type="number" disabled={saving} /></Field>
        <Field label="狀態">
          <SelectEl value={d.status} onChange={v => set('status', v)}
            options={LEAVE_STATUS.map(s => ({ value: s, label: LABELS[s] ?? s }))} disabled={saving} />
        </Field>
      </div>
      <Field label="請假原因">
        <textarea value={d.reason} onChange={e => set('reason', e.target.value)} disabled={saving} rows={2}
          placeholder="請假事由..." className="w-full rounded-md border px-3 py-2 text-sm resize-none outline-none disabled:opacity-50" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>取消</Button>
        <Button size="sm" onClick={() => onSave(d)} disabled={!d.employee_id || !d.start_date || !d.end_date || saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          儲存
        </Button>
      </div>
    </div>
  )
}

// ─── 保險設定面板 ─────────────────────────────────────────────────
function InsuranceSettingsPanel({ settings, onSaved, onClose }: {
  settings: InsSettings
  onSaved: (s: InsSettings) => void
  onClose: () => void
}) {
  const [d, setD] = useState(settings)
  const [saving, setSaving] = useState(false)
  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/hr/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d),
      })
      const j = await res.json()
      if (res.ok && j.settings) onSaved({
        insurance_mode: j.settings.insurance_mode,
        insurance_threshold: Number(j.settings.insurance_threshold) || 0,
        insurance_currency: j.settings.insurance_currency ?? 'VND',
      })
    } finally { setSaving(false) }
  }
  return (
    <div className="space-y-3 rounded-xl border bg-gray-50 p-4 dark:bg-gray-900/40">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Shield className="h-4 w-4" />保險政策</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>
      <p className="text-xs text-gray-500">正職一律即刻投保；此設定決定「工讀」何時需投保。</p>
      <div className="grid grid-cols-3 gap-3">
        <Field label="工讀投保條件">
          <SelectEl value={d.insurance_mode} onChange={v => setD(p => ({ ...p, insurance_mode: v }))}
            options={[{ value: 'threshold', label: '超過門檻才投保' }, { value: 'all', label: '全員投保' }]} disabled={saving} />
        </Field>
        <Field label="門檻金額">
          <InputEl value={d.insurance_threshold} onChange={v => setD(p => ({ ...p, insurance_threshold: Number(v) || 0 }))}
            type="number" disabled={saving || d.insurance_mode === 'all'} />
        </Field>
        <Field label="幣別">
          <InputEl value={d.insurance_currency} onChange={v => setD(p => ({ ...p, insurance_currency: v }))} placeholder="VND" disabled={saving} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>取消</Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}儲存
        </Button>
      </div>
    </div>
  )
}

// ─── Employees Tab ────────────────────────────────────────────────
function EmployeesTab({ employees, loading, onRefresh, settings, onSettingsChange }: {
  employees: Employee[]; loading: boolean; onRefresh: () => void
  settings: InsSettings; onSettingsChange: (s: InsSettings) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [showImport, setShowImport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [exportingIns, setExportingIns] = useState(false)

  async function exportInsurance() {
    setErr(''); setExportingIns(true)
    try {
      const res = await fetch('/api/hr/insurance-export')
      if (!res.ok) { setErr('匯出失敗'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `insurance_application_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch { setErr('匯出失敗') } finally { setExportingIns(false) }
  }

  const save = async (data: Omit<Employee, 'id' | 'created_at'>) => {
    setSaving(true); setErr('')
    try {
      if (editing) {
        await fetch('/api/hr/employees', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...data }) })
      } else {
        await fetch('/api/hr/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      }
      setShowForm(false); setEditing(null); onRefresh()
    } catch { setErr('儲存失敗') } finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('確定刪除此員工？相關薪資與請假記錄也將一併刪除。')) return
    await fetch('/api/hr/employees', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    onRefresh()
  }

  const filtered = statusFilter === 'all' ? employees : employees.filter(e => e.status === statusFilter)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {['all', 'active', 'inactive', 'resigned'].map(s => (
          <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'ghost'} onClick={() => setStatusFilter(s)}>
            {s === 'all' ? `全部 (${employees.length})` : `${LABELS[s] ?? s} (${employees.filter(e => e.status === s).length})`}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowSettings(v => !v)}>
            <Shield className="h-4 w-4" />保險設定
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={exportInsurance} disabled={exportingIns} title="匯出需投保員工名單（保險申請單）">
            {exportingIns ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}保險申請單
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowImport(v => !v)}>
            <Upload className="h-4 w-4" />批次上傳
          </Button>
          <Button size="sm" className="gap-1" onClick={() => { setShowForm(true); setEditing(null) }}>
            <Plus className="h-4 w-4" />新增員工
          </Button>
        </div>
      </div>

      {showSettings && (
        <InsuranceSettingsPanel settings={settings} onSaved={s => { onSettingsChange(s); setShowSettings(false) }} onClose={() => setShowSettings(false)} />
      )}

      {showImport && (
        <CsvImportPanel
          title="批次匯入員工名單（CSV）"
          columns={EMP_COLUMNS}
          templateFilename="員工名單範本.csv"
          submit={rows => postBulk('/api/hr/employees/bulk', rows)}
          onClose={() => setShowImport(false)}
          onDone={onRefresh}
        />
      )}

      {showForm && !editing && (
        <EmployeeForm initial={{ ...EMPTY_EMP }} onSave={save} onCancel={() => setShowForm(false)} saving={saving} settings={settings} />
      )}
      {err && <p className="text-sm text-red-500">{err}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">尚無員工資料</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(emp => (
            <Card key={emp.id} className="overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setExpandedId(expandedId === emp.id ? null : emp.id)} className="text-gray-400 hover:text-gray-600">
                  {expandedId === emp.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{emp.name}</span>
                    {emp.department && <span className="text-xs text-gray-400">{emp.department}</span>}
                    {emp.position && <span className="text-xs text-gray-400">· {emp.position}</span>}
                    <StatusBadge value={emp.status} kind="emp" />
                    <Badge variant={emp.staff_category === 'hourly' ? 'secondary' : 'default'}>{STAFF_LABEL[emp.staff_category] ?? emp.staff_category}</Badge>
                    {emp.insurance_required
                      ? <Badge variant={emp.insurance_status === 'enrolled' ? 'success' : 'destructive'} className="gap-1"><Shield className="h-3 w-3" />{INS_STATUS_LABEL[emp.insurance_status] ?? '待投保'}</Badge>
                      : <Badge variant="secondary" className="text-gray-400">免保</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    {emp.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{emp.email}</span>}
                    {emp.hire_date && <span>到職：{fmtDate(emp.hire_date)}</span>}
                    <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />本薪 NT$ {fmt(emp.base_salary)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditing(emp); setShowForm(false) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => remove(emp.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {editing?.id === emp.id && (
                <div className="px-4 pb-4">
                  <EmployeeForm initial={{ ...emp }} onSave={save} onCancel={() => setEditing(null)} saving={saving} settings={settings} />
                </div>
              )}

              {expandedId === emp.id && !editing && (
                <div className="border-t px-4 py-3 bg-gray-50 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <span className="text-gray-400 flex items-center gap-1"><Phone className="h-3 w-3" />電話</span>
                  <span>{emp.phone || '—'}</span>
                  <span className="text-gray-400 flex items-center gap-1"><CreditCard className="h-3 w-3" />銀行帳號</span>
                  <span>{emp.bank_account || '—'}</span>
                  <span className="text-gray-400">身分證</span>
                  <span>{emp.id_number || '—'}</span>
                  <span className="text-gray-400 flex items-center gap-1"><Shield className="h-3 w-3" />保險</span>
                  <span>{emp.insurance_required ? `${INS_STATUS_LABEL[emp.insurance_status] ?? '待投保'}${emp.insurance_number ? `（${emp.insurance_number}）` : ''}${emp.insurance_salary ? `　投保薪資 ${fmt(emp.insurance_salary)}` : ''}` : '免投保'}</span>
                  {emp.notes && <><span className="text-gray-400">備註</span><span className="whitespace-pre-wrap">{emp.notes}</span></>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Payroll Tab ──────────────────────────────────────────────────
function PayrollTab({ employees, loading: empLoading, onRefresh }: { employees: Employee[]; loading: boolean; onRefresh: () => void }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [payroll, setPayroll] = useState<Payroll[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Payroll | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [attHours, setAttHours] = useState<Record<string, number>>({}) // employee.id → 當月考勤總時數
  const [evals, setEvals] = useState<Record<string, EvalSummary>>({}) // employee.id → 當月評估獎懲

  const load = useCallback(async () => {
    setLoading(true)
    const [pRes, aRes, eRes] = await Promise.all([
      fetch(`/api/hr/payroll?year=${year}&month=${month}`),
      fetch(`/api/hr/attendance?year=${year}&month=${month}`),
      fetch(`/api/hr/evaluations?year=${year}&month=${month}`),
    ])
    const pd = await pRes.json()
    setPayroll(pd.payroll ?? [])
    // 評估表獎懲 → 對應員工
    const ed = await eRes.json()
    const emap: Record<string, EvalSummary> = {}
    for (const ev of (ed.evaluations ?? []) as { employee_id: string; bonus: number; reward_total: number; penalty_total: number }[]) {
      emap[ev.employee_id] = { bonus: Number(ev.bonus) || 0, reward: Number(ev.reward_total) || 0, penalty: Number(ev.penalty_total) || 0 }
    }
    setEvals(emap)
    // 考勤時數 → 對應員工（優先 考勤工号＋門市，否則姓名）
    const ad = await aRes.json()
    const norm = (s: string) => (s ?? '').trim().toLowerCase()
    const map: Record<string, number> = {}
    for (const a of (ad.attendance ?? []) as { store: string; attendance_no: string; name: string; machine_hours: number; adjust_hours: number }[]) {
      const total = (Number(a.machine_hours) || 0) + (Number(a.adjust_hours) || 0)
      const emp = employees.find(e => e.attendance_no && e.attendance_no === a.attendance_no && (!e.store || norm(e.store) === norm(a.store)))
        ?? employees.find(e => norm(e.name) === norm(a.name))
      if (emp) map[emp.id] = (map[emp.id] ?? 0) + total
    }
    setAttHours(map)
    setLoading(false)
  }, [year, month, employees])

  useEffect(() => { load() }, [load])

  const PAYROLL_BLANK = { employee_id: '', year, month, base_salary: 0, allowances: 0, deductions: 0, bonus: 0, notes: '' }

  const save = async (data: typeof PAYROLL_BLANK) => {
    setSaving(true); setErr('')
    try {
      if (editing) {
        await fetch('/api/hr/payroll', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, base_salary: data.base_salary, allowances: data.allowances, deductions: data.deductions, bonus: data.bonus, notes: data.notes }) })
      } else {
        await fetch('/api/hr/payroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      }
      setShowForm(false); setEditing(null); load()
    } catch { setErr('儲存失敗') } finally { setSaving(false) }
  }

  const markPaid = async (id: string) => {
    await fetch('/api/hr/payroll', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'paid' }) })
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('確定刪除此薪資記錄？')) return
    await fetch('/api/hr/payroll', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  async function exportBank() {
    setErr(''); setExporting(true)
    try {
      const res = await fetch(`/api/hr/payroll/bank-export?year=${year}&month=${month}`)
      if (!res.ok) { setErr('匯出失敗'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `TPBank_salary_${year}_${String(month).padStart(2, '0')}.xlsx`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch { setErr('匯出失敗') } finally { setExporting(false) }
  }

  const totalNet = payroll.reduce((s, p) => s + (p.net_pay ?? 0), 0)
  const paidCount = payroll.filter(p => p.status === 'paid').length

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5">
          <span className="text-sm text-gray-500">{year}年</span>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-16 text-sm text-center outline-none bg-transparent" />
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <button key={m} onClick={() => setMonth(m)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${month === m ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {m}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={exportBank} disabled={exporting || payroll.length === 0} title="依 TPBank 範本匯出本月撥款檔">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}銀行撥款檔
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowImport(v => !v)}>
            <Upload className="h-4 w-4" />批次上傳
          </Button>
          <Button size="sm" className="gap-1" onClick={() => { setShowForm(true); setEditing(null) }}>
            <Plus className="h-4 w-4" />新增薪資單
          </Button>
        </div>
      </div>

      {showImport && (
        <CsvImportPanel
          title="批次匯入薪資（CSV）"
          columns={PAY_COLUMNS}
          templateFilename="薪資資料範本.csv"
          submit={rows => postBulk('/api/hr/payroll/bulk', rows)}
          onClose={() => setShowImport(false)}
          onDone={() => { load(); onRefresh() }}
        />
      )}

      {/* Summary */}
      {payroll.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3">
            <p className="text-xs text-gray-500 mb-1">本月薪資人數</p>
            <p className="text-xl font-bold">{payroll.length} 人</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-gray-500 mb-1">總薪資金額</p>
            <p className="text-xl font-bold">NT$ {fmt(totalNet)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-gray-500 mb-1">發放進度</p>
            <p className="text-xl font-bold text-green-600">{paidCount} / {payroll.length}</p>
          </Card>
        </div>
      )}

      {showForm && !editing && (
        <PayrollForm employees={employees} initial={{ ...PAYROLL_BLANK, year, month }} onSave={save} onCancel={() => setShowForm(false)} saving={saving} attHours={attHours} evals={evals} />
      )}
      {err && <p className="text-sm text-red-500">{err}</p>}

      {loading || empLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : payroll.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{year}年{month}月尚無薪資資料</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-400">
                <th className="text-left py-2 pr-4 font-medium">員工</th>
                <th className="text-right py-2 px-3 font-medium">本薪</th>
                <th className="text-right py-2 px-3 font-medium">補貼</th>
                <th className="text-right py-2 px-3 font-medium">扣款</th>
                <th className="text-right py-2 px-3 font-medium">獎金</th>
                <th className="text-right py-2 px-3 font-medium">實發</th>
                <th className="text-center py-2 px-3 font-medium">狀態</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {payroll.map(p => (
                <>
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="py-2.5 pr-4">
                      <div className="font-medium">{p.hr_employees?.name ?? '—'}</div>
                      <div className="text-xs text-gray-400">{p.hr_employees?.department} {p.hr_employees?.position}</div>
                    </td>
                    <td className="text-right py-2.5 px-3 tabular-nums">{fmt(p.base_salary)}</td>
                    <td className="text-right py-2.5 px-3 tabular-nums text-blue-600">{p.allowances > 0 ? `+${fmt(p.allowances)}` : '—'}</td>
                    <td className="text-right py-2.5 px-3 tabular-nums text-red-500">{p.deductions > 0 ? `-${fmt(p.deductions)}` : '—'}</td>
                    <td className="text-right py-2.5 px-3 tabular-nums text-green-600">{p.bonus > 0 ? `+${fmt(p.bonus)}` : '—'}</td>
                    <td className="text-right py-2.5 px-3 tabular-nums font-bold">{fmt(p.net_pay)}</td>
                    <td className="text-center py-2.5 px-3">
                      <StatusBadge value={p.status} kind="payroll" />
                    </td>
                    <td className="py-2.5 pl-2">
                      <div className="flex items-center gap-1">
                        {p.status === 'pending' && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-green-600 hover:text-green-700" onClick={() => markPaid(p.id)}>
                            <Check className="h-3 w-3 mr-1" />發放
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditing(p); setShowForm(false) }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => remove(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {editing?.id === p.id && (
                    <tr key={`${p.id}-edit`}><td colSpan={8} className="pb-3 pt-1">
                      <PayrollForm employees={employees}
                        initial={{ employee_id: p.employee_id, year: p.year, month: p.month, base_salary: p.base_salary, allowances: p.allowances, deductions: p.deductions, bonus: p.bonus, notes: p.notes }}
                        onSave={save} onCancel={() => setEditing(null)} saving={saving} attHours={attHours} evals={evals} />
                    </td></tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Leave Tab ────────────────────────────────────────────────────
function LeaveTab({ employees, loading: empLoading }: { employees: Employee[]; loading: boolean }) {
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Leave | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const url = statusFilter === 'all' ? '/api/hr/leave' : `/api/hr/leave?status=${statusFilter}`
    const res = await fetch(url)
    const d = await res.json()
    setLeaves(d.leaves ?? [])
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const LEAVE_BLANK = { employee_id: '', leave_type: 'annual', start_date: '', end_date: '', days: 1, reason: '', status: 'approved', notes: '' }

  const save = async (data: typeof LEAVE_BLANK) => {
    setSaving(true); setErr('')
    try {
      if (editing) {
        await fetch('/api/hr/leave', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...data }) })
      } else {
        await fetch('/api/hr/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      }
      setShowForm(false); setEditing(null); load()
    } catch { setErr('儲存失敗') } finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('確定刪除此請假記錄？')) return
    await fetch('/api/hr/leave', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch('/api/hr/leave', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    load()
  }

  const pendingCount = leaves.filter(l => l.status === 'pending').length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'pending', 'approved', 'rejected'].map(s => (
          <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'ghost'} onClick={() => setStatusFilter(s)}>
            {s === 'all' ? '全部' : LABELS[s] ?? s}
            {s === 'pending' && pendingCount > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] rounded-full px-1.5">{pendingCount}</span>}
          </Button>
        ))}
        <Button size="sm" className="ml-auto gap-1" onClick={() => { setShowForm(true); setEditing(null) }}>
          <Plus className="h-4 w-4" />新增請假
        </Button>
      </div>

      {showForm && !editing && (
        <LeaveForm employees={employees} initial={{ ...LEAVE_BLANK }} onSave={save} onCancel={() => setShowForm(false)} saving={saving} />
      )}
      {err && <p className="text-sm text-red-500">{err}</p>}

      {loading || empLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : leaves.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">尚無請假記錄</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaves.map(l => (
            <Card key={l.id} className="p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{l.hr_employees?.name ?? '—'}</span>
                    <Badge variant="secondary">{LABELS[l.leave_type] ?? l.leave_type}</Badge>
                    <StatusBadge value={l.status} kind="leave" />
                    <span className="text-xs text-gray-400">{l.days} 天</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {fmtDate(l.start_date)} ~ {fmtDate(l.end_date)}
                    {l.reason && <span className="ml-2 text-gray-500">{l.reason}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {l.status === 'pending' && (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600 hover:text-green-700" onClick={() => updateStatus(l.id, 'approved')} title="核准">
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" onClick={() => updateStatus(l.id, 'rejected')} title="拒絕">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditing(l); setShowForm(false) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => remove(l.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {editing?.id === l.id && (
                <div className="mt-3">
                  <LeaveForm employees={employees}
                    initial={{ employee_id: l.employee_id, leave_type: l.leave_type, start_date: l.start_date, end_date: l.end_date, days: l.days, reason: l.reason, status: l.status, notes: l.notes }}
                    onSave={save} onCancel={() => setEditing(null)} saving={saving} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────
// ─── Attendance Tab（考勤時數）────────────────────────────────────
interface Attendance {
  id: string; store: string; year: number; month: number
  attendance_no: string; name: string; att_type: string
  machine_hours: number; work_days: number; adjust_hours: number; adjust_note: string
}
const hrs = (n: number) => Math.round((Number(n) || 0) * 100) / 100
const attTypeLabel = (t: string) => (t.includes('计时') || t.includes('計時') ? '時薪' : t.includes('正常') ? '正職' : (t || '—'))

function AttendanceTab() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [list, setList] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [store, setStore] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/hr/attendance?year=${year}&month=${month}`)
    const d = await res.json()
    setList((d.attendance ?? []) as Attendance[])
    setLoading(false)
  }, [year, month])
  useEffect(() => { load() }, [load])

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setErr(''); setMsg(''); setImporting(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      if (store.trim()) fd.append('store', store.trim())
      const res = await fetch('/api/hr/attendance/import', { method: 'POST', body: fd })
      const d = await res.json()
      if (!res.ok) { setErr(d.error ?? '匯入失敗'); return }
      setYear(d.year); setMonth(d.month)
      setMsg(`已匯入 ${d.year}年${d.month}月 ${d.imported} 人（門市：${(d.stores ?? []).join('、') || '—'}）`)
      await load()
    } catch (e2) { setErr('匯入失敗：' + String(e2)) } finally { setImporting(false) }
  }

  async function saveAdjust(row: Attendance, adjust_hours: number, adjust_note: string) {
    setList(prev => prev.map(x => x.id === row.id ? { ...x, adjust_hours, adjust_note } : x))
    await fetch('/api/hr/attendance', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, adjust_hours, adjust_note }),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputEl value={year} onChange={v => setYear(parseInt(v) || year)} type="number" />
        <div className="flex gap-0.5">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <button key={m} onClick={() => setMonth(m)}
              className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${month === m ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{m}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <InputEl value={store} onChange={setStore} placeholder="門市（如 YL）" />
          <Button size="sm" className="gap-1" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}上傳考勤 .xls
          </Button>
        </div>
        <input ref={fileRef} type="file" accept=".xls" className="hidden" onChange={onFile} />
      </div>

      <p className="text-xs text-gray-500">
        每個檔案為單一門市：請先填「門市」（與員工資料、POS 一致，如 YL），再選該門市當月考勤機匯出檔（.xls）。系統彙總每人月時數（＝每日實際工作小時數相加）；未填門市才退回用檔案「部门」欄。重複上傳會更新機器時數，手動補登會保留。
      </p>
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      {err && <p className="text-sm text-red-500">{err}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : list.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <Clock className="mx-auto mb-2 h-10 w-10 opacity-30" />
          <p className="text-sm">{year}年{month}月尚無考勤資料，請上傳考勤機 .xls</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500 dark:bg-gray-900/40">
                <th className="px-3 py-2 text-left">門市</th>
                <th className="px-3 py-2 text-left">姓名</th>
                <th className="px-3 py-2 text-left">工号</th>
                <th className="px-3 py-2 text-left">類型</th>
                <th className="px-3 py-2 text-right">天數</th>
                <th className="px-3 py-2 text-right">機器時數</th>
                <th className="px-3 py-2 text-right">補登</th>
                <th className="px-3 py-2 text-right">合計</th>
                <th className="px-3 py-2 text-left">補登備註</th>
              </tr>
            </thead>
            <tbody>
              {list.map(a => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-3 py-2 text-gray-500">{a.store || '—'}</td>
                  <td className="px-3 py-2 font-medium">{a.name || '—'}</td>
                  <td className="px-3 py-2 text-gray-500">{a.attendance_no}</td>
                  <td className="px-3 py-2"><Badge variant="secondary">{attTypeLabel(a.att_type)}</Badge></td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.work_days}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{hrs(a.machine_hours)}</td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" step="0.25" defaultValue={a.adjust_hours}
                      onBlur={e => { const v = Number(e.target.value) || 0; if (v !== a.adjust_hours) saveAdjust(a, v, a.adjust_note) }}
                      className="h-7 w-20 rounded border px-2 text-right text-sm outline-none" />
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{hrs(a.machine_hours + a.adjust_hours)}</td>
                  <td className="px-3 py-2">
                    <input type="text" defaultValue={a.adjust_note} placeholder="忘打卡簽單…"
                      onBlur={e => { if (e.target.value !== a.adjust_note) saveAdjust(a, a.adjust_hours, e.target.value) }}
                      className="h-7 w-full min-w-[8rem] rounded border px-2 text-sm outline-none" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── 應徵管理（招募看板）────────────────────────────────────────
interface Candidate {
  id: string
  name: string
  email: string
  phone: string
  position: string
  source: string
  notes: string
  score: number | null
  store: string
  staff_category: string
  id_number: string
  birthday: string | null
  address: string
  interview_at: string | null
  stage: string
  hired_employee_id: string | null
  apply_token: string | null
  identity_locked: boolean
  docs_submitted_complete: boolean
  notify_channel: string
  created_at: string
}
interface CandDoc { id: string; doc_type: string; label: string; file_name: string; uploaded_at: string; url: string }
interface CheckItem { doc_key: string; original_received: boolean; copy_received: boolean; note: string }
interface HRNotif { id: string; kind: string; title: string; body: string; candidate_id: string | null; is_read: boolean; created_at: string }

// 通知應徵者常用範本
const NOTIFY_TEMPLATES: { label: string; subject: string; message: string }[] = [
  { label: '邀請面試', subject: '面試邀請', message: '您好，我們已收到您的應徵，誠摯邀請您前來面試。請與我們聯繫確認時間。' },
  { label: '錄取可上班', subject: '錄取通知', message: '恭喜您通過面試，歡迎加入！請攜帶所需文件（含正本）至辦公室辦理報到手續。' },
  { label: '請補件', subject: '文件補件通知', message: '您好，您的應徵文件尚有缺漏，請登入您的專屬連結補齊文件，謝謝。' },
]

// 完整文件目錄（與後端 DOC_CATALOG 對齊）
const HR_DOC_CATALOG: { type: string; label: string; copy: string; needOriginal: boolean }[] = [
  { type: 'resume', label: '履歷', copy: '影印本', needOriginal: false },
  { type: 'id_card', label: '身分證', copy: '正本＋影印本', needOriginal: true },
  { type: 'application', label: '求職申請書', copy: '正本', needOriginal: true },
  { type: 'cv', label: 'CV', copy: '影印本', needOriginal: false },
  { type: 'diploma', label: '畢業證／學生證', copy: '影印本', needOriginal: false },
  { type: 'health', label: '健康證明', copy: '正本', needOriginal: true },
  { type: 'birth', label: '出生證明', copy: '影印本', needOriginal: false },
  { type: 'residence', label: '居住證明', copy: '影印本', needOriginal: false },
  { type: 'other', label: '其他', copy: '影印本', needOriginal: false },
]

const CAND_STAGES = ['new', 'screening', 'interview_scheduled', 'interviewed', 'offered', 'hired', 'rejected'] as const
const CAND_STAGE_LABEL: Record<string, string> = {
  new: '新應徵', screening: '篩選中', interview_scheduled: '已排面試',
  interviewed: '已面試', offered: '已錄取', hired: '已轉員工', rejected: '未錄取',
}
const CAND_STAGE_COLOR: Record<string, string> = {
  new: '#3b82f6', screening: '#8b5cf6', interview_scheduled: '#f59e0b',
  interviewed: '#0ea5e9', offered: '#10b981', hired: '#059669', rejected: '#9ca3af',
}

const emptyCandidate = (): Partial<Candidate> => ({
  name: '', email: '', phone: '', position: '', source: '', notes: '',
  store: '', staff_category: '', id_number: '', birthday: '', address: '', interview_at: '', stage: 'new',
})

function RecruitmentTab({ onHired }: { onHired: () => void }) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Candidate> | null>(null)
  const [busy, setBusy] = useState(false)
  const [applyCode, setApplyCode] = useState('')
  const [docsFor, setDocsFor] = useState<Candidate | null>(null)
  const [docs, setDocs] = useState<CandDoc[]>([])
  const [checklist, setChecklist] = useState<CheckItem[]>([])
  const [notifs, setNotifs] = useState<HRNotif[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [notifyPrefs, setNotifyPrefs] = useState({ telegram: false, email: false })
  const [notifyTarget, setNotifyTarget] = useState<Candidate | null>(null)
  const [notifyMsg, setNotifyMsg] = useState({ subject: '', message: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/hr/candidates')
    const d = await res.json()
    setCandidates(d.candidates ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const loadNotifs = useCallback(async () => {
    const res = await fetch('/api/hr/notifications')
    if (res.ok) setNotifs((await res.json()).notifications ?? [])
  }, [])
  useEffect(() => { loadNotifs() }, [loadNotifs])

  useEffect(() => {
    fetch('/api/hr/settings').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.settings) setNotifyPrefs({ telegram: !!d.settings.notify_telegram, email: !!d.settings.notify_email })
    })
  }, [])

  const toggleNotifyPref = async (key: 'telegram' | 'email') => {
    const next = { ...notifyPrefs, [key]: !notifyPrefs[key] }
    setNotifyPrefs(next)
    await fetch('/api/hr/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notify_telegram: next.telegram, notify_email: next.email }),
    })
  }

  useEffect(() => {
    fetch('/api/hr/apply-config').then(r => r.ok ? r.json() : null).then(d => { if (d?.code) setApplyCode(d.code) })
  }, [])

  const unreadCount = notifs.filter(n => !n.is_read).length
  const markNotifsRead = async () => {
    await fetch('/api/hr/notifications', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }),
    })
    loadNotifs()
  }

  const openNotify = (c: Candidate) => {
    setNotifyTarget(c)
    setNotifyMsg({ subject: '', message: '' })
  }
  const sendNotify = async () => {
    if (!notifyTarget || !notifyMsg.subject.trim() || !notifyMsg.message.trim()) return
    setBusy(true)
    const res = await fetch('/api/hr/candidates/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: notifyTarget.id, ...notifyMsg }),
    })
    setBusy(false)
    const d = await res.json().catch(() => ({}))
    if (res.ok) { alert(`已透過 ${d.channel === 'zalo' ? 'ZALO' : 'Email'} 送出`); setNotifyTarget(null) }
    else alert(d.error ?? '發送失敗')
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const applyUrl = applyCode ? `${origin}/apply/${applyCode}` : ''
  const copy = (text: string, msg: string) => { navigator.clipboard?.writeText(text); alert(msg) }

  const toggleLock = async (c: Candidate) => {
    await fetch('/api/hr/candidates', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, identity_locked: !c.identity_locked }),
    })
    load()
  }

  const openDocs = async (c: Candidate) => {
    setDocsFor(c); setDocs([]); setChecklist([])
    const res = await fetch(`/api/hr/candidates/checklist?candidate_id=${c.id}`)
    if (res.ok) {
      const d = await res.json()
      setDocs(d.documents ?? [])
      setChecklist(d.checklist ?? [])
    }
  }

  const checkOf = (docKey: string): CheckItem =>
    checklist.find(x => x.doc_key === docKey) ?? { doc_key: docKey, original_received: false, copy_received: false, note: '' }

  const setCheck = async (docKey: string, patch: Partial<CheckItem>) => {
    if (!docsFor) return
    const next = { ...checkOf(docKey), ...patch }
    setChecklist(prev => [...prev.filter(x => x.doc_key !== docKey), next])
    await fetch('/api/hr/candidates/checklist', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_id: docsFor.id, doc_key: docKey, ...patch }),
    })
  }

  const toggleSubmitComplete = async (c: Candidate) => {
    await fetch('/api/hr/candidates', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, docs_submitted_complete: !c.docs_submitted_complete }),
    })
    setDocsFor({ ...c, docs_submitted_complete: !c.docs_submitted_complete })
    load()
  }

  const save = async () => {
    if (!editing?.name?.trim()) return
    setBusy(true)
    const method = editing.id ? 'PATCH' : 'POST'
    const res = await fetch('/api/hr/candidates', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing),
    })
    setBusy(false)
    if (res.ok) { setEditing(null); load() }
    else alert((await res.json()).error ?? '儲存失敗')
  }

  const setStage = async (c: Candidate, stage: string) => {
    await fetch('/api/hr/candidates', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, stage }),
    })
    load()
  }

  const remove = async (c: Candidate) => {
    if (!confirm(`確定刪除應徵者「${c.name}」？`)) return
    await fetch('/api/hr/candidates', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id }),
    })
    load()
  }

  const hire = async (c: Candidate) => {
    if (!confirm(`將「${c.name}」轉為${STAFF_LABEL[c.staff_category] || '（未分類）'}員工？\n請先於編輯視窗選好「錄取分類」。`)) return
    setBusy(true)
    const res = await fetch('/api/hr/candidates/hire', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id }),
    })
    setBusy(false)
    if (res.ok) { load(); onHired() }
    else alert((await res.json()).error ?? '轉員工失敗')
  }

  const byStage = (s: string) => candidates.filter(c => c.stage === s)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">應徵管理</h3>
          <p className="text-sm text-gray-500">應徵 → 面試 → 錄取 → 一鍵轉員工</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNotifs(v => !v)}
            className="relative px-2.5 py-2 rounded-lg border hover:bg-gray-50 text-gray-600">
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{unreadCount}</span>
            )}
          </button>
          <Button size="sm" className="gap-1.5" onClick={() => setEditing(emptyCandidate())}>
            <Plus className="h-4 w-4" />新增應徵者
          </Button>
        </div>
      </div>

      {showNotifs && (
        <div className="rounded-lg border bg-white p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">站內通知</span>
            {unreadCount > 0 && <button onClick={markNotifsRead} className="text-xs text-primary hover:underline">全部標為已讀</button>}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50 rounded-md px-2.5 py-1.5">
            <span className="text-gray-400">同步通知到：</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={notifyPrefs.telegram} onChange={() => toggleNotifyPref('telegram')} />Telegram
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={notifyPrefs.email} onChange={() => toggleNotifyPref('email')} />Email
            </label>
            <span className="text-gray-300 ml-auto">（Token 於客服平台設定）</span>
          </div>
          {notifs.length === 0 ? (
            <p className="text-xs text-gray-400 py-2 text-center">目前沒有通知</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {notifs.map(n => (
                <div key={n.id} className={`text-sm rounded-md px-2.5 py-1.5 ${n.is_read ? 'bg-gray-50' : 'bg-blue-50'}`}>
                  <div className="font-medium">{n.title}</div>
                  <div className="text-xs text-gray-500">{n.body}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {applyUrl && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-sm">
          <span className="text-blue-700 font-medium whitespace-nowrap">公開應徵連結</span>
          <code className="flex-1 truncate text-xs text-blue-900">{applyUrl}</code>
          <button onClick={() => copy(applyUrl, '已複製應徵連結')}
            className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap">複製</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">尚無應徵者，點「新增應徵者」開始</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {CAND_STAGES.map(stage => {
            const list = byStage(stage)
            return (
              <div key={stage} className="flex-shrink-0 w-56 space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: CAND_STAGE_COLOR[stage] }} />
                  <span className="text-sm font-medium">{CAND_STAGE_LABEL[stage]}</span>
                  <span className="text-xs text-gray-400">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.map(c => (
                    <div key={c.id} className="rounded-lg border bg-white p-3 space-y-2 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          {c.position && <div className="text-xs text-gray-500 truncate">{c.position}</div>}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => setEditing({ ...c, birthday: c.birthday ?? '', interview_at: c.interview_at ?? '' })}
                            className="text-gray-400 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => remove(c)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      {c.store && <div className="text-xs text-gray-500">門市：{c.store}</div>}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {c.staff_category && <Badge variant="outline" className="text-[10px]">{STAFF_LABEL[c.staff_category]}</Badge>}
                        <Badge variant="outline" className={`text-[10px] ${c.identity_locked ? 'text-amber-600 border-amber-300' : 'text-gray-400'}`}>
                          {c.identity_locked ? '🔒 已鎖定' : '可修改'}
                        </Badge>
                      </div>
                      {c.phone && <div className="text-xs text-gray-400 flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</div>}

                      {c.docs_submitted_complete && (
                        <div className="text-[10px] text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" />文件繳交完成</div>
                      )}
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        <button onClick={() => openDocs(c)} className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">文件</button>
                        <button onClick={() => openNotify(c)} className="px-1.5 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-700">通知</button>
                        <button onClick={() => toggleLock(c)} className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">
                          {c.identity_locked ? '開放修改' : '鎖定資料'}
                        </button>
                        {c.apply_token && (
                          <button onClick={() => copy(`${origin}/apply/edit/${c.apply_token}`, '已複製應徵者專屬連結')}
                            className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">應徵者連結</button>
                        )}
                      </div>

                      {c.stage !== 'hired' && (
                        <div className="flex flex-wrap gap-1 pt-1 border-t">
                          {CAND_STAGES.filter(s => s !== c.stage && s !== 'hired').map(s => (
                            <button key={s} onClick={() => setStage(c, s)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">
                              {CAND_STAGE_LABEL[s]}
                            </button>
                          ))}
                          <button onClick={() => hire(c)} disabled={busy}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-0.5">
                            <ArrowRight className="h-3 w-3" />轉員工
                          </button>
                        </div>
                      )}
                      {c.stage === 'hired' && <div className="text-[10px] text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" />已建立員工資料</div>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {notifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setNotifyTarget(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">通知 {notifyTarget.name}</h3>
              <button onClick={() => setNotifyTarget(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500">
              將以應徵者設定的方式發送：
              <span className="font-medium text-gray-700">{notifyTarget.notify_channel === 'zalo' ? ' ZALO' : ' Email'}</span>
              {notifyTarget.notify_channel !== 'zalo' && notifyTarget.email ? `（${notifyTarget.email}）` : ''}
            </p>
            <div className="flex flex-wrap gap-1">
              {NOTIFY_TEMPLATES.map(t => (
                <button key={t.label} onClick={() => setNotifyMsg({ subject: t.subject, message: t.message })}
                  className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">{t.label}</button>
              ))}
            </div>
            <Field label="主旨"><Input value={notifyMsg.subject} onChange={e => setNotifyMsg({ ...notifyMsg, subject: e.target.value })} /></Field>
            <Field label="內容">
              <textarea value={notifyMsg.message} onChange={e => setNotifyMsg({ ...notifyMsg, message: e.target.value })}
                className="w-full rounded-md border px-2 py-1.5 text-sm" rows={5} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setNotifyTarget(null)}>取消</Button>
              <Button size="sm" onClick={sendNotify} disabled={busy || !notifyMsg.subject.trim() || !notifyMsg.message.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '發送'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {docsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDocsFor(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{docsFor.name} 的文件與繳交</h3>
              <button onClick={() => setDocsFor(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>

            <label className="flex items-center gap-2 text-sm bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={docsFor.docs_submitted_complete} onChange={() => toggleSubmitComplete(docsFor)} />
              <span className="font-medium text-emerald-700">紙本已全部繳交到辦公室（完成）</span>
            </label>

            <div className="text-xs text-gray-400 flex gap-3 px-1">
              <span>上傳＝掃描檔</span><span>正/影＝紙本收到勾選</span>
            </div>

            <div className="space-y-2">
              {HR_DOC_CATALOG.map(spec => {
                const uploaded = docs.filter(d => d.doc_type === spec.type)
                const chk = checkOf(spec.type)
                return (
                  <div key={spec.type} className="border rounded-lg px-3 py-2 text-sm space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-medium">{spec.label}</span>
                        <span className={`text-[11px] ml-1.5 ${spec.needOriginal ? 'text-amber-600' : 'text-gray-400'}`}>紙本：{spec.copy}</span>
                      </div>
                      {uploaded.length > 0
                        ? <span className="text-[11px] text-emerald-600 whitespace-nowrap flex items-center gap-0.5"><Check className="h-3 w-3" />已上傳 {uploaded.length}</span>
                        : <span className="text-[11px] text-gray-300 whitespace-nowrap">未上傳</span>}
                    </div>
                    {uploaded.map(d => (
                      <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="block text-xs text-primary hover:underline truncate">📎 {d.file_name}</a>
                    ))}
                    <div className="flex items-center gap-3 pt-0.5">
                      {spec.copy.includes('正本') && (
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input type="checkbox" checked={chk.original_received} onChange={e => setCheck(spec.type, { original_received: e.target.checked })} />正本已繳
                        </label>
                      )}
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="checkbox" checked={chk.copy_received} onChange={e => setCheck(spec.type, { copy_received: e.target.checked })} />影印本已繳
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editing.id ? '編輯應徵者' : '新增應徵者'}</h3>
              <button onClick={() => setEditing(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="姓名 *"><Input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="應徵職位"><Input value={editing.position ?? ''} onChange={e => setEditing({ ...editing, position: e.target.value })} /></Field>
              <Field label="電話"><Input value={editing.phone ?? ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} /></Field>
              <Field label="Email"><Input value={editing.email ?? ''} onChange={e => setEditing({ ...editing, email: e.target.value })} /></Field>
              <Field label="門市"><Input value={editing.store ?? ''} onChange={e => setEditing({ ...editing, store: e.target.value })} /></Field>
              <Field label="錄取分類">
                <select value={editing.staff_category ?? ''} onChange={e => setEditing({ ...editing, staff_category: e.target.value })}
                  className="w-full h-9 rounded-md border px-2 text-sm">
                  <option value="">未定</option>
                  <option value="fulltime">正職</option>
                  <option value="hourly">工讀</option>
                </select>
              </Field>
              <Field label="身分證字號"><Input value={editing.id_number ?? ''} onChange={e => setEditing({ ...editing, id_number: e.target.value })} /></Field>
              <Field label="生日"><Input type="date" value={editing.birthday ?? ''} onChange={e => setEditing({ ...editing, birthday: e.target.value })} /></Field>
              <Field label="面試時間"><Input type="datetime-local" value={editing.interview_at ?? ''} onChange={e => setEditing({ ...editing, interview_at: e.target.value })} /></Field>
              <Field label="來源"><Input value={editing.source ?? ''} onChange={e => setEditing({ ...editing, source: e.target.value })} /></Field>
            </div>
            <Field label="地址"><Input value={editing.address ?? ''} onChange={e => setEditing({ ...editing, address: e.target.value })} /></Field>
            <Field label="備註">
              <textarea value={editing.notes ?? ''} onChange={e => setEditing({ ...editing, notes: e.target.value })}
                className="w-full rounded-md border px-2 py-1.5 text-sm" rows={2} />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
              <Button size="sm" onClick={save} disabled={busy || !editing.name?.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '儲存'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 人員評估表（由管理／主管填寫）──────────────────────────
interface EvalItem { kind: 'reward' | 'penalty'; label: string; amount: number }
interface Evaluation {
  id: string; employee_id: string; year: number; month: number
  rating: string; bonus: number; items: EvalItem[]
  reward_total: number; penalty_total: number; notes: string; evaluator: string
}
const RATINGS = ['', '優', '佳', '普', '待改進']

function EvaluationTab({ employees, loading }: { employees: Employee[]; loading: boolean }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [evals, setEvals] = useState<Record<string, Evaluation>>({})
  const [editing, setEditing] = useState<{ emp: Employee; draft: Partial<Evaluation> } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/hr/evaluations?year=${year}&month=${month}`)
    if (!res.ok) return
    const d = await res.json()
    const map: Record<string, Evaluation> = {}
    for (const e of (d.evaluations ?? []) as Evaluation[]) map[e.employee_id] = e
    setEvals(map)
  }, [year, month])
  useEffect(() => { load() }, [load])

  const active = employees.filter(e => e.status === 'active')

  const openEdit = (emp: Employee) => {
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
    else alert((await res.json().catch(() => ({}))).error ?? '儲存失敗')
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
          <h3 className="font-semibold">人員評估表</h3>
          <p className="text-sm text-gray-500">由管理／主管填寫；獎金、獎勵、懲罰將帶入薪資彙整</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">
            {[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y} 年</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m} 月</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : active.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">尚無在職員工</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-2">姓名</th><th className="pr-2">門市</th><th className="pr-2">評等</th>
                <th className="pr-2 text-right">獎金</th><th className="pr-2 text-right">獎勵</th>
                <th className="pr-2 text-right">懲罰</th><th className="pr-2 text-right">淨獎懲</th><th></th>
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
                    <td className="pr-2 text-right">{ev ? fmt(Number(ev.bonus)) : '—'}</td>
                    <td className="pr-2 text-right text-emerald-600">{ev ? fmt(Number(ev.reward_total)) : '—'}</td>
                    <td className="pr-2 text-right text-red-500">{ev ? fmt(Number(ev.penalty_total)) : '—'}</td>
                    <td className="pr-2 text-right font-semibold">{ev ? fmt(net) : '—'}</td>
                    <td className="text-right">
                      <button onClick={() => openEdit(emp)} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">
                        {ev ? '編輯' : '填寫'}
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
        const t = draftTotals(editing.draft)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
            <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{editing.emp.name}　{year}/{month} 評估</h3>
                <button onClick={() => setEditing(null)}><X className="h-5 w-5 text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="評等">
                  <select value={editing.draft.rating ?? ''} onChange={e => setDraft({ rating: e.target.value })} className="w-full h-9 rounded-md border px-2 text-sm">
                    {RATINGS.map(r => <option key={r} value={r}>{r || '（未評）'}</option>)}
                  </select>
                </Field>
                <Field label="獎金"><Input type="number" value={String(editing.draft.bonus ?? 0)} onChange={e => setDraft({ bonus: Number(e.target.value) || 0 })} /></Field>
                <Field label="填寫者（主管）"><Input value={editing.draft.evaluator ?? ''} onChange={e => setDraft({ evaluator: e.target.value })} /></Field>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">獎勵／懲罰明細</span>
                  <div className="flex gap-1">
                    <button onClick={() => addItem('reward')} className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">＋獎勵</button>
                    <button onClick={() => addItem('penalty')} className="text-xs px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200">＋懲罰</button>
                  </div>
                </div>
                {(editing.draft.items ?? []).length === 0 && <p className="text-xs text-gray-400">尚無項目</p>}
                {(editing.draft.items ?? []).map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded ${it.kind === 'reward' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      {it.kind === 'reward' ? '獎勵' : '懲罰'}
                    </span>
                    <Input value={it.label} onChange={e => setItem(i, { label: e.target.value })} placeholder="項目說明" />
                    <Input type="number" value={String(it.amount)} onChange={e => setItem(i, { amount: Number(e.target.value) || 0 })} placeholder="金額" />
                    <button onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>

              <Field label="備註">
                <textarea value={editing.draft.notes ?? ''} onChange={e => setDraft({ notes: e.target.value })} className="w-full rounded-md border px-2 py-1.5 text-sm" rows={2} />
              </Field>

              <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-gray-500">獎勵 {fmt(t.reward)}　懲罰 {fmt(t.penalty)}</span>
                <span className="font-semibold">淨獎懲：{fmt(t.net)}</span>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
                <Button size="sm" onClick={saveEdit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '儲存'}</Button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── 保險彙整 ────────────────────────────────────────────────
interface InsRow {
  id: string; name: string; staff_category: string; store: string
  monthly: number; need: boolean; insurance_required: boolean; insurance_status: string
}

function InsuranceTab({ onRefresh }: { onRefresh: () => void }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<InsRow[]>([])
  const [threshold, setThreshold] = useState(5000000)
  const [mode, setMode] = useState('threshold')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/hr/insurance?year=${year}&month=${month}`)
    if (res.ok) {
      const d = await res.json()
      setRows(d.rows ?? []); setThreshold(d.threshold ?? 5000000); setMode(d.mode ?? 'threshold')
    }
    setLoading(false)
  }, [year, month])
  useEffect(() => { load() }, [load])

  const aggregate = async () => {
    setBusy(true)
    const res = await fetch('/api/hr/insurance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year, month }),
    })
    setBusy(false)
    if (res.ok) {
      const d = await res.json()
      alert(d.newly_count > 0 ? `新增 ${d.newly_count} 人需投保：${d.newly.join('、')}，已通知人事。` : '沒有新增需投保人員。')
      load(); onRefresh()
    }
  }

  const setStatus = async (r: InsRow, status: string) => {
    await fetch('/api/hr/employees', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, insurance_status: status, insurance_required: status !== 'none' }),
    })
    load(); onRefresh()
  }

  const exportList = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/hr/insurance-export')
      if (!res.ok) { alert('匯出失敗'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `insurance_application_${year}${String(month).padStart(2, '0')}.xlsx`
      a.click(); URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  const needCount = rows.filter(r => r.need).length
  const gapCount = rows.filter(r => r.need && r.insurance_status !== 'enrolled').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold">保險彙整</h3>
          <p className="text-sm text-gray-500">
            正職一律投保；工讀{mode === 'all' ? '（全員投保）' : `當月薪資 > ${fmt(threshold)} 才需投保`}。依當月薪資自動判定。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">
            {[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y} 年</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m} 月</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" className="gap-1.5" onClick={aggregate} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}依當月薪資重新彙整
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={exportList} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}匯出保險申請名單
        </Button>
        <span className="text-sm text-gray-500 ml-1">需投保 <b>{needCount}</b> 人，待處理 <b className="text-amber-600">{gapCount}</b> 人</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">尚無在職員工</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-2">姓名</th><th className="pr-2">類別</th><th className="pr-2">門市</th>
                <th className="pr-2 text-right">當月薪資</th><th className="pr-2 text-center">判定</th>
                <th className="pr-2 text-center">投保狀態</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-2 font-medium">{r.name}</td>
                  <td className="pr-2">{STAFF_LABEL[r.staff_category] ?? r.staff_category}</td>
                  <td className="pr-2 text-gray-500">{r.store || '—'}</td>
                  <td className="pr-2 text-right tabular-nums">{fmt(r.monthly)}</td>
                  <td className="pr-2 text-center">
                    {r.need ? <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">需投保</Badge>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="pr-2 text-center">
                    <select value={r.insurance_status || 'none'} onChange={e => setStatus(r, e.target.value)}
                      className="h-8 rounded-md border px-1.5 text-xs">
                      {INS_STATUSES.map(s => <option key={s} value={s}>{INS_STATUS_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td className="text-right">
                    {r.need && r.insurance_status !== 'enrolled' && (
                      <button onClick={() => setStatus(r, 'enrolled')} className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">標記已投保</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function HRPage() {
  const [tab, setTab] = useState<Tab>('recruitment')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [empLoading, setEmpLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [settings, setSettings] = useState<InsSettings>(DEFAULT_INS_SETTINGS)

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/hr/settings')
    if (!res.ok) return
    const d = await res.json()
    if (d.settings) setSettings({
      insurance_mode: d.settings.insurance_mode ?? 'threshold',
      insurance_threshold: Number(d.settings.insurance_threshold) || 0,
      insurance_currency: d.settings.insurance_currency ?? 'VND',
    })
  }, [])
  useEffect(() => { loadSettings() }, [loadSettings])

  const loadEmployees = useCallback(async () => {
    setEmpLoading(true)
    const res = await fetch('/api/hr/employees')
    if (res.status === 403) { setIsAdmin(false); setEmpLoading(false); return }
    setIsAdmin(true)
    const d = await res.json()
    setEmployees(d.employees ?? [])
    setEmpLoading(false)
  }, [])

  useEffect(() => { loadEmployees() }, [loadEmployees])

  const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'recruitment', label: '應徵管理', icon: <UserPlus className="h-4 w-4" /> },
    { id: 'employees', label: '員工管理', icon: <Users className="h-4 w-4" /> },
    { id: 'evaluation', label: '人員評估', icon: <ClipboardCheck className="h-4 w-4" /> },
    { id: 'payroll',   label: '薪資管理', icon: <DollarSign className="h-4 w-4" /> },
    { id: 'attendance', label: '考勤時數', icon: <Clock className="h-4 w-4" /> },
    { id: 'insurance', label: '保險', icon: <Shield className="h-4 w-4" /> },
    { id: 'leave',     label: '請假記錄', icon: <Calendar className="h-4 w-4" /> },
  ]

  if (isAdmin === false) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center space-y-2">
          <AlertCircle className="h-12 w-12 mx-auto text-amber-400" />
          <p className="font-semibold">僅管理者可使用人事管理功能</p>
          <p className="text-sm text-gray-400">請以管理者帳號登入後再試</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">人事管理</h1>
          <p className="text-sm text-gray-500">員工資料、薪資計算、請假管理</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-400 mr-1">
            共 <span className="font-semibold text-gray-700">{employees.filter(e => e.status === 'active').length}</span> 名在職員工
          </span>
          <Link href="/store-reports">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Store className="h-4 w-4" />門市報表
            </Button>
          </Link>
          <Link href="/meeting">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Video className="h-4 w-4" />會議紀錄
            </Button>
          </Link>
          <Link href="/finance">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Wallet className="h-4 w-4" />出納總務
            </Button>
          </Link>
          <Link href="/resume">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Zap className="h-4 w-4" />職場工具
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === t.id ? { background: 'white', color: 'var(--primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#6b7280' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <Card className="p-5">
        {tab === 'recruitment' && <RecruitmentTab onHired={loadEmployees} />}
        {tab === 'employees' && <EmployeesTab employees={employees} loading={empLoading} onRefresh={loadEmployees} settings={settings} onSettingsChange={setSettings} />}
        {tab === 'evaluation' && <EvaluationTab employees={employees} loading={empLoading} />}
        {tab === 'payroll'   && <PayrollTab employees={employees} loading={empLoading} onRefresh={loadEmployees} />}
        {tab === 'attendance' && <AttendanceTab />}
        {tab === 'insurance' && <InsuranceTab onRefresh={loadEmployees} />}
        {tab === 'leave'     && <LeaveTab employees={employees} loading={empLoading} />}
      </Card>
    </div>
  )
}
