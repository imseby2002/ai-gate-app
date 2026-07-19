'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Wallet, CheckCircle2, RefreshCw, CreditCard } from 'lucide-react'
import { CREDIT_PACKAGES, type PackageId } from '@/lib/ecpay/client'

export interface CreditTx {
  id: string
  amount_usd: number
  type: string
  description: string
  created_at: string
}

interface RecurringOrder {
  id: string
  kind: 'credit_topup' | 'booking_plan' | 'cs_plan'
  reference_id: string
  usd_value: number
  status: string
  total_success_times: number
}

function submitEcpayForm(paymentUrl: string, params: Record<string, unknown>) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = paymentUrl
  form.target = '_blank'
  for (const [key, value] of Object.entries(params)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = key
    input.value = String(value)
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
  document.body.removeChild(form)
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
  const [autoRenewPkg, setAutoRenewPkg] = useState<Partial<Record<PackageId, boolean>>>({})

  const [recurringOrders, setRecurringOrders] = useState<RecurringOrder[]>([])
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const [autoRecharge, setAutoRecharge] = useState({ enabled: false, threshold_usd: 5, recharge_usd: 10 })
  const [hasBoundCard, setHasBoundCard] = useState(false)
  const [cardLast4, setCardLast4] = useState<string | null>(null)
  const [savingAutoRecharge, setSavingAutoRecharge] = useState(false)
  const [bindingCard, setBindingCard] = useState(false)
  const [autoRechargeMsg, setAutoRechargeMsg] = useState<{ ok: boolean; msg: string } | null>(null)

  const loadRecurringOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/cancel-recurring')
      const data = await res.json()
      if (res.ok) setRecurringOrders((data.orders ?? []).filter((o: RecurringOrder) => o.kind === 'credit_topup'))
    } catch { /* ignore */ }
  }, [])

  const loadAutoRecharge = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/auto-recharge')
      const data = await res.json()
      if (res.ok) {
        setAutoRecharge(data.settings)
        setHasBoundCard(data.hasBoundCard)
        setCardLast4(data.cardLast4)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadRecurringOrders()
    loadAutoRecharge()
  }, [loadRecurringOrders, loadAutoRecharge])

  const handleCancelRecurring = async (orderId: string) => {
    if (!confirm('確定要取消自動續購嗎？取消後不會再自動扣款。')) return
    setCancellingId(orderId)
    try {
      const res = await fetch('/api/billing/cancel-recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await loadRecurringOrders()
    } catch (err) {
      alert(err instanceof Error ? err.message : '取消失敗，請稍後再試')
    } finally {
      setCancellingId(null)
    }
  }

  const handleBindCard = async () => {
    setBindingCard(true)
    setAutoRechargeMsg(null)
    try {
      const res = await fetch('/api/billing/create-binding-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rechargeUsd: autoRecharge.recharge_usd, returnUrl: window.location.href }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      submitEcpayForm(data.paymentUrl, data.params)
    } catch (err) {
      setAutoRechargeMsg({ ok: false, msg: err instanceof Error ? err.message : '綁卡失敗，請稍後再試' })
    } finally {
      setBindingCard(false)
    }
  }

  const handleSaveAutoRecharge = async () => {
    setSavingAutoRecharge(true)
    setAutoRechargeMsg(null)
    try {
      const res = await fetch('/api/billing/auto-recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: autoRecharge.enabled,
          thresholdUsd: Number(autoRecharge.threshold_usd),
          rechargeUsd: Number(autoRecharge.recharge_usd),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAutoRechargeMsg({ ok: true, msg: '已儲存設定' })
    } catch (err) {
      setAutoRechargeMsg({ ok: false, msg: err instanceof Error ? err.message : '儲存失敗，請稍後再試' })
    } finally {
      setSavingAutoRecharge(false)
    }
  }

  const topup = async (packageId: PackageId) => {
    setLoading(packageId)
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, returnUrl: window.location.href, autoRenew: !!autoRenewPkg[packageId] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      submitEcpayForm(data.paymentUrl, data.params)
      if (autoRenewPkg[packageId]) setTimeout(loadRecurringOrders, 3000)
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
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!autoRenewPkg[pkg.id as PackageId]}
                    onChange={e => setAutoRenewPkg(prev => ({ ...prev, [pkg.id]: e.target.checked }))}
                    className="rounded"
                  />
                  每月自動於下一期扣款
                </label>
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

        {recurringOrders.length > 0 && (
          <div className="mt-5 pt-5 border-t">
            <div className="mb-3 text-sm font-semibold flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> 自動續購中
            </div>
            <div className="space-y-2">
              {recurringOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                  <div>
                    <div className="font-medium">
                      點數自動續購 {o.reference_id}
                      <span className="ml-2 text-muted-foreground">${o.usd_value}/月</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {o.status === 'pending' ? '等待首筆扣款確認中' : `已成功扣款 ${o.total_success_times} 次`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelRecurring(o.id)}
                    disabled={cancellingId === o.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-accent disabled:opacity-50"
                  >
                    {cancellingId === o.id ? '取消中…' : '取消自動續訂'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 低於門檻自動儲值 */}
      <div className="p-5 rounded-2xl border">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm font-semibold">低於門檻自動儲值</div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          點數餘額低於設定門檻時，系統會自動用已綁定的信用卡儲值，避免服務中斷。
        </p>

        {!hasBoundCard ? (
          <div className="p-4 rounded-xl border bg-muted/40 text-sm space-y-3">
            <div>尚未綁定信用卡，請先綁定才能開啟自動儲值。</div>
            <button
              onClick={handleBindCard}
              disabled={bindingCard}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground bg-primary disabled:opacity-60"
            >
              {bindingCard && <Loader2 className="h-4 w-4 animate-spin" />}
              {bindingCard ? '處理中…' : '綁定信用卡'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              已綁定卡片 {cardLast4 ? `尾號 ${cardLast4}` : ''}
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRecharge.enabled}
                onChange={e => setAutoRecharge(prev => ({ ...prev, enabled: e.target.checked }))}
                className="rounded"
              />
              啟用低於門檻自動儲值
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">餘額低於（美金）</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={autoRecharge.threshold_usd}
                  onChange={e => setAutoRecharge(prev => ({ ...prev, threshold_usd: Number(e.target.value) }))}
                  className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">自動儲值金額（美金，最低 $5）</label>
                <input
                  type="number"
                  min={5}
                  step="1"
                  value={autoRecharge.recharge_usd}
                  onChange={e => setAutoRecharge(prev => ({ ...prev, recharge_usd: Number(e.target.value) }))}
                  className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-background"
                />
              </div>
            </div>
            {autoRechargeMsg && (
              <div className={`text-sm ${autoRechargeMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{autoRechargeMsg.msg}</div>
            )}
            <button
              onClick={handleSaveAutoRecharge}
              disabled={savingAutoRecharge}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-primary-foreground bg-primary disabled:opacity-60"
            >
              {savingAutoRecharge && <Loader2 className="h-4 w-4 animate-spin" />}
              {savingAutoRecharge ? '儲存中…' : '儲存設定'}
            </button>
          </div>
        )}
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
