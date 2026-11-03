'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  UserCheck, Search, Plus, Phone, Mail, Tag,
  Clock, DollarSign, Edit2, Sparkles, X, Heart
} from 'lucide-react'
import { ReserveCustomer } from '@/lib/reserve/types'
import { DEFAULT_CUSTOMERS } from '@/lib/reserve/mock-data'
import { cn } from '@/lib/utils/cn'

export default function ReserveCustomersPage() {
  const [customers, setCustomers] = useState<ReserveCustomer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<ReserveCustomer | null>(null)

  // Form states
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formTags, setFormTags] = useState('')
  const [formPreferences, setFormPreferences] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch('/api/reserve/customers')
        const data = await res.json()
        if (data.customers) setCustomers(data.customers)
      } catch (e) {
        console.error(e)
        setCustomers(DEFAULT_CUSTOMERS)
      } finally {
        setLoading(false)
      }
    }
    loadCustomers()
  }, [])

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers
    const q = searchQuery.toLowerCase()
    return customers.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.tags?.some(t => t.toLowerCase().includes(q))
    )
  }, [customers, searchQuery])

  function openAddModal() {
    setEditingCustomer(null)
    setFormName('')
    setFormPhone('')
    setFormEmail('')
    setFormTags('VIP, 常客')
    setFormPreferences('')
    setModalOpen(true)
  }

  function openEditModal(c: ReserveCustomer) {
    setEditingCustomer(c)
    setFormName(c.name)
    setFormPhone(c.phone)
    setFormEmail(c.email || '')
    setFormTags(c.tags ? c.tags.join(', ') : '')
    setFormPreferences(c.preferences || '')
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim() || !formPhone.trim()) return
    setIsSubmitting(true)

    const tagList = formTags
      .split(/[,，]/)
      .map(t => t.trim())
      .filter(Boolean)

    const payload = {
      name: formName,
      phone: formPhone,
      email: formEmail || null,
      tags: tagList,
      preferences: formPreferences || null,
    }

    try {
      const res = await fetch('/api/reserve/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCustomer ? { id: editingCustomer.id, ...payload } : payload),
      })
      const data = await res.json()
      if (data.customer) {
        setCustomers(prev => {
          const idx = prev.findIndex(c => c.phone === data.customer.phone)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = data.customer
            return next
          }
          return [data.customer, ...prev]
        })
      }
      setModalOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <UserCheck className="h-5 w-5 text-rose-600" />
            客戶 CRM 與病歷偏好管理
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            追蹤顧客消費總額、累計次數、專屬偏好備註、過敏史與 VIP 標籤
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-900/20 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> 建立新顧客檔案
        </button>
      </div>

      {/* Search Input */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="快速搜尋客戶姓名、手機、標籤（例如：VIP、敏感肌）..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full text-xs bg-transparent outline-none text-slate-900 dark:text-white"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCustomers.map(customer => {
          return (
            <div
              key={customer.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between hover:border-rose-300 dark:hover:border-rose-900 transition-all space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-extrabold text-sm flex items-center justify-center">
                      {customer.name[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        {customer.name}
                        {customer.tags?.includes('VIP') && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            VIP
                          </span>
                        )}
                      </h3>
                      <div className="text-xs text-slate-500 tabular-nums flex items-center gap-1.5 mt-0.5">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {customer.phone}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => openEditModal(customer)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="編輯顧客備註"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Tags */}
                {customer.tags && customer.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {customer.tags.map(tag => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Preferences / History Notes */}
                {customer.preferences && (
                  <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-xs">
                    <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 block mb-0.5">
                      專屬偏好與病歷備忘：
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed">
                      {customer.preferences}
                    </p>
                  </div>
                )}
              </div>

              {/* Stats Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <div>
                  <span className="text-[10px] text-slate-400 block">累計到訪</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                    {customer.total_visits || 1} 次
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">累計消費</span>
                  <span className="font-bold text-emerald-600 tabular-nums">
                    NT$ {(customer.total_spent || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit / Create Customer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-rose-600" />
                {editingCustomer ? '編輯顧客檔案' : '建立顧客新檔案'}
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
                    顧客姓名 *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="王小芬"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    聯絡手機 *
                  </label>
                  <input
                    required
                    type="tel"
                    placeholder="0912-345-678"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  電子信箱 (選填)
                </label>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  客群標籤 (以逗號分隔，例如：VIP, 敏感肌, 常客)
                </label>
                <input
                  type="text"
                  placeholder="VIP, 敏感肌, 偏好Leo剪髮"
                  value={formTags}
                  onChange={e => setFormTags(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  個人偏好、膚況特徵與過敏紀錄
                </label>
                <textarea
                  rows={3}
                  placeholder="詳細記錄客人的膚況、過敏原、指定風格、喜歡喝的飲品等..."
                  value={formPreferences}
                  onChange={e => setFormPreferences(e.target.value)}
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
                {isSubmitting ? '儲存中...' : '儲存檔案'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
