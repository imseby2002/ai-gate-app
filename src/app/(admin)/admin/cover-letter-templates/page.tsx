'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, Save, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const CATEGORIES = [
  { value: 'formal',        label: '傳統正式型' },
  { value: 'creative',      label: '現代創意型' },
  { value: 'career-change', label: '轉職型' },
  { value: 'entry-level',   label: '應屆畢業生型' },
  { value: 'executive',     label: '主管高階型' },
]

interface Template {
  id: string
  name: string
  description: string
  category: string
  content: string
  is_active: boolean
  sort_order: number
}

const EMPTY: Omit<Template, 'id'> = {
  name: '', description: '', category: 'formal', content: '', is_active: true, sort_order: 0,
}

export default function CoverLetterTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Modal state
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<Omit<Template, 'id'> & { id?: string }>(EMPTY)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/cover-letter-templates')
      const data = await res.json()
      setTemplates(Array.isArray(data) ? data : [])
    } catch { setError('載入失敗') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setForm(EMPTY); setModal('add') }
  const openEdit = (t: Template) => { setForm(t); setModal('edit') }
  const closeModal = () => { setModal(null); setError('') }

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) {
      setError('名稱和內容為必填'); return
    }
    setSaving(true); setError('')
    try {
      const isEdit = modal === 'edit'
      const res = await fetch('/api/admin/cover-letter-templates', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      await load(); closeModal()
    } catch (err) { setError(String(err)) }
    finally { setSaving(false) }
  }

  const handleToggle = async (t: Template) => {
    await fetch('/api/admin/cover-letter-templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, is_active: !t.is_active }),
    })
    await load()
  }

  const handleDelete = async (t: Template) => {
    if (!confirm(`確定刪除「${t.name}」？此動作無法還原。`)) return
    await fetch('/api/admin/cover-letter-templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id }),
    })
    await load()
  }

  return (
    <div className="px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">求職信模板管理</h1>
          <p className="text-gray-500 text-sm mt-1">管理 Cover Letter 模板，用戶生成時可選擇套用</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />新增模板
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />載入中…
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-500 font-medium">
                <th className="text-left px-5 py-3">排序</th>
                <th className="text-left px-5 py-3">模板名稱</th>
                <th className="text-left px-5 py-3">類別</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">說明</th>
                <th className="text-center px-5 py-3">狀態</th>
                <th className="text-right px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">尚無模板，點擊「新增模板」開始建立</td></tr>
              ) : templates.map(t => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-400">{t.sort_order}</td>
                  <td className="px-5 py-3 font-medium">{t.name}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
                      {CATEGORIES.find(c => c.value === t.category)?.label ?? t.category}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 hidden md:table-cell max-w-xs truncate">{t.description}</td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => handleToggle(t)} title={t.is_active ? '停用' : '啟用'}>
                      {t.is_active
                        ? <span className="inline-flex items-center gap-1 text-green-600 text-xs"><Eye className="h-3.5 w-3.5" />啟用</span>
                        : <span className="inline-flex items-center gap-1 text-gray-400 text-xs"><EyeOff className="h-3.5 w-3.5" />停用</span>
                      }
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(t)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">{modal === 'add' ? '新增模板' : '編輯模板'}</h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium">模板名稱 <span className="text-red-500">*</span></label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="例如：傳統正式型"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium">類別</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                  >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium">排序</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium">狀態</label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm">啟用（用戶可選用）</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium">說明</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="例如：適用金融、公務、大型企業…"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium">模板內容 <span className="text-red-500">*</span></label>
                <p className="text-xs text-gray-400">使用 [佔位符] 標記待填入的資訊，例如：[您的姓名]、[公司名稱]、[職位名稱]</p>
                <Textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  rows={14}
                  className="resize-y text-sm font-mono leading-relaxed"
                  placeholder="在此輸入模板內容..."
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
              <Button variant="outline" onClick={closeModal}>取消</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {modal === 'add' ? '新增' : '儲存'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
