'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Wifi, WifiOff, ExternalLink, Lock } from 'lucide-react'

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
    note: '同時套用於 FB Reels。到 Meta for Developers 建立 App，申請 pages_manage_posts + pages_read_engagement + pages_show_list 權限後產生 Token。',
    docUrl: 'https://developers.facebook.com/docs/pages/getting-started',
    fields: [
      { key: 'page_access_token', label: 'Page Access Token', placeholder: 'EAA...', secret: true },
      { key: 'page_id', label: 'Page ID', placeholder: '1234567890', secret: false },
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
    id: 'LINE VOOM', name: 'LINE VOOM', color: '#00B900',
    note: '沿用 LINE 官方帳號的 Channel Access Token，以廣播訊息方式發文（非官方 VOOM 貼文 API）。與客服頻道綁定的 LINE 憑證分開儲存。',
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
    ],
  },
]

interface PlatformState {
  is_connected: boolean
  preview: Record<string, string>
  values: Record<string, string>
}

export function MarketingPlatforms({ isOwner }: { isOwner: boolean }) {
  const [status, setStatus] = useState<Record<string, PlatformState>>({})
  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

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
      if (!res.ok) setMsg(`${pid}：${data.error ?? '儲存失敗'}`)
      else { setMsg(`${pid} 已儲存`); load() }
    } catch { setMsg(`${pid}：網路錯誤`) }
    finally { setSaving(null); setTimeout(() => setMsg(null), 3000) }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-white dark:from-background dark:to-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/marketing-auto" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="text-lg sm:text-xl font-bold">發文平台連結</h1>
        </div>

        {!isOwner && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>平台連結需由<strong>民宿擁有者本人</strong>操作才會生效（憑證以登入帳號儲存，協作者綁定不會套用到此民宿）。如需綁定請改用擁有者帳號登入。</span>
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
                      <span className="font-semibold">{p.name}</span>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {connected ? <><Wifi className="h-3.5 w-3.5" /> 已連線</> : <><WifiOff className="h-3.5 w-3.5" /> 未綁定</>}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                    {p.note}
                    <a href={p.docUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 ml-1 text-primary hover:underline">
                      官方文件 <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>

                  <div className="space-y-3">
                    {p.fields.map(f => {
                      const masked = st?.preview?.[f.key]
                      const ph = f.secret && masked ? `已設定 ${masked}（留空不變更）` : f.placeholder
                      return (
                        <div key={f.key}>
                          <label className="text-[11px] font-medium text-muted-foreground">{f.label}</label>
                          <input
                            type={f.secret ? 'password' : 'text'}
                            autoComplete="off"
                            disabled={!isOwner}
                            value={inputs[p.id]?.[f.key] ?? ''}
                            onChange={e => setField(p.id, f.key, e.target.value)}
                            placeholder={ph}
                            className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                          />
                        </div>
                      )
                    })}
                  </div>

                  {isOwner && (
                    <div className="mt-4">
                      <button onClick={() => save(p.id)} disabled={saving === p.id}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                        {saving === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        儲存
                      </button>
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
