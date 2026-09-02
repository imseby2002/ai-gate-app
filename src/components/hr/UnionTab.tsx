'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  Users, Gift, FileText, DollarSign, Plus, Download, CheckCircle2,
  AlertCircle, Loader2, Upload, ExternalLink, ShieldCheck, HeartHandshake
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type SubTab = 'members' | 'benefits' | 'documents' | 'finances'

const BENEFIT_LABELS: Record<string, string> = {
  birthday: '生日禮金 (Sinh nhật)',
  marriage: '結婚禮金 (Kết hôn)',
  maternity: '生育津貼 (Sinh con)',
  hospital: '住院慰問 (Nằm viện)',
  relief: '急難救助 (Trợ cấp khó khăn)',
  other: '其他福利 (Khác)',
}

const DOC_CAT_LABELS: Record<string, string> = {
  tuldtt: '集體勞動協議書 (TƯLĐTT)',
  noiquy: '內部工作規章 (Nội quy lao động)',
  doitheo: '法定勞資對話紀錄 (Biên bản đối thoại)',
  committee: '執委會會議與選舉批文 (Đại hội / Quyết định)',
}

export function UnionTab() {
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
            <h3 className="font-bold text-lg text-slate-900">工會系統 (Công đoàn cơ sở)</h3>
            <p className="text-xs text-muted-foreground">符合越南總工會 (Tổng Liên đoàn Lao động) 規範之會員管理、福利慰問、集體協議與財務報表</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs text-emerald-700 border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100" onClick={exportB14}>
          <Download className="h-4 w-4" />匯出總工會財務報表 (Mẫu B14-CĐ & B15-CĐ)
        </Button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit text-xs">
        {([
          ['members', '會員檔案庫 (Đoàn viên)', <Users key="m" className="h-3.5 w-3.5" />],
          ['benefits', '福利與慰問申請 (Chế độ & Thăm hỏi)', <Gift key="b" className="h-3.5 w-3.5" />],
          ['documents', '集體協議與勞資對話 (TƯLĐTT & Đối thoại)', <FileText key="d" className="h-3.5 w-3.5" />],
          ['finances', '工會財務收支 (Tài chính Công đoàn)', <DollarSign key="f" className="h-3.5 w-3.5" />],
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
            <span className="text-xs text-slate-500">共 {members.length} 名工會會員</span>
            <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs h-8" onClick={() => setShowMemberModal(true)}>
              <Plus className="h-3.5 w-3.5" />新增工會會員
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : members.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm border-2 border-dashed rounded-xl">
              尚無工會會員資料。點擊右上「新增工會會員」記錄加入申請。
            </div>
          ) : (
            <div className="grid gap-2">
              {members.map(m => (
                <Card key={m.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{m.full_name}</span>
                      <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-medium">卡號: {m.union_card_no || '---'}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">{m.store || '總部'}</span>
                    </div>
                    <div className="text-slate-500 flex gap-4">
                      <span>CCCD: {m.id_number || '---'}</span>
                      <span>社保號 BHXH: {m.bhxh_number || '---'}</span>
                      <span>入會日期: {m.join_date || '---'}</span>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-semibold">在會 (Đoàn viên)</span>
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
            <span className="text-xs text-slate-500">法定福利發放與慰問簽核</span>
            <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs h-8" onClick={() => setShowBenefitModal(true)}>
              <Plus className="h-3.5 w-3.5" />申請福利／慰問金
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : benefits.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm border-2 border-dashed rounded-xl">
              目前尚無慰問金申請記錄。支援生日、結婚、生育、住院、急難救助線上申請與簽核。
            </div>
          ) : (
            <div className="grid gap-2">
              {benefits.map(b => (
                <Card key={b.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{b.hr_union_members?.full_name || '會員'}</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">{BENEFIT_LABELS[b.benefit_type] || b.benefit_type}</span>
                      <span className="font-bold text-red-600">NT$ {Number(b.amount).toLocaleString()} VND</span>
                    </div>
                    <div className="text-slate-500 flex gap-3">
                      <span>申請日: {b.request_date}</span>
                      {b.notes && <span>說明: {b.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded font-bold ${b.status === 'disbursed' ? 'bg-emerald-100 text-emerald-800' : b.status === 'approved' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                      {b.status === 'disbursed' ? '✓ 已撥款 (Đã chi)' : b.status === 'approved' ? '已核准待發 (Đã duyệt)' : '待審核 (Chờ duyệt)'}
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
            <span className="text-xs text-slate-500">集體勞動協議書 (TƯLĐTT) 及每季法定勞資對話會議紀錄</span>
            <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs h-8" onClick={() => setShowDocModal(true)}>
              <Plus className="h-3.5 w-3.5" />上傳協議／會議紀錄
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : documents.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm border-2 border-dashed rounded-xl">
              目前尚未歸檔集體協議與勞資對話文件。支援上傳經官方核准戳印之 PDF 永久存檔。
            </div>
          ) : (
            <div className="grid gap-2">
              {documents.map(d => (
                <Card key={d.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{d.title}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">{DOC_CAT_LABELS[d.doc_category] || d.doc_category}</span>
                    </div>
                    <div className="text-slate-500 flex gap-4">
                      {d.effective_date && <span>生效日: {d.effective_date}</span>}
                      {d.expiry_date && <span>到期日: {d.expiry_date}</span>}
                      {d.notes && <span>備註: {d.notes}</span>}
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
              <span className="text-xs text-emerald-800 font-medium block">總收入 (Thu đoàn phí 1% & kinh phí 2%)</span>
              <span className="text-xl font-bold text-emerald-700 mt-1 block">{financeSummary.income.toLocaleString()} VND</span>
            </Card>
            <Card className="p-3.5 bg-red-50/70 border-red-200">
              <span className="text-xs text-red-800 font-medium block">總支出 (Chi thăm hỏi, phong trào)</span>
              <span className="text-xl font-bold text-red-700 mt-1 block">{financeSummary.expense.toLocaleString()} VND</span>
            </Card>
            <Card className="p-3.5 bg-indigo-50/70 border-indigo-200">
              <span className="text-xs text-indigo-800 font-medium block">工會結餘 (Kết dư tài chính)</span>
              <span className="text-xl font-bold text-indigo-700 mt-1 block">{financeSummary.balance.toLocaleString()} VND</span>
            </Card>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">財務流水帳明細</span>
            <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs h-8" onClick={() => setShowFinModal(true)}>
              <Plus className="h-3.5 w-3.5" />記帳（收入／支出）
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : finances.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm border-2 border-dashed rounded-xl">
              尚無工會收支流水。點擊右上「記帳」新增收入或慰問支出。
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
                      {f.voucher_no && <span className="text-slate-400">憑證: {f.voucher_no}</span>}
                    </div>
                    <span className="text-slate-400 mt-0.5 block">{f.trans_date}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${f.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {f.type === 'income' ? '收入 (Thu)' : '支出 (Chi)'}
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
    else alert('儲存失敗')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 shadow-xl border">
        <h3 className="font-bold text-base">新增工會會員 (Đoàn viên)</h3>
        <div className="space-y-2 text-xs">
          <label className="block space-y-1">
            <span>員工姓名 *</span>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A" />
          </label>
          <label className="block space-y-1">
            <span>身分證號 (CCCD)</span>
            <Input value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="001099000000" />
          </label>
          <label className="block space-y-1">
            <span>社保號碼 (Mã số BHXH)</span>
            <Input value={bhxh} onChange={e => setBhxh(e.target.value)} placeholder="7912345678" />
          </label>
          <label className="block space-y-1">
            <span>任職門市 / 部門</span>
            <Input value={store} onChange={e => setStore(e.target.value)} placeholder="YL" />
          </label>
          <label className="block space-y-1">
            <span>工會會員卡號 (Số thẻ đoàn viên)</span>
            <Input value={cardNo} onChange={e => setCardNo(e.target.value)} placeholder="CD-2026-001" />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={handleSave} disabled={busy || !name.trim()} className="bg-red-600 hover:bg-red-700 text-white">
            確認儲存
          </Button>
        </div>
      </div>
    </div>
  )
}

function BenefitModal({ members, onClose, onSaved }: { members: any[]; onClose: () => void; onSaved: () => void }) {
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
    else alert('申請失敗')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 shadow-xl border">
        <h3 className="font-bold text-base">申請工會福利／慰問金 (Chế độ & Thăm hỏi)</h3>
        <div className="space-y-2 text-xs">
          <label className="block space-y-1">
            <span>選擇會員 *</span>
            <select value={memberId} onChange={e => setMemberId(e.target.value)} className="w-full h-8 rounded border px-2">
              <option value="">— 請選擇 —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name} ({m.store || '總部'})</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span>福利種類 *</span>
            <select value={type} onChange={e => setType(e.target.value)} className="w-full h-8 rounded border px-2">
              {Object.entries(BENEFIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span>慰問金額 (VND) *</span>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span>事由說明 / 憑證號</span>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="如：出院證明書備查、結婚賀禮" />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={handleSave} disabled={busy || !memberId} className="bg-red-600 hover:bg-red-700 text-white">
            送出申請
          </Button>
        </div>
      </div>
    </div>
  )
}

function DocModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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
    else alert('上傳失敗')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 shadow-xl border">
        <h3 className="font-bold text-base">上傳集體協議與會議紀錄 (TƯLĐTT)</h3>
        <div className="space-y-2 text-xs">
          <label className="block space-y-1">
            <span>文件分類 *</span>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-8 rounded border px-2">
              {Object.entries(DOC_CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span>文件標題 *</span>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="如：集體勞動協議書 2026-2028 (已蓋聯團戳印)" />
          </label>
          <label className="block space-y-1">
            <span>選擇 PDF 掃描檔</span>
            <Input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={handleSave} disabled={busy || !title.trim()} className="bg-red-600 hover:bg-red-700 text-white">
            確認上傳歸檔
          </Button>
        </div>
      </div>
    </div>
  )
}

function FinanceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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
    else alert('記帳失敗')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 shadow-xl border">
        <h3 className="font-bold text-base">工會財務記帳 (Thu - Chi tài chính)</h3>
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span>類型 *</span>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full h-8 rounded border px-2">
                <option value="income">收入 (Thu)</option>
                <option value="expense">支出 (Chi)</option>
              </select>
            </label>
            <label className="space-y-1">
              <span>金額 (VND) *</span>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </label>
          </div>
          <label className="block space-y-1">
            <span>項目代碼</span>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-8 rounded border px-2">
              <option value="union_dues">1% 會員會費 (Đoàn phí)</option>
              <option value="employer_contrib">2% 企業經費 (Kinh phí công đoàn)</option>
              <option value="welfare">慰問與急難補助 (Thăm hỏi trợ cấp)</option>
              <option value="activity">活動推廣 (Phong trào)</option>
              <option value="admin">行政管理 (Quản lý)</option>
              <option value="other">其他</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span>收據 / 憑證號 (Chứng từ)</span>
            <Input value={voucherNo} onChange={e => setVoucherNo(e.target.value)} placeholder="PT-2026-07 / PC-2026-03" />
          </label>
          <label className="block space-y-1">
            <span>說明摘要</span>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="如：提撥7月份工會會費" />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={handleSave} disabled={busy || !amount} className="bg-red-600 hover:bg-red-700 text-white">
            確認記帳
          </Button>
        </div>
      </div>
    </div>
  )
}
