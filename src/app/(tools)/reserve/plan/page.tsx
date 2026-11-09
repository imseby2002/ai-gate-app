'use client'

// 預約系統方案：FREE／CORE，CORE 以 ECPay 一次性付款，每次 30 天
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, Crown } from 'lucide-react'
import { RESERVE_PLAN_PACKAGES } from '@/lib/ecpay/reserve-plans'

type Ent = { plan: 'free' | 'core'; periodEnd: string | null }

const FREE_ITEMS = ['1 間門市', '線上預約頁、服務、人員排班、行事曆、顧客名單', '簡訊提醒（固定內容，依用量扣點）', 'AI 助理（依用量扣點）', '客服串接預約']
const CORE_ITEMS = ['最多 20 間分店，各自獨立預約網址', '新分店一鍵複製設定、服務與人員', '自訂簡訊提醒內容', 'FREE 全部功能']

export default function ReservePlanPage() {
  return <Suspense><ReservePlanContent /></Suspense>
}

function ReservePlanContent() {
  const params = useSearchParams()
  const [ent, setEnt] = useState<Ent | null>(null)
  const [busy, setBusy] = useState(false)
  const pkg = RESERVE_PLAN_PACKAGES[0]

  useEffect(() => {
    let alive = true
    fetch('/api/reserve/plan').then(r => (r.ok ? r.json() : null)).then(d => { if (alive && d) setEnt(d) }).catch(() => {})
    return () => { alive = false }
  }, [])

  async function checkout() {
    setBusy(true)
    try {
      const r = await fetch('/api/billing/create-reserve-plan-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packageId: pkg.id }),
      })
      const data = await r.json()
      if (!r.ok) { alert(data.error ?? '建立訂單失敗'); return }
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = data.paymentUrl
      form.target = '_blank'
      for (const [key, value] of Object.entries(data.params as Record<string, string>)) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = String(value)
        form.appendChild(input)
      }
      document.body.appendChild(form)
      form.submit()
      document.body.removeChild(form)
    } catch {
      alert('網路錯誤，請稍後再試')
    } finally {
      setBusy(false)
    }
  }

  const isCore = ent?.plan === 'core'
  const upgrade = params.get('upgrade')

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Crown className="h-5 w-5 text-rose-600" />方案與費用</h1>
        <p className="text-xs text-slate-500 mt-1">
          目前方案：<span className="font-bold">{ent ? ent.plan.toUpperCase() : '…'}</span>
          {isCore && ent?.periodEnd && <>（到期日 {new Date(ent.periodEnd).toLocaleDateString('zh-TW')}）</>}
        </p>
        {upgrade === 'done' && <p className="text-xs text-emerald-600 mt-1">付款完成後約 1 分鐘內生效，請重新整理頁面確認。</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="font-extrabold tracking-widest text-sm">FREE</div>
          <div className="text-2xl font-extrabold">$0</div>
          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            {FREE_ITEMS.map(i => <li key={i} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-teal-600" />{i}</li>)}
          </ul>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border-2 border-rose-500 space-y-3">
          <div className="font-extrabold tracking-widest text-sm text-rose-600">CORE</div>
          <div className="text-2xl font-extrabold">${pkg.usdPrice}<span className="text-xs font-semibold text-slate-500"> / 月</span></div>
          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            {CORE_ITEMS.map(i => <li key={i} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-rose-600" />{i}</li>)}
          </ul>
          <button
            onClick={checkout}
            disabled={busy || !ent}
            className="w-full py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-60"
          >
            {busy ? '建立訂單中…' : isCore ? '續購 30 天' : '升級 CORE'}
          </button>
          <p className="text-[11px] text-slate-400">一次付款 30 天，不會自動續扣；到期前續購會從原到期日往後延。以付款當下匯率換算台幣。</p>
        </div>
      </div>
    </div>
  )
}
