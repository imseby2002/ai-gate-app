'use client'

import { useEffect, useState } from 'react'
import {
  Sparkles, Plus, Clock, DollarSign, Edit2, Trash2,
  CheckCircle2, AlertCircle, X, Image as ImageIcon, Tag
} from 'lucide-react'
import { ReserveService } from '@/lib/reserve/types'
import { DEFAULT_SERVICES } from '@/lib/reserve/mock-data'
import { cn } from '@/lib/utils/cn'

export default function ReserveServicesPage() {
  const [services, setServices] = useState<ReserveService[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<ReserveService | null>(null)

  // Form states
  const [formCategory, setFormCategory] = useState('美膚管理 / 美容')
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formDuration, setFormDuration] = useState(60)
  const [formBuffer, setFormBuffer] = useState(10)
  const [formPrice, setFormPrice] = useState(1500)
  const [formSalePrice, setFormSalePrice] = useState<string>('')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    async function fetchServices() {
      try {
        const res = await fetch('/api/reserve/services')
        const data = await res.json()
        if (data.services) setServices(data.services)
      } catch (e) {
        console.error(e)
        setServices(DEFAULT_SERVICES)
      } finally {
        setLoading(false)
      }
    }
    fetchServices()
  }, [])

  function openAddModal() {
    setEditingService(null)
    setFormCategory('美膚管理 / 美容')
    setFormName('')
    setFormDesc('')
    setFormDuration(60)
    setFormBuffer(10)
    setFormPrice(1500)
    setFormSalePrice('')
    setFormImageUrl('')
    setModalOpen(true)
  }

  function openEditModal(srv: ReserveService) {
    setEditingService(srv)
    setFormCategory(srv.category_name)
    setFormName(srv.name)
    setFormDesc(srv.description || '')
    setFormDuration(srv.duration_minutes)
    setFormBuffer(srv.buffer_minutes || 0)
    setFormPrice(srv.price)
    setFormSalePrice(srv.sale_price ? String(srv.sale_price) : '')
    setFormImageUrl(srv.image_url || '')
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return
    setIsSubmitting(true)

    const payload = {
      category_name: formCategory,
      name: formName,
      description: formDesc || null,
      duration_minutes: Number(formDuration),
      buffer_minutes: Number(formBuffer),
      price: Number(formPrice),
      sale_price: formSalePrice ? Number(formSalePrice) : null,
      image_url: formImageUrl || null,
      is_active: true,
      sort_order: 1,
    }

    try {
      if (editingService) {
        const res = await fetch('/api/reserve/services', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingService.id, ...payload }),
        })
        const data = await res.json()
        if (data.service) {
          setServices(prev => prev.map(s => (s.id === editingService.id ? data.service : s)))
        }
      } else {
        const res = await fetch('/api/reserve/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.service) {
          setServices(prev => [...prev, data.service])
        }
      }
      setModalOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleActive(srv: ReserveService) {
    const updatedStatus = !srv.is_active
    try {
      await fetch('/api/reserve/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: srv.id, is_active: updatedStatus }),
      })
      setServices(prev => prev.map(s => (s.id === srv.id ? { ...s, is_active: updatedStatus } : s)))
    } catch (err) {
      console.error(err)
    }
  }

  // Group services by category
  const categories = Array.from(new Set(services.map(s => s.category_name || '精選服務')))

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-rose-600" />
            服務項目與價目表
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            管理門市各項美業、造型、看診服務項目、施作時長與價格
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-900/20 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> 新增服務項目
        </button>
      </div>

      {/* Services List by Category */}
      <div className="space-y-8">
        {categories.map(cat => {
          const catServices = services.filter(s => (s.category_name || '精選服務') === cat)
          return (
            <div key={cat} className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-200 dark:border-slate-800">
                <Tag className="h-4 w-4 text-rose-500" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{cat}</h2>
                <span className="text-[11px] text-slate-400">({catServices.length} 項服務)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catServices.map(srv => (
                  <div
                    key={srv.id}
                    className={cn(
                      'p-5 rounded-3xl border bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between transition-all relative group',
                      srv.is_active
                        ? 'border-slate-200/80 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-900'
                        : 'border-slate-200/40 opacity-60 bg-slate-50/50'
                    )}
                  >
                    <div>
                      {/* Top status & Category */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full">
                          {srv.category_name}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(srv)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title="編輯"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(srv)}
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full font-bold transition-all',
                              srv.is_active
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            )}
                          >
                            {srv.is_active ? '上架中' : '已下架'}
                          </button>
                        </div>
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug mb-1">
                        {srv.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">
                        {srv.description || '精心安排之專屬頂級護理與造型體驗。'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{srv.duration_minutes} 分鐘</span>
                        {srv.buffer_minutes > 0 && (
                          <span className="text-[10px] text-slate-400">
                            (+{srv.buffer_minutes}m 緩衝)
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        {srv.sale_price ? (
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs text-slate-400 line-through">
                              NT$ {srv.price.toLocaleString()}
                            </span>
                            <span className="text-sm font-extrabold text-rose-600">
                              NT$ {srv.sale_price.toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                            NT$ {srv.price.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-rose-600" />
                {editingService ? '編輯服務項目' : '新增服務項目'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    服務分類 *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="例如：美髮沙龍 / 剪燙造型"
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    服務項目名稱 *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="例如：日系微剪髮 + 深層護髮"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  詳細內容說明
                </label>
                <textarea
                  rows={2}
                  placeholder="說明服務流程、特色、使用產品..."
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    服務時長 (分鐘) *
                  </label>
                  <input
                    required
                    type="number"
                    min="15"
                    step="5"
                    value={formDuration}
                    onChange={e => setFormDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    消毒/清潔緩衝 (分鐘)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={formBuffer}
                    onChange={e => setFormBuffer(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    標準定價 (NT$) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="50"
                    value={formPrice}
                    onChange={e => setFormPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    優惠特價 (選填 NT$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="留空即為無特價"
                    value={formSalePrice}
                    onChange={e => setFormSalePrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  封面圖片網址 (選填)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formImageUrl}
                  onChange={e => setFormImageUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs active:scale-95 transition-all"
              >
                {isSubmitting ? '儲存中...' : '儲存服務項目'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
