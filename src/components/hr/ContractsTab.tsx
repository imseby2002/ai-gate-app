'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { FileText, Plus, Download, Printer, Shield, Clock, CheckCircle2, AlertCircle, Eye, Loader2, Upload, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  type ContractTemplateType,
  TEMPLATE_NAMES,
  generateContractText,
  type ContractVars
} from '@/lib/hr/contract-templates'

interface Employee {
  id: string
  name: string
  position: string
  department: string
  store: string
  base_salary: number
  hourly_rate: number
  id_number: string
  hire_date: string | null
  phone: string
}

interface ContractRecord {
  id: string
  candidate_id?: string
  employee_id?: string
  contract_no: string
  template_type?: ContractTemplateType
  sign_date: string | null
  start_date: string | null
  end_date: string | null
  file_name?: string
  storage_path?: string
  digital_signed?: boolean
  paper_signed?: boolean
  status: string
  note: string
  created_at: string
}

const CONTRACT_TYPE_KEYS: Record<ContractTemplateType, string> = {
  seasonal: 'templateSeasonal',
  one_year: 'templateOneYear',
  indefinite: 'templateIndefinite',
  probation: 'templateProbation',
}

export function ContractsTab({ employees }: { employees: Employee[] }) {
  const t = useTranslations('HrPage')
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [selectedEmp, setSelectedEmp] = useState('')
  const [templateType, setTemplateType] = useState<ContractTemplateType>('one_year')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [salary, setSalary] = useState<number>(0)
  const [busy, setBusy] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [note, setNote] = useState('')

  const loadContracts = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/hr/contracts/list').catch(() => null)
    if (res?.ok) {
      const d = await res.json()
      setContracts(d.contracts ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadContracts() }, [loadContracts])

  // 當選擇員工時自動填入合約變數
  useEffect(() => {
    if (!selectedEmp) return
    const emp = employees.find(e => e.id === selectedEmp)
    if (!emp) return
    const isHourly = templateType === 'seasonal'
    setSalary(isHourly ? (emp.hourly_rate || 25000) : (emp.base_salary || 6500000))
    if (emp.hire_date) setStartDate(emp.hire_date)
    if (templateType === 'one_year') {
      const nextY = new Date()
      nextY.setFullYear(nextY.getFullYear() + 1)
      setEndDate(nextY.toISOString().slice(0, 10))
    } else if (templateType === 'probation') {
      const nextM = new Date()
      nextM.setDate(nextM.getDate() + 30)
      setEndDate(nextM.toISOString().slice(0, 10))
    } else {
      setEndDate('')
    }
  }, [selectedEmp, templateType, employees])

  // 即時預覽合約文字
  const generatePreview = () => {
    const emp = employees.find(e => e.id === selectedEmp)
    const vars: ContractVars = {
      employee_name: emp?.name || 'Nguyễn Văn A',
      id_number: emp?.id_number || '001099000000',
      position: emp?.position || 'Nhân viên',
      store: emp?.store || 'YL',
      salary: salary || 6000000,
      start_date: startDate,
      end_date: endDate || undefined,
      phone: emp?.phone || '',
    }
    const text = generateContractText(templateType, vars)
    setPreviewText(text)
  }

  const handlePrintOrDownload = () => {
    generatePreview()
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Hợp Đồng Lao Động</title>
            <style>
              body { font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; white-space: pre-wrap; }
            </style>
          </head>
          <body>
            ${previewText.replace(/\n/g, '<br/>')}
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const handleSaveContract = async () => {
    if (!selectedEmp) { alert(t('errSelectContractEmployee')); return }
    const emp = employees.find(e => e.id === selectedEmp)
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('employee_id', selectedEmp)
      fd.append('contract_no', `HDLD-${emp?.store || 'HQ'}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)
      fd.append('template_type', templateType)
      fd.append('start_date', startDate)
      if (endDate) fd.append('end_date', endDate)
      fd.append('sign_date', new Date().toISOString().slice(0, 10))
      fd.append('note', note)
      if (uploadFile) fd.append('file', uploadFile)

      const res = await fetch('/api/hr/contracts', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(t('saveFailed'))
      alert(t('contractCreatedAlert'))
      setShowModal(false)
      loadContracts()
    } catch (e: any) {
      alert(e.message)
    }
    setBusy(false)
  }

  // 檢查即將到期合約（30 天內）
  const upcomingRenewals = contracts.filter(c => {
    if (!c.end_date || c.status !== 'active') return false
    const diff = Math.round((new Date(c.end_date).getTime() - Date.now()) / 86400000)
    return diff >= 0 && diff <= 30
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{t('contractsTitle')}</h3>
          <p className="text-xs text-muted-foreground">{t('contractsSubtitle')}</p>
        </div>
        <Button size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => { setShowModal(true); setPreviewText('') }}>
          <Plus className="h-4 w-4" />{t('addContract')}
        </Button>
      </div>

      {/* 到期提醒警告看板 */}
      {upcomingRenewals.length > 0 && (
        <Card className="p-4 bg-amber-50/80 border-amber-200 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <Clock className="h-4 w-4 text-amber-600" />
            <span>{t('renewalReminderTitle', { count: upcomingRenewals.length })}</span>
          </div>
          <div className="grid gap-2 text-xs">
            {upcomingRenewals.map(c => {
              const emp = employees.find(e => e.id === c.employee_id)
              const days = Math.round((new Date(c.end_date!).getTime() - Date.now()) / 86400000)
              return (
                <div key={c.id} className="p-2 bg-white rounded border border-amber-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{emp?.name || t('employeeFallback')}</span>
                    <span className="text-slate-500">[{emp?.store || t('headquartersFallback')}]</span>
                    <span className="text-slate-400">{t('contractNoPrefix', { no: c.contract_no })}</span>
                    <span className="text-slate-400">{t('endDatePrefix', { date: c.end_date ?? '' })}</span>
                  </div>
                  <span className="font-bold text-amber-700">{t('daysRemainingHint', { days })}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* 合同清單 */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-gray-400" /></div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm border-2 border-dashed rounded-xl">
          {t('noContractsYet')}
        </div>
      ) : (
        <div className="grid gap-2.5">
          {contracts.map(c => {
            const emp = employees.find(e => e.id === c.employee_id)
            return (
              <Card key={c.id} className="p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{emp?.name || t('unassigned')}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
                        {c.contract_no}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                        {c.status === 'active' ? t('statusActive') : c.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-4 pt-1">
                      <span><b>{t('effectiveDateLabel')}</b>{c.start_date || '---'}</span>
                      <span><b>{t('contractEndDateColonLabel')}</b>{c.end_date || t('noFixedTerm')}</span>
                      <span><b>{t('signDateLabel')}</b>{c.sign_date || '---'}</span>
                      {c.paper_signed && <span className="text-emerald-600 font-medium">{t('paperSignedBadge')}</span>}
                    </div>
                    {c.note && <div className="text-xs text-slate-400">{t('notePrefix')}{c.note}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="text-xs h-8 gap-1" onClick={handlePrintOrDownload}>
                      <Printer className="h-3.5 w-3.5" />{t('printPreview')}
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* 建立合約 Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg text-slate-900">{t('createContractModalTitle')}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700">{t('selectContractEmployeeLabel')}</span>
                <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="w-full h-9 rounded-lg border px-2 text-sm bg-background">
                  <option value="">{t('pleaseSelect')}</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.store || t('headquartersFallback')} - {e.position})</option>)}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700">{t('templateTypeLabel')}</span>
                <select value={templateType} onChange={e => setTemplateType(e.target.value as ContractTemplateType)} className="w-full h-9 rounded-lg border px-2 text-sm bg-background">
                  {(Object.keys(TEMPLATE_NAMES) as ContractTemplateType[]).map(tt => (
                    <option key={tt} value={tt}>{t(CONTRACT_TYPE_KEYS[tt])}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700">{t('contractStartDateLabel')}</span>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700">{t('contractEndDateLabel')}</span>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} placeholder={t('endDatePlaceholder')} />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700">{t('salaryLabel')}</span>
                <Input type="number" value={salary ? String(salary) : ''} onChange={e => setSalary(Number(e.target.value) || 0)} />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700">{t('uploadSignedScanLabel')}</span>
                <Input type="file" accept=".pdf,.png,.jpg" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
              </label>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="text-xs font-semibold text-slate-700">{t('noteLabel')}</span>
              <Input value={note} onChange={e => setNote(e.target.value)} placeholder={t('contractNotePlaceholder')} />
            </label>

            {/* 合約預覽區塊 */}
            <div className="border rounded-xl p-3 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">{t('previewSectionLabel')}</span>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={generatePreview}>
                  {t('generatePreviewButton')}
                </Button>
              </div>
              <textarea
                value={previewText}
                readOnly
                rows={6}
                placeholder={t('previewPlaceholder')}
                className="w-full p-2 text-xs rounded border font-mono bg-white text-slate-700"
              />
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <Button variant="outline" size="sm" onClick={handlePrintOrDownload} disabled={!selectedEmp} className="gap-1.5">
                <Printer className="h-4 w-4" />{t('printTwoCopiesButton')}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>{t('cancel')}</Button>
                <Button size="sm" onClick={handleSaveContract} disabled={busy || !selectedEmp} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('confirmCreateContractButton')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
