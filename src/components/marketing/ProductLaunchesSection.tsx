'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Rocket, Crown, Sparkles, CheckCircle2, Clock, Calendar,
  BarChart3, Plus, Pencil, Trash2, X, Loader2, ArrowUpRight,
  FlaskConical, Store, ChevronRight, AlertCircle, Unlock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

interface ProductLaunch {
  id: string
  name: string
  product_id?: string
  recipe_id?: string
  pos_item_id?: string
  status: 'rd_submitted' | 'mkt_prep' | 'vip_exclusive' | 'public_released' | 'archived'
  vip_start_date: string | null
  vip_end_date: string | null
  vip_tiers: string[]
  vip_discount_type: string
  vip_notes: string
  public_release_date: string | null
  created_at: string
  isVipExpired?: boolean
  product?: {
    id: string
    name: string
    price: number
    slogan: string
    category: string
    images: string[]
  }
  recipe?: {
    id: string
    name: string
    total_purchase: number
    total_export: number
  }
}

const LAUNCH_STATUS: Record<string, { label: string; variant: 'secondary' | 'default' | 'success' | 'warning'; desc: string }> = {
  rd_submitted:    { label: '研發已提交', variant: 'secondary', desc: '等待行銷人員認領包裝' },
  mkt_prep:        { label: '行銷籌備中', variant: 'default',   desc: '視覺圖文定案與排程' },
  vip_exclusive:   { label: '👑 VIP 專屬試飲期', variant: 'warning',   desc: '僅 VIP 會員可優先點選' },
  public_released: { label: '🚀 全客全面上市', variant: 'success',   desc: '全通路公開銷售中' },
  archived:        { label: '已下架封存', variant: 'secondary', desc: '季節限定結束' },
}

const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('zh-TW')

export function ProductLaunchesSection() {
  const [items, setItems] = useState<ProductLaunch[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<ProductLaunch> | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // 效益比對分析 Modal
  const [analyticsModalTarget, setAnalyticsModalTarget] = useState<ProductLaunch | null>(null)
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mkt/launches')
      const j = await res.json()
      setItems(j.items ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!editing) return
    if (!String(editing.name ?? '').trim()) {
      setErr('請填寫新品名稱')
      return
    }
    setSaving(true)
    setErr('')
    try {
      const method = editing.id ? 'PATCH' : 'POST'
      const r = await fetch('/api/mkt/launches', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const j = await r.json()
      if (!r.ok) {
        setErr(j.error || '儲存失敗')
        return
      }
      setEditing(null)
      load()
    } catch (e: any) {
      setErr(e.message || '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  // 一鍵解鎖全面上市
  async function unlockPublicRelease(launch: ProductLaunch) {
    if (!confirm(`確定將【${launch.name}】正式解鎖開放給所有大眾顧客？`)) return
    try {
      const r = await fetch('/api/mkt/launches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: launch.id,
          status: 'public_released',
          public_release_date: new Date().toISOString().split('T')[0],
        }),
      })
      if (r.ok) load()
    } catch (e) {
      console.error(e)
    }
  }

  // 開啟 VIP vs 公開期 成效比對
  async function openAnalytics(launch: ProductLaunch) {
    setAnalyticsModalTarget(launch)
    setAnalyticsLoading(true)
    setAnalyticsData(null)
    try {
      const res = await fetch(`/api/mkt/launches/analytics?launch_id=${launch.id}`)
      const j = await res.json()
      if (j.ok) {
        setAnalyticsData(j)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  return (
    <div className="space-y-4 pt-4 border-t">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            研發 $\leftrightarrow$ 行銷 新品上架流水線 (VIP 專享到全面上市)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            研發完成配方後推送上架，行銷部可設定 VIP 搶先專屬試飲期限，期滿自動或一鍵開放全客購買
          </p>
        </div>

        <Button
          size="sm"
          className="gap-1.5 text-xs font-semibold"
          onClick={() => {
            setErr('')
            const today = new Date()
            const in7 = new Date(today.getTime() + 7 * 86400000)
            setEditing({
              name: '',
              status: 'mkt_prep',
              vip_start_date: today.toISOString().split('T')[0],
              vip_end_date: in7.toISOString().split('T')[0],
              vip_tiers: ['vip', 'vvip'],
              vip_discount_type: 'early_bird',
            })
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          排程新品上架
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 border rounded-xl bg-card/30 border-dashed text-xs text-muted-foreground">
          目前無進行中之新品上架排程。研發人員於配方表提交新品後將自動出現在此處。
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(launch => {
            const st = LAUNCH_STATUS[launch.status] || LAUNCH_STATUS.mkt_prep

            return (
              <div
                key={launch.id}
                className="rounded-xl border bg-card p-4 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <Badge variant={st.variant} className="text-[11px] font-bold">
                      {st.label}
                    </Badge>
                    {launch.isVipExpired && (
                      <Badge variant="destructive" className="text-[10px] animate-pulse">
                        ⚠️ VIP期限已到，可開放全客
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-bold text-base mt-2">{launch.name}</h3>

                  {launch.recipe && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <FlaskConical className="h-3 w-3 text-violet-500" />
                      <span>配方連動成本：${fmt(launch.recipe.total_purchase)}</span>
                    </div>
                  )}

                  <div className="p-2.5 rounded-lg bg-muted/40 text-xs space-y-1 mt-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">👑 VIP 搶先試飲期：</span>
                      <strong className="text-foreground">
                        {launch.vip_start_date ?? '即日起'} ~ {launch.vip_end_date ?? '未定'}
                      </strong>
                    </div>
                    {launch.public_release_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">🚀 全面公開上市：</span>
                        <span className="text-foreground">{launch.public_release_date}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t">
                  <div className="flex items-center gap-1">
                    {launch.status === 'vip_exclusive' && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs gap-1 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => unlockPublicRelease(launch)}
                      >
                        <Unlock className="h-3 w-3" />
                        解鎖全面上市
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 text-primary hover:border-primary font-medium"
                      onClick={() => openAnalytics(launch)}
                    >
                      <BarChart3 className="h-3 w-3" />
                      成效比對
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setErr('')
                        setEditing({ ...launch })
                      }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('確定移除此新品上架排程？')) return
                        await fetch('/api/mkt/launches', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: launch.id }),
                        })
                        load()
                      }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 彈窗 1：編輯排程 Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div
            className="w-full max-w-md rounded-2xl bg-card border p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-bold text-lg">{editing.id ? '設定新品上市排程' : '排程新品上架'}</h2>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1 block">新品名稱 *</label>
                <Input
                  value={editing.name ?? ''}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  className="h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">當前上架階段</label>
                <select
                  value={editing.status ?? 'mkt_prep'}
                  onChange={e => setEditing({ ...editing, status: e.target.value as any })}
                  className="w-full h-9 rounded-lg border border-input bg-card px-3 text-xs font-medium"
                >
                  {Object.entries(LAUNCH_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label} ({v.desc})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold mb-1 block">👑 VIP 專享起始日</label>
                  <Input
                    type="date"
                    value={editing.vip_start_date ?? ''}
                    onChange={e => setEditing({ ...editing, vip_start_date: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block">👑 VIP 專享截止日</label>
                  <Input
                    type="date"
                    value={editing.vip_end_date ?? ''}
                    onChange={e => setEditing({ ...editing, vip_end_date: e.target.value })}
                    className="h-9"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">🚀 全面公開上市日期</label>
                <Input
                  type="date"
                  value={editing.public_release_date ?? ''}
                  onChange={e => setEditing({ ...editing, public_release_date: e.target.value })}
                  className="h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">專享期優惠方案說明</label>
                <Input
                  value={editing.vip_notes ?? ''}
                  onChange={e => setEditing({ ...editing, vip_notes: e.target.value })}
                  placeholder="例：VIP 獨家搶先試飲，打卡贈送精美杯套"
                  className="h-9"
                />
              </div>
            </div>

            {err && <p className="text-xs text-destructive font-medium">{err}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 font-bold">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                儲存排程
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 彈窗 2：成效比對分析報告 (VIP 專享期 vs 全客開放期) */}
      {analyticsModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAnalyticsModalTarget(null)}>
          <div
            className="w-full max-w-2xl rounded-2xl bg-card border p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  新品銷售分析：VIP 專享期 vs 全面開放期
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  品項：【{analyticsModalTarget.name}】
                </p>
              </div>
              <button onClick={() => setAnalyticsModalTarget(null)} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            {analyticsLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
            ) : !analyticsData ? (
              <div className="py-12 text-center text-xs text-muted-foreground">暫無足夠之銷售數據</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* VIP 專享期 */}
                  <div className="p-4 rounded-xl border bg-purple-50/40 dark:bg-purple-950/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400">👑 階段一：VIP 搶先期</span>
                      <span className="text-[11px] text-muted-foreground">共 {analyticsData.vipPeriod.days} 天</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {analyticsData.vipPeriod.cups} <span className="text-xs font-normal">杯</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>總營收：${fmt(analyticsData.vipPeriod.revenue)}</div>
                      <div>日均銷量：<strong className="text-foreground">{analyticsData.vipPeriod.dailyAvgCups} 杯/天</strong></div>
                    </div>
                  </div>

                  {/* 全客全面上市 */}
                  <div className="p-4 rounded-xl border bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">🚀 階段二：全面上市</span>
                      <span className="text-[11px] text-muted-foreground">共 {analyticsData.publicPeriod.days} 天</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {analyticsData.publicPeriod.cups} <span className="text-xs font-normal">杯</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>總營收：${fmt(analyticsData.publicPeriod.revenue)}</div>
                      <div>日均銷量：<strong className="text-foreground">{analyticsData.publicPeriod.dailyAvgCups} 杯/天</strong></div>
                    </div>
                  </div>
                </div>

                {/* 增長分析 */}
                <div className="p-4 rounded-xl border bg-card space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-muted-foreground">日均銷量乘數增幅：</span>
                    <span className={`text-base font-bold ${
                      analyticsData.comparison.cupsLiftPct >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {analyticsData.comparison.cupsLiftPct > 0 ? '+' : ''}{analyticsData.comparison.cupsLiftPct}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg">
                    💡 {analyticsData.comparison.analysis}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
