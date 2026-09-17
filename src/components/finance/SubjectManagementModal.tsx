'use client'

import { useState } from 'react'
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Check,
  Search,
  FolderPlus,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { SubjectItem } from './SubjectTree'

interface SubjectManagementModalProps {
  open: boolean
  onClose: () => void
  subjects: SubjectItem[]
  onRefresh: () => void
  accountBook?: string
}

export function SubjectManagementModal({
  open,
  onClose,
  subjects,
  onRefresh,
  accountBook = 'FT'
}: SubjectManagementModalProps) {
  const [activeClass, setActiveClass] = useState<'asset' | 'liability' | 'income' | 'expense'>('asset')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<SubjectItem | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Form fields
  const [formData, setFormData] = useState({
    parent_name: '',
    name: '',
    initial_balance: 0,
    sort_order: 0,
    style: '常態性',
    zero_view: true,
    is_account: false,
  })

  if (!open) return null

  const filtered = subjects.filter(s => {
    if (s.class !== activeClass) return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.name.toLowerCase().includes(q) && !s.parent_name.toLowerCase().includes(q)) return false
    }
    return true
  })

  const startAdd = (parentName?: string) => {
    setEditing(null)
    setFormData({
      parent_name: parentName || '',
      name: '',
      initial_balance: 0,
      sort_order: subjects.length + 1,
      style: '常態性',
      zero_view: true,
      is_account: activeClass === 'asset' || activeClass === 'liability',
    })
    setShowAdd(true)
    setErr('')
  }

  const startEdit = (item: SubjectItem) => {
    setEditing(item)
    setFormData({
      parent_name: item.parent_name || '',
      name: item.name,
      initial_balance: item.initial_balance || 0,
      sort_order: item.sort_order || 0,
      style: item.style || '常態性',
      zero_view: item.zero_view !== false,
      is_account: item.is_account,
    })
    setShowAdd(true)
    setErr('')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setErr('請輸入科目名稱')
      return
    }
    setSaving(true)
    setErr('')
    try {
      const payload = {
        id: editing?.id,
        account_book: accountBook,
        class: activeClass,
        parent_name: formData.parent_name.trim() || formData.name.trim(),
        name: formData.name.trim(),
        initial_balance: Number(formData.initial_balance) || 0,
        sort_order: Number(formData.sort_order) || 0,
        style: formData.style,
        zero_view: formData.zero_view,
        is_account: formData.is_account,
      }

      const res = await fetch('/api/fin/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '儲存失敗')

      setShowAdd(false)
      setEditing(null)
      onRefresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`確定要刪除科目「${name}」嗎？若該科目有交易關聯可能影響統計。`)) return
    try {
      const res = await fetch('/api/fin/subjects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error || '刪除失敗')
        return
      }
      onRefresh()
    } catch {
      alert('刪除失敗')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs" onClick={onClose}>
      <Card className="w-full max-w-2xl bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3 shrink-0">
          <div>
            <h3 className="font-bold text-lg">項目科目設定（主檔管理）</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              維護各類別科目之大類（目錄）、明細名稱、期初金額與常態性質。
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 類別切換與操作 */}
        <div className="flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            {(['asset', 'liability', 'income', 'expense'] as const).map(c => {
              const label = c === 'asset' ? '資產' : c === 'liability' ? '負債' : c === 'income' ? '收入' : '支出'
              const count = subjects.filter(s => s.class === c).length
              return (
                <button
                  key={c}
                  onClick={() => { setActiveClass(c); setShowAdd(false); setEditing(null) }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    activeClass === c ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{label}</span>
                  <span className="text-2xs opacity-70 font-mono">({count})</span>
                </button>
              )
            })}
          </div>

          <Button size="sm" onClick={() => startAdd()} className="h-8 text-xs gap-1">
            <Plus className="h-3.5 w-3.5" />
            新增科目
          </Button>
        </div>

        {/* 搜尋列 */}
        <div className="relative shrink-0">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`搜尋${activeClass === 'asset' ? '資產' : activeClass === 'liability' ? '負債' : activeClass === 'income' ? '收入' : '支出'}大類或科目名稱...`}
            className="pl-9 h-8 text-xs"
          />
        </div>

        {/* 新增 / 編輯表單 */}
        {showAdd && (
          <form onSubmit={handleSave} className="p-4 border rounded-xl bg-muted/30 space-y-3 shrink-0">
            <div className="font-semibold text-xs flex items-center justify-between">
              <span>{editing ? `編輯科目：${editing.name}` : `新增${activeClass === 'asset' ? '資產' : activeClass === 'liability' ? '負債' : activeClass === 'income' ? '收入' : '支出'}科目`}</span>
              <button type="button" onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {err && (
              <div className="p-2 rounded bg-destructive/10 text-destructive text-2xs flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{err}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-2xs font-medium text-muted-foreground mb-1">大類名稱 (目錄/父層)</label>
                <Input
                  value={formData.parent_name}
                  onChange={e => setFormData(p => ({ ...p, parent_name: e.target.value }))}
                  placeholder="例如：現金、飲料原料、其它收入"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="block text-2xs font-medium text-muted-foreground mb-1">科目明細名稱 *</label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="例如：保險櫃、奶精、DT VNPAY"
                  required
                  className="h-8 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-2xs font-medium text-muted-foreground mb-1">期初餘額 (NT$)</label>
                <Input
                  type="number"
                  value={formData.initial_balance}
                  onChange={e => setFormData(p => ({ ...p, initial_balance: Number(e.target.value) || 0 }))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-2xs font-medium text-muted-foreground mb-1">性質類型</label>
                <select
                  value={formData.style}
                  onChange={e => setFormData(p => ({ ...p, style: e.target.value }))}
                  className="w-full h-8 px-2 text-xs border rounded-md bg-background"
                >
                  <option value="常態性">常態性</option>
                  <option value="非常態性">非常態性</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)} className="h-7 text-xs">
                取消
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="h-7 text-xs">
                {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                {editing ? '儲存變更' : '新增建置'}
              </Button>
            </div>
          </form>
        )}

        {/* 科目清單列表 */}
        <div className="flex-1 overflow-y-auto border rounded-xl divide-y text-xs font-sans">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">查無符合科目</div>
          ) : (
            filtered.map(item => (
              <div key={item.id} className="p-3 flex items-center justify-between hover:bg-muted/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{item.name}</span>
                    <Badge variant="outline" className="text-2xs">
                      {item.parent_name}
                    </Badge>
                    <Badge variant="secondary" className="text-2xs font-normal">
                      {item.style}
                    </Badge>
                  </div>
                  <div className="text-2xs text-muted-foreground mt-0.5 flex items-center gap-3">
                    <span>期初餘額: <b className="font-mono text-foreground tabular-nums">NT$ {item.initial_balance.toLocaleString('zh-TW')}</b></span>
                    <span>排序: {item.sort_order}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => startEdit(item)}
                    title="編輯"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(item.id, item.name)}
                    title="刪除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t shrink-0">
          <span>共 {filtered.length} 個科目</span>
          <Button size="sm" variant="outline" onClick={onClose}>關閉</Button>
        </div>
      </Card>
    </div>
  )
}
