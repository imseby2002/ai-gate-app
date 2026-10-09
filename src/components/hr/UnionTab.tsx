'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  Users, Gift, FileText, DollarSign, Plus, Download, CheckCircle2,
  AlertCircle, Loader2, Upload, ExternalLink, ShieldCheck, HeartHandshake
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type SubTab = 'members' | 'benefits' | 'documents' | 'finances'

// 顯示文字在 HrUnion.benefit.* / HrUnion.docCat.*
const BENEFIT_KEYS = ['birthday', 'marriage', 'maternity', 'hospital', 'relief', 'other']
const DOC_CAT_KEYS = ['tuldtt', 'noiquy', 'doitheo', 'committee']

export function UnionTab() {
  const t = useTranslations('HrUnion')
  const [subTab, setSubTab] = useState<SubTab>('members')
  const [members, setMembers] = useState<any[]>([])
  const [benefits, setBenefits] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [finances, setFinances] = useState<any[]>([])
  const [financeSummary, setFinanceSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [loading, setLoading] = useState(false)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [showBenefitModal, setShowBenefitModal] = useState(false)
  const [showDocModal, setShowDocModal] = useState(false)
  const [showFinModal, setShowFinModal] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    if (subTab === 'members') {
      const res = await fetch('/api/hr/union/members')
      if (res.ok) setMembers((await res.json()).members ?? [])
    } else if (subTab === 'benefits') {
      const res = await fetch('/api/hr/union/benefits')
      if (res.ok) setBenefits((await res.json()).benefits ?? [])
    } else if (subTab === 'documents') {
      const res = await fetch('/api/hr/union/documents')
      if (res.ok) setDocuments((await res.json()).documents ?? [])
    } else if (subTab === 'finances') {
      const res = await fetch('/api/hr/union/finances')
      if (res.ok) {
        const d = await res.json()
        setFinances(d.finances ?? [])
        setFinanceSummary(d.summary ?? { income: 0, expense: 0, balance: 0 })
      }
    }
    setLoading(false)
  }, [subTab])

  useEffect(() => { loadData() }, [loadData])

  const exportB14 = async () => {
    const year = new Date().getFullYear()
    window.open(`/api/hr/union/export-b14-b15?year=${year}`, '_blank')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
            <HeartHandshake className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900">{t('title')}</h3>
            <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs text-emerald-700 border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100" onClick={exportB14}>
          <Download className="h-4 w-4" />{t('exportReport')}
        </Button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit text-xs">
        {([
          ['members', t('tabMembers'), <Users key="m" className="h-3.5 w-3.5" />],
          ['benefits', t('tabBenefits'), <Gift key="b" className="h-3.5 w-3.5" />],
          ['documents', t('tabDocs'), <FileText key="d" className="h-3.5 w-3.5" />],
          ['finances', t('tabFinances'), <DollarSign key="f" className="h-3.5 w-3.5" />],
        ] as [SubTab, string, ReactNode][]).map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all"
            style={subTab === id ? { background: 'white', color: '#dc2626', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' } : { color: '#64748b' }}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── SubTab 1: Members ── */}
      {subTab === 'members' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{t('memberCount', { n: members.length })}</span>
            <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs h-8" onClick={() => setShowMemberModal(true)}>
              <Plus className="h-3.5 w-3.5" />{t('addMember')}
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : members.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm border-2 border-dashed rounded-xl">
              {t('noMembers')}
            </div>
          ) : (
            <div className="grid gap-2">
              {members.map(m => (
                <Card key={m.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{m.full_name}</span>
                      <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-medium">{t('cardNo')} {m.union_card_no || '---'}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">{m.store || t('hq')}</span>
                    </div>
                    <div className="text-slate-500 flex gap-4">
                      <span>CCCD: {m.id_number || '---'}</span>
                      <span>{t('bhxh')} {m.bhxh_number || '---'}</span>
                      <span>{t('joinDate')} {m.join_date || '---'}</span>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-semibold">{t('active')}</span>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SubTab 2: Benefits ── */}
      {subTab === 'benefits' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{t('benefitsTitle')}</span>
            <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs h-8" onClick={() => setShowBenefitModal(true)}>
              <Plus className="h-3.5 w-3.5" />{t('requestBenefit')}
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : benefits.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm border-2 border-dashed rounded-xl">
              {t('noBenefits')}
            </div>
          ) : (
            <div className="grid gap-2">
              {benefits.map(b => (
                <Card key={b.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{b.hr_union_members?.full_name || t('member')}</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">{BENEFIT_KEYS.includes(b.benefit_type) ? t(`benefit.${b.benefit_type}`) : b.benefit_type}</span>
                      <span className="font-bold text-red-600">NT$ {Number(b.amount).toLocaleString()} VND</span>
                    </div>
                    <div className="text-slate-500 flex gap-3">
                      <span>{t('requestDate')} {b.request_date}</span>
                      {b.notes && <span>{t('note')} {b.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded font-bold ${b.status === 'disbursed' ? 'bg-emerald-100 text-emerald-800' : b.status === 'approved' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                      {b.status === 'disbursed' ? t('statusPaid') : b.status === 'approved' ? t('statusApproved') : t('statusPending')}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SubTab 3: Documents ── */}
      {subTab === 'documents' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{t('docsTitle')}</span>
            <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs h-8" onClick={() => setShowDocModal(true)}>
              <Plus className="h-3.5 w-3.5" />{t('uploadDoc')}
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : documents.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm border-2 border-dashed rounded-xl">
              {t('noDocs')}
            </div>
          ) : (
            <div className="grid gap-2">
              {documents.map(d => (
                <Card key={d.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{d.title}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">{DOC_CAT_KEYS.includes(d.doc_category) ? t(`docCat.${d.doc_category}`) : d.doc_category}</span>
                    </div>
                    <div className="text-slate-500 flex gap-4">
                      {d.effective_date && <span>{t('effective')} {d.effective_date}</span>}
                      {d.expiry_date && <span>{t('expiry')} {d.expiry_date}</span>}
                      {d.notes && <span>{t('remark')} {d.notes}</span>}
                    </div>
                  </div>
                  {d.url && (
                    <a href={d.url} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-indigo-600">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SubTab 4: Finances ── */}
      {subTab === 'finances' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3.5 bg-emerald-50/70 border-emerald-200">
              <span className="text-xs text-emerald-800 font-medium block">{t('totalIncome')}</span>
              <span className="text-xl font-bold text-emerald-700 mt-1 block">{financeSummary.income.toLocaleString()} VND</span>
            </Card>
            <Card className="p-3.5 bg-red-50/70 border-red-200">
              <span className="text-xs text-red-800 font-medium block">{t('totalExpense')}</span>
              <span className="text-xl font-bold text-red-700 mt-1 block">{financeSummary.expense.toLocaleString()} VND</span>
            </Card>
            <Card className="p-3.5 bg-indigo-50/70 border-indigo-200">
              <span className="text-xs text-indigo-800 font-medium block">{t('balance')}</span>
              <span className="text-xl font-bold text-indigo-700 mt-1 block">{financeSummary.balance.toLocaleString()} VND</span>
            </Card>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{t('ledger')}</span>
            <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs h-8" onClick={() => setShowFinModal(true)}>
              <Plus className="h-3.5 w-3.5" />{t('addEntry')}
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : finances.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm border-2 border-dashed rounded-xl">
              {t('noEntries')}
            </div>
          ) : (
            <div className="grid gap-2">
              {finances.map(f => (
                <Card key={f.id} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${f.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {f.type === 'income' ? '+' : '-'}{Number(f.amount).toLocaleString()} VND
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">{f.description || f.category}</span>
                      {f.voucher_no && <span className="text-slate-400">{t('voucher')} {f.voucher_no}</span>}
                    </div>
                    <span className="text-slate-400 mt-0.5 block">{f.trans_date}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${f.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {f.type === 'income' ? t('income') : t('expense')}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal 1: Add Member ── */}
      {showMemberModal && (
        <MemberModal onClose={() => setShowMemberModal(false)} onSaved={() => { setShowMemberModal(false); loadData() }} />
      )}

      {/* ── Modal 2: Add Benefit ── */}
      {showBenefitModal && (
        <BenefitModal members={members} onClose={() => setShowBenefitModal(false)} onSaved={() => { setShowBenefitModal(false); loadData() }} />
      )}

      {/* ── Modal 3: Add Document ── */}
      {showDocModal && (
        <DocModal onClose={() => setShowDocModal(false)} onSaved={() => { setShowDocModal(false); loadData() }} />
      )}

      {/* ── Modal 4: Add Finance ── */}
      {showFinModal && (
        <FinanceModal onClose={() => setShowFinModal(false)} onSaved={() => { setShowFinModal(false); loadData() }} />
      )}
    </div>
  )
}

function MemberModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('HrUnion')
  const [name, setName] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [bhxh, setBhxh] = useState('')
  const [store, setStore] = useState('')
  const [cardNo, setCardNo] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setBusy(true)
    const res = await fetch('/api/hr/union/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name, id_number: idNumber, bhxh_number: bhxh, store, union_card_no: cardNo }),
    })
    setBusy(false)
    if (res.ok) onSaved()
    else alert(t('saveFailed'))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 shadow-xl border">
        <h3 className="font-bold text-base">{t('addMemberTitle')}</h3>
        <div className="space-y-2 text-xs">
          <label className="block space-y-1">
            <span>{t('employeeNameReq')}</span>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A" />
          </label>
          <label className="block space-y-1">
            <span>{t('idNumber')}</span>
            <Input value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="001099000000" />
          </label>
          <label className="block space-y-1">
            <span>{t('bhxhNumber')}</span>
            <Input value={bhxh} onChange={e => setBhxh(e.target.value)} placeholder="7912345678" />
          </label>
          <label className="block space-y-1">
            <span>{t('storeDept')}</span>
            <Input value={store} onChange={e => setStore(e.target.value)} placeholder="YL" />
          </label>
          <label className="block space-y-1">
            <span>{t('cardNumber')}</span>
            <Input value={cardNo} onChange={e => setCardNo(e.target.value)} placeholder="CD-2026-001" />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button size="sm" onClick={handleSave} disabled={busy || !name.trim()} className="bg-red-600 hover:bg-red-700 text-white">
            {t('confirmSave')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function BenefitModal({ members, onClose, onSaved }: { members: any[]; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('HrUnion')
  const [memberId, setMemberId] = useState('')
  const [type, setType] = useState('birthday')
  const [amount, setAmount] = useState('500000')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSave = async () => {
    if (!memberId) return
    setBusy(true)
    const res = await fetch('/api/hr/union/benefits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, benefit_type: type, amount: Number(amount) || 0, notes }),
    })
    setBusy(false)
    if (res.ok) onSaved()
    else alert(t('requestFailed'))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 shadow-xl border">
        <h3 className="font-bold text-base">{t('requestTitle')}</h3>
        <div className="space-y-2 text-xs">
          <label className="block space-y-1">
            <span>{t('chooseMemberReq')}</span>
            <select value={memberId} onChange={e => setMemberId(e.target.value)} className="w-full h-8 rounded border px-2">
              <option value="">{t('pleaseChoose')}</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name} ({m.store || t('hq')})</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span>{t('benefitTypeReq')}</span>
            <select value={type} onChange={e => setType(e.target.value)} className="w-full h-8 rounded border px-2">
              {BENEFIT_KEYS.map(k => <option key={k} value={k}>{t(`benefit.${k}`)}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span>{t('amountVndReq')}</span>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span>{t('reasonVoucher')}</span>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('reasonPh')} />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button size="sm" onClick={handleSave} disabled={busy || !memberId} className="bg-red-600 hover:bg-red-700 text-white">
            {t('submitRequest')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function DocModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('HrUnion')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('tuldtt')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return
    setBusy(true)
    const fd = new FormData()
    fd.append('title', title)
    fd.append('doc_category', category)
    if (file) fd.append('file', file)
    const res = await fetch('/api/hr/union/documents', { method: 'POST', body: fd })
    setBusy(false)
    if (res.ok) onSaved()
    else alert(t('uploadFailed'))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 shadow-xl border">
        <h3 className="font-bold text-base">{t('uploadDocTitle')}</h3>
        <div className="space-y-2 text-xs">
          <label className="block space-y-1">
            <span>{t('docCategoryReq')}</span>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-8 rounded border px-2">
              {DOC_CAT_KEYS.map(k => <option key={k} value={k}>{t(`docCat.${k}`)}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span>{t('docTitleReq')}</span>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('docTitlePh')} />
          </label>
          <label className="block space-y-1">
            <span>{t('choosePdf')}</span>
            <Input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button size="sm" onClick={handleSave} disabled={busy || !title.trim()} className="bg-red-600 hover:bg-red-700 text-white">
            {t('confirmUpload')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function FinanceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('HrUnion')
  const [type, setType] = useState('income')
  const [category, setCategory] = useState('union_dues')
  const [amount, setAmount] = useState('1000000')
  const [voucherNo, setVoucherNo] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSave = async () => {
    setBusy(true)
    const res = await fetch('/api/hr/union/finances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, category, amount: Number(amount) || 0, voucher_no: voucherNo, description: desc }),
    })
    setBusy(false)
    if (res.ok) onSaved()
    else alert(t('entryFailed'))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 shadow-xl border">
        <h3 className="font-bold text-base">{t('entryTitle')}</h3>
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span>{t('typeReq')}</span>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full h-8 rounded border px-2">
                <option value="income">{t('income')}</option>
                <option value="expense">{t('expense')}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span>{t('amountReq')}</span>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </label>
          </div>
          <label className="block space-y-1">
            <span>{t('itemCode')}</span>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-8 rounded border px-2">
              <option value="union_dues">{t('code1')}</option>
              <option value="employer_contrib">{t('code2')}</option>
              <option value="welfare">{t('code3')}</option>
              <option value="activity">{t('code4')}</option>
              <option value="admin">{t('code5')}</option>
              <option value="other">{t('other')}</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span>{t('receiptNo')}</span>
            <Input value={voucherNo} onChange={e => setVoucherNo(e.target.value)} placeholder="PT-2026-07 / PC-2026-03" />
          </label>
          <label className="block space-y-1">
            <span>{t('summary')}</span>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('summaryPh')} />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button size="sm" onClick={handleSave} disabled={busy || !amount} className="bg-red-600 hover:bg-red-700 text-white">
            {t('confirmEntry')}
          </Button>
        </div>
      </div>
    </div>
  )
}
