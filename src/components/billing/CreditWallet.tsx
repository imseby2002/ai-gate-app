'use client'

import { useState } from 'react'
import { Loader2, Wallet, CheckCircle2 } from 'lucide-react'
import { CREDIT_PACKAGES, type PackageId } from '@/lib/ecpay/client'

export interface CreditTx {
  id: string
  amount_usd: number
  type: string
  description: string
  created_at: string
}

export function CreditWallet({
  balance,
  transactions = [],
  justPaid = false,
}: {
  balance: number
  transactions?: CreditTx[]
  justPaid?: boolean
}) {
  const [loading, setLoading] = useState<PackageId | null>(null)

  const topup = async (packageId: PackageId) => {
    setLoading(packageId)
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, returnUrl: window.location.href }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

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
      alert('建立訂單失敗，請稍後再試')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {justPaid && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          刷卡成功，點數已入帳。
        </div>
      )}

      {/* 餘額 */}
      <div className="flex items-center justify-between p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border">
        <div>
          <div className="text-sm text-muted-foreground">目前可用點數</div>
          <div className="text-3xl font-bold mt-0.5">
            ${balance.toFixed(2)}
            <span className="text-base font-normal text-muted-foreground/60 ml-1">USD</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-primary/15">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
      </div>

      {/* 儲值方案 */}
      <div>
        <div className="mb-3 text-sm font-semibold">選擇儲值方案</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CREDIT_PACKAGES.map(pkg => {
            const featured = pkg.badge === '推薦' || pkg.badge === '最超值'
            return (
              <div
                key={pkg.id}
                className={`relative rounded-xl border-2 p-4 flex flex-col gap-2 ${featured ? 'border-primary bg-primary/5' : ''}`}
              >
                {pkg.badge && (
                  <span className="absolute -top-2.5 left-3 px-2 py-0.5 rounded-full text-xs font-semibold text-primary-foreground bg-primary">
                    {pkg.badge}
                  </span>
                )}
                <div className="font-bold text-lg">{pkg.label}</div>
                <div className="text-sm text-muted-foreground">{pkg.desc}</div>
                <button
                  onClick={() => topup(pkg.id as PackageId)}
                  disabled={loading !== null}
                  className="mt-auto flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-sm font-semibold text-primary-foreground bg-primary disabled:opacity-60"
                >
                  {loading === pkg.id
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 前往付款…</>
                    : '立即儲值'}
                </button>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground/60">
          由綠界 ECPay 安全金流處理，付款完成後點數立即入帳。點數為預付、不可退款。
        </p>
      </div>

      {/* 交易紀錄 */}
      {transactions.length > 0 && (
        <div>
          <div className="mb-3 text-sm font-semibold">交易紀錄</div>
          <div className="rounded-xl border divide-y">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate">{tx.description}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(tx.created_at).toLocaleString('zh-TW')}
                  </div>
                </div>
                <div className={`font-semibold tabular-nums shrink-0 ml-3 ${tx.amount_usd >= 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  {tx.amount_usd >= 0 ? '+' : ''}{tx.amount_usd.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
