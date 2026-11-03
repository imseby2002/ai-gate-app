'use client'

import { useEffect, useState } from 'react'
import {
  Settings, Building2, Clock, Globe, ShieldAlert,
  Copy, Check, ExternalLink, Save, Sparkles, MapPin, Phone
} from 'lucide-react'
import { ReserveStore, BusinessHours, DaySchedule } from '@/lib/reserve/types'
import { DEFAULT_STORE } from '@/lib/reserve/mock-data'
import { cn } from '@/lib/utils/cn'

const DAYS = [
  { key: 'mon', label: '週一' },
  { key: 'tue', label: '週二' },
  { key: 'wed', label: '週三' },
  { key: 'thu', label: '週四' },
  { key: 'fri', label: '週五' },
  { key: 'sat', label: '週六' },
  { key: 'sun', label: '週日' },
] as const

export default function ReserveSettingsPage() {
  const [store, setStore] = useState<ReserveStore>(DEFAULT_STORE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function loadStore() {
      try {
        const res = await fetch('/api/reserve/store')
        const data = await res.json()
        if (data.store) setStore(data.store)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadStore()
  }, [])

  function handleBusinessHourChange(dayKey: keyof BusinessHours, field: keyof DaySchedule, val: any) {
    setStore(prev => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [dayKey]: {
          ...prev.business_hours[dayKey],
          [field]: val,
        },
      },
    }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSavedSuccess(false)
    try {
      const res = await fetch('/api/reserve/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store),
      })
      const data = await res.json()
      if (data.store) {
        setStore(data.store)
      }
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  function copyPublicUrl() {
    const url = `${window.location.origin}/r/${store.slug || 'elegance-beauty'}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Settings className="h-5 w-5 text-rose-600" />
            門市與線上預約設定
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            配置營業時間、時段劃分、線上自訂專屬預約網址與顧客須知
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Public Booking Link Card */}
        <div className="bg-gradient-to-r from-rose-50 via-pink-50/40 to-white dark:from-slate-900 dark:to-slate-950 p-6 rounded-3xl border border-rose-200/80 dark:border-rose-900/50 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-rose-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">專屬公開線上預約網址</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            顧客無需下載 App，點擊此網址即可在手機或電腦直接選擇服務項目、設計師/醫師並完成排程。
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <div className="flex-1 flex items-center px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto">
              <span className="text-slate-400 select-none">/r/</span>
              <input
                type="text"
                value={store.slug || ''}
                onChange={e => setStore(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                className="bg-transparent font-bold text-rose-600 outline-none flex-1 min-w-[120px]"
                placeholder="salon-name"
              />
            </div>

            <button
              type="button"
              onClick={copyPublicUrl}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all shadow-xs"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-rose-500" />}
              {copied ? '已複製' : '複製網址'}
            </button>

            <a
              href={`/r/${store.slug || 'elegance-beauty'}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              打開前台
            </a>
          </div>
        </div>

        {/* Basic Store Info */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-4 w-4 text-rose-600" />
            門市基本資料
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                門市 / 品牌名稱 *
              </label>
              <input
                required
                type="text"
                value={store.name || ''}
                onChange={e => setStore(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                服務行業別 *
              </label>
              <select
                value={store.category || 'beauty'}
                onChange={e => setStore(prev => ({ ...prev, category: e.target.value as any }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-rose-500"
              >
                <option value="beauty">美容美膚 / 美睫美甲</option>
                <option value="hair">美髮沙龍 / 造型設計</option>
                <option value="clinic">診所看診 / 復健物理治療</option>
                <option value="spa">精油 SPA / 舒壓按摩</option>
                <option value="fitness">健身瑜珈 / 私人教練</option>
                <option value="pet">寵物美容 / 獸醫診療</option>
                <option value="other">綜合專業預約服務</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                聯絡市話 / 手機
              </label>
              <input
                type="text"
                value={store.phone || ''}
                onChange={e => setStore(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                門市完整地址
              </label>
              <input
                type="text"
                value={store.address || ''}
                onChange={e => setStore(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              店家簡介 (顯示於公開預約前台首頁)
            </label>
            <textarea
              rows={2}
              value={store.description || ''}
              onChange={e => setStore(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* Business Hours */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="h-4 w-4 text-rose-600" />
            每週營業時段設定
          </h2>
          <p className="text-xs text-slate-500">
            設定門市開放客人線上預約的營業時段，非營業時間系統將自動關閉時段預約。
          </p>

          <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            {DAYS.map(d => {
              const schedule = store.business_hours?.[d.key as keyof BusinessHours] || {
                open: '10:00',
                close: '20:00',
                closed: false,
              }

              return (
                <div key={d.key} className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 w-20 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!schedule.closed}
                      onChange={e => handleBusinessHourChange(d.key as keyof BusinessHours, 'closed', !e.target.checked)}
                      className="rounded text-rose-600"
                    />
                    <span>{d.label}</span>
                  </label>

                  {!schedule.closed ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={schedule.open || '10:00'}
                        onChange={e => handleBusinessHourChange(d.key as keyof BusinessHours, 'open', e.target.value)}
                        className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs"
                      />
                      <span className="text-slate-400">至</span>
                      <input
                        type="time"
                        value={schedule.close || '20:00'}
                        onChange={e => handleBusinessHourChange(d.key as keyof BusinessHours, 'close', e.target.value)}
                        className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs"
                      />
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs py-1">全日公休不營業</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Booking Rules & Notice */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            預約排程限制與取消政策
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                預約時段切分
              </label>
              <select
                value={store.slot_interval_minutes || 30}
                onChange={e => setStore(prev => ({ ...prev, slot_interval_minutes: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
              >
                <option value="15">每 15 分鐘一個時段</option>
                <option value="30">每 30 分鐘一個時段 (推薦)</option>
                <option value="45">每 45 分鐘一個時段</option>
                <option value="60">每 60 分鐘一個時段</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                最長可提早幾天預約
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={store.advance_booking_days || 30}
                onChange={e => setStore(prev => ({ ...prev, advance_booking_days: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                最少需提前幾小時預約
              </label>
              <input
                type="number"
                min="0"
                max="48"
                value={store.min_booking_hours || 2}
                onChange={e => setStore(prev => ({ ...prev, min_booking_hours: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              顧客預約須知（取消規則、遲到保留時間）
            </label>
            <textarea
              rows={3}
              value={store.notice || ''}
              onChange={e => setStore(prev => ({ ...prev, notice: e.target.value }))}
              placeholder="1. 請於預約時間前 5 分鐘抵達現場。&#10;2. 遲到超過 15 分鐘將自動釋出時段。"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2">
          {savedSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 animate-in fade-in">
              <Check className="h-4 w-4" /> 設定已成功儲存！
            </span>
          )}
          <div className="ml-auto">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-900/20 active:scale-95 transition-all"
            >
              <Save className="h-4 w-4" />
              {saving ? '儲存中...' : '儲存所有設定'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
