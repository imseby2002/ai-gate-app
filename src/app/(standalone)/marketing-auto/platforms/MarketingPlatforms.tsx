'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Wifi, WifiOff, ExternalLink, Lock } from 'lucide-react'
import PlatformGuidePanel from '@/components/PlatformGuidePanel'
import TokenRefreshStatus from '@/components/TokenRefreshStatus'
import { MARKETING_GUIDES } from '@/lib/platform-guides'
import { useTranslations } from 'next-intl'

type Field = { key: string; label: string; placeholder: string; secret: boolean }
type Platform = {
  id: string
  name: string
  color: string
  note: string
  docUrl: string
  fields: Field[]
}

// 平台定義與憑證欄位 — 必須與 /api/marketing/upload/route.ts 的欄位名稱、
// platform 字串（區分大小寫）完全一致，否則一鍵發布會抓不到憑證。
// 共用同一支 API（/api/social/credentials）與同一張表（social_platform_credentials），
// 但 platform 值刻意使用「Facebook」等大寫字串，跟客服頻道用的小寫 id（line/whatsapp/zalo…）
// 是不同的資料列，兩邊憑證互不影響。
const PLATFORMS: Platform[] = [
  {
    id: 'Facebook', name: 'Facebook 粉絲頁', color: '#1877F2',
    note: '同時套用於 FB Reels。到 Meta for Developers 建立 App，申請 pages_manage_posts + pages_read_engagement + pages_show_list 權限後產生 Token。要讓 AI Agent 投放 Meta 廣告：Token 使用具 ads_management 權限的 System User token，並填入廣告帳戶 ID。',
    docUrl: 'https://developers.facebook.com/docs/pages/getting-started',
    fields: [
      { key: 'page_access_token', label: 'Page Access Token', placeholder: 'EAA...', secret: true },
      { key: 'page_id', label: 'Page ID', placeholder: '1234567890', secret: false },
      { key: 'ad_account_id', label: '廣告帳戶 ID（選填，Agent 投放廣告用）', placeholder: 'act_1234567890', secret: false },
    ],
  },
  {
    id: 'Instagram', name: 'Instagram', color: '#E1306C',
    note: '同時套用於 IG Reels。需要與粉專連結的 IG 商業帳號。',
    docUrl: 'https://developers.facebook.com/docs/instagram-api/getting-started',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'EAA...', secret: true },
      { key: 'ig_user_id', label: 'IG User ID', placeholder: '1234567890', secret: false },
    ],
  },
  {
    id: 'Threads', name: 'Threads', color: '#000000',
    note: '需要 Threads API 存取權限。',
    docUrl: 'https://developers.facebook.com/docs/threads',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: '...', secret: true },
      { key: 'threads_user_id', label: 'Threads User ID', placeholder: '...', secret: false },
    ],
  },
  {
    id: 'LinkedIn', name: 'LinkedIn', color: '#0A66C2',
    note: 'Author URN：個人帳號為 urn:li:person:xxxx，公司頁為 urn:li:organization:xxxx。',
    docUrl: 'https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/share-api',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: '...', secret: true },
      { key: 'author_urn', label: 'Author URN', placeholder: 'urn:li:organization:xxxx', secret: false },
      { key: 'client_id', label: 'Client ID（選填，自動更新權杖用）', placeholder: '...', secret: false },
      { key: 'client_secret', label: 'Client Secret（選填，自動更新權杖用）', placeholder: '...', secret: true },
      { key: 'refresh_token', label: 'Refresh Token（選填，LinkedIn 有開放才有）', placeholder: '...', secret: true },
    ],
  },
  {
    id: 'Twitter/X', name: 'Twitter / X', color: '#000000',
    note: '開發者後台「Keys and Tokens」頁可取得以下四組值。',
    docUrl: 'https://developer.twitter.com/en/docs/authentication/oauth-1-0a',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: '...', secret: true },
      { key: 'api_secret', label: 'API Secret', placeholder: '...', secret: true },
      { key: 'access_token', label: 'Access Token', placeholder: '...', secret: true },
      { key: 'access_token_secret', label: 'Access Token Secret', placeholder: '...', secret: true },
    ],
  },
  {
    id: 'LINE VOOM', name: 'LINE 官方帳號群發', color: '#00B900',
    note: '沿用 LINE 官方帳號的 Channel Access Token，群發訊息給所有好友（依好友數計入每月訊息則數）。與客服頻道綁定的 LINE 憑證分開儲存。',
    docUrl: 'https://developers.line.biz/en/docs/messaging-api/',
    fields: [
      { key: 'channel_access_token', label: 'Channel Access Token', placeholder: '...', secret: true },
    ],
  },
  {
    id: 'Zalo', name: 'Zalo OA（發文）', color: '#0068FF',
    note: '發表文章用，與客服頻道綁定的 Zalo 憑證分開儲存。',
    docUrl: 'https://developers.zalo.me/docs/official-account/article',
    fields: [
      { key: 'access_token', label: 'OA Access Token', placeholder: '...', secret: true },
      { key: 'oa_id', label: 'OA ID', placeholder: '...', secret: false },
      { key: 'app_id', label: 'App ID（自動更新權杖用）', placeholder: '...', secret: false },
      { key: 'secret_key', label: 'Secret Key（自動更新權杖用）', placeholder: '...', secret: true },
      { key: 'refresh_token', label: 'Refresh Token（自動更新權杖用）', placeholder: '...', secret: true },
    ],
  },
  {
    id: 'YouTube Shorts', name: 'YouTube Shorts', color: '#FF0000',
    note: 'Refresh Token 需先完成一次 Google OAuth 授權流程取得（例如透過 OAuth Playground），無法直接用密碼登入產生。',
    docUrl: 'https://developers.google.com/youtube/v3/guides/uploading_a_video',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: '....apps.googleusercontent.com', secret: false },
      { key: 'client_secret', label: 'Client Secret', placeholder: '...', secret: true },
      { key: 'refresh_token', label: 'Refresh Token', placeholder: '1//...', secret: true },
    ],
  },
  {
    id: 'TikTok', name: 'TikTok', color: '#000000',
    note: '需要具備 Content Posting API 權限的 Access Token。',
    docUrl: 'https://developers.tiktok.com/doc/content-posting-api-get-started/',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: '...', secret: true },
      { key: 'client_key', label: 'Client Key（自動更新權杖用）', placeholder: '...', secret: false },
      { key: 'client_secret', label: 'Client Secret（自動更新權杖用）', placeholder: '...', secret: true },
      { key: 'refresh_token', label: 'Refresh Token（自動更新權杖用）', placeholder: '...', secret: true },
    ],
  },
  {
    id: 'GA4', name: 'Google Analytics 4（官網流量，唯讀）', color: '#F9AB00',
    note: '讓 AI Agent 讀取官網 sessions／使用者數。步驟：① Google Cloud Console 啟用「Google Analytics Data API」② 建立服務帳戶並下載 JSON 金鑰 ③ GA4「管理 → 資源存取管理」把服務帳戶 email 加為「檢視者」④ 資源 ID 在「管理 → 資源詳細資料」。填了「評估 ID」，本平台的民宿官網與加入會員頁會自動裝上追蹤碼；自己的外部網站請貼同一個評估 ID，並在 GA4 資料串流「設定網域」加入兩個網域做跨網域追蹤。不佔方案平台數。',
    docUrl: 'https://support.google.com/analytics/answer/9304153?hl=zh-Hant',
    fields: [
      { key: 'property_id', label: 'GA4 資源 ID', placeholder: '123456789', secret: false },
      { key: 'measurement_id', label: '評估 ID（本平台民宿官網自動裝追蹤碼用）', placeholder: 'G-XXXXXXXXXX', secret: false },
      { key: 'service_account_json', label: '服務帳戶 JSON 金鑰（整份檔案內容貼上）', placeholder: '{"type":"service_account", ...}', secret: true },
    ],
  },
]

interface PlatformState {
  is_connected: boolean
  preview: Record<string, string>
  values: Record<string, string>
}

export function MarketingPlatforms({ canSettings }: { canSettings: boolean }) {
  const tr = useTranslations('MktPlatforms')
  // 平台名稱／說明／欄位名稱：有翻譯就用翻譯，否則用 PLATFORMS 內的原文
  const pt = (id: string, field: string, fallback: string) => {
    const k = `p.${id.replace(/[^A-Za-z0-9]/g, '_')}.${field}`
    return tr.has(k) ? tr(k) : fallback
  }
  const [status, setStatus] = useState<Record<string, PlatformState>>({})
  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [adsTesting, setAdsTesting] = useState(false)
  const [adsResult, setAdsResult] = useState<{ ok: boolean; text: string } | null>(null)

  // 唯讀測試：讀廣告帳戶資訊與近 30 天成效，不建立廣告、不花錢
  const testMetaAds = async () => {
    setAdsTesting(true); setAdsResult(null)
    try {
      const res = await fetch('/api/agent/meta-ads-test')
      const d = await res.json()
      if (d.account) {
        const i = d.insights_last_30d ?? {}
        setAdsResult({
          ok: !!d.ok,
          text: tr('adsOk', { acc: d.adAccountId, name: d.account.name, cur: d.account.currency, status: d.account.status_label, reach: i.reach ?? 0, imp: i.impressions ?? 0, spend: i.spend ?? 0 }),
        })
      } else {
        setAdsResult({ ok: false, text: `${d.adAccountId ? d.adAccountId + '：' : ''}${d.error ?? tr('testFailed')}` })
      }
    } catch { setAdsResult({ ok: false, text: tr('netErr') }) }
    finally { setAdsTesting(false) }
  }

  const [ga4Testing, setGa4Testing] = useState(false)
  const [ga4Result, setGa4Result] = useState<{ ok: boolean; text: string } | null>(null)

  const testGa4 = async () => {
    setGa4Testing(true); setGa4Result(null)
    try {
      const res = await fetch('/api/agent/ga4-test')
      const d = await res.json()
      if (d.ok) {
        const t = d.totals_last_7d ?? {}
        const hosts = ((d.by_host_last_7d ?? []) as { host: string; sessions: number }[]).map(h => `${h.host || tr('unknown')} ${h.sessions}`).join(', ')
        setGa4Result({ ok: true, text: tr('ga4Ok', { pid: d.propertyId, s: t.sessions ?? 0, u: t.totalUsers ?? 0, nu: t.newUsers ?? 0, pv: t.screenPageViews ?? 0 }) + (hosts ? tr('ga4Hosts', { hosts }) : '') })
      } else {
        setGa4Result({ ok: false, text: `${d.serviceAccount ? d.serviceAccount + '：' : ''}${d.error ?? tr('testFailed')}` })
      }
    } catch { setGa4Result({ ok: false, text: tr('netErr') }) }
    finally { setGa4Testing(false) }
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/social/credentials')
      const data = await res.json()
      const platforms = (data.platforms ?? {}) as Record<string, PlatformState>
      setStatus(platforms)
      setInputs(prev => {
        const next = { ...prev }
        for (const p of PLATFORMS) {
          next[p.id] = { ...(next[p.id] ?? {}) }
          const vals = platforms[p.id]?.values ?? {}
          for (const f of p.fields) {
            if (!f.secret && vals[f.key] != null) next[p.id][f.key] = vals[f.key]
          }
        }
        return next
      })
    } catch { /* noop */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const setField = (pid: string, key: string, val: string) =>
    setInputs(prev => ({ ...prev, [pid]: { ...(prev[pid] ?? {}), [key]: val } }))

  const save = async (pid: string) => {
    setSaving(pid); setMsg(null)
    try {
      const res = await fetch('/api/social/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: pid, credentials: inputs[pid] ?? {} }),
      })
      const data = await res.json()
      if (!res.ok) setMsg(`${pid}: ${data.error ?? tr('saveFailed')}`)
      else { setMsg(tr('saved', { pid })); load() }
    } catch { setMsg(`${pid}: ${tr('netErr')}`) }
    finally { setSaving(null); setTimeout(() => setMsg(null), 3000) }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-white dark:from-background dark:to-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/marketing-auto" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="text-lg sm:text-xl font-bold">{tr('title')}</h1>
        </div>

        {!canSettings && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{tr.rich('needAdmin', { b: c => <strong>{c}</strong> })}</span>
          </div>
        )}

        {msg && (
          <div className="mb-4 text-sm rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-3 py-2">{msg}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            {PLATFORMS.map(p => {
              const st = status[p.id]
              const connected = !!st?.is_connected
              return (
                <div key={p.id} className="bg-card rounded-2xl border p-4 sm:p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />
                      <span className="font-semibold">{pt(p.id, 'name', p.name)}</span>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {connected ? <><Wifi className="h-3.5 w-3.5" /> {tr('connected')}</> : <><WifiOff className="h-3.5 w-3.5" /> {tr('notLinked')}</>}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                    {pt(p.id, 'note', p.note)}
                    <a href={p.docUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 ml-1 text-primary hover:underline">
                      {tr('docs')} <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>

                  <PlatformGuidePanel guide={MARKETING_GUIDES[p.id]} />
                  <TokenRefreshStatus values={st?.values} />

                  <div className="space-y-3">
                    {p.fields.map(f => {
                      const masked = st?.preview?.[f.key]
                      const ph = f.secret && masked ? tr('maskedPh', { masked }) : f.placeholder
                      return (
                        <div key={f.key}>
                          <label className="text-[11px] font-medium text-muted-foreground">{pt(p.id, `f_${f.key}`, f.label)}</label>
                          <input
                            type={f.secret ? 'password' : 'text'}
                            autoComplete="off"
                            disabled={!canSettings}
                            value={inputs[p.id]?.[f.key] ?? ''}
                            onChange={e => setField(p.id, f.key, e.target.value)}
                            placeholder={ph}
                            className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                          />
                        </div>
                      )
                    })}
                  </div>

                  {canSettings && (
                    <div className="mt-4">
                      <button onClick={() => save(p.id)} disabled={saving === p.id}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                        {saving === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {tr('save')}
                      </button>
                    </div>
                  )}

                  {p.id === 'GA4' && connected && (
                    <div className="mt-3 space-y-2">
                      <button onClick={testGa4} disabled={ga4Testing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-50 hover:bg-accent transition-colors">
                        {ga4Testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                        {tr('testGa4')}
                      </button>
                      {ga4Result && (
                        <p className={`text-xs rounded-lg px-3 py-2 ${ga4Result.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'}`}>
                          {ga4Result.text}
                        </p>
                      )}
                    </div>
                  )}

                  {p.id === 'Facebook' && connected && (
                    <div className="mt-3 space-y-2">
                      <button onClick={testMetaAds} disabled={adsTesting}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-50 hover:bg-accent transition-colors">
                        {adsTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                        {tr('testAds')}
                      </button>
                      {adsResult && (
                        <p className={`text-xs rounded-lg px-3 py-2 ${adsResult.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'}`}>
                          {adsResult.text}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
