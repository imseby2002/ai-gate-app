'use client'

import { useState, useEffect } from 'react'
import { Fingerprint, Loader2, Save } from 'lucide-react'

interface BrandPlatforms {
  website?: string; facebook?: string; instagram?: string; line?: string;
  tiktok?: string; threads?: string; zalo?: string; youtube?: string; google_business?: string
}
interface Brand {
  name: string; slogan: string; tagline: string
  colors: { primary?: string; secondary?: string; accent?: string }
  platforms: BrandPlatforms
  fonts: string; tone: string; audience: string; selling_points: string
  banned_words: string; brand_story: string; logo_url: string
}
const empty = (): Brand => ({ name: '', slogan: '', tagline: '', colors: {}, platforms: {}, fonts: '', tone: '', audience: '', selling_points: '', banned_words: '', brand_story: '', logo_url: '' })
const inp = 'h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm'
const ta = 'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block text-sm"><span className="font-medium text-gray-700">{label}</span>{hint && <span className="ml-1.5 text-xs text-gray-400">{hint}</span>}<div className="mt-1">{children}</div></label>
}

export default function MarketingBrandPage() {
  const [b, setB] = useState<Brand | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/marketing/brand').then(async r => {
      if (r.status === 403) { setForbidden(true); return }
      const j = await r.json().catch(() => ({}))
      const d = j.brand
      setB(d ? { ...empty(), ...d, colors: d.colors ?? {}, platforms: d.platforms ?? {} } : empty())
    })
  }, [])

  async function save() {
    if (!b) return
    setSaving(true); setMsg('')
    const r = await fetch('/api/marketing/brand', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
    setSaving(false); setMsg(r.ok ? '✅ 已成功儲存！兩處（行銷中心與 OFFICE 行銷部門）已即時同步更新。' : '儲存失敗')
  }

  if (forbidden) return <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">需開通行銷模組才能使用</div>
  if (!b) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  const setColor = (k: 'primary' | 'secondary' | 'accent', v: string) => setB({ ...b, colors: { ...b.colors, [k]: v } })
  const setPlat = (k: keyof BrandPlatforms, v: string) => setB({ ...b, platforms: { ...b.platforms, [k]: v } })

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center"><Fingerprint className="h-5 w-5 text-indigo-600" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">品牌資料</h1>
          <p className="text-sm text-gray-500">品牌守則作為 AI 產出文案／圖／影片的依據，填得越完整，產出越一致</p>
        </div>
      </div>

      {/* 雙向同步提示 */}
      <div className="p-3 bg-indigo-50/70 border border-indigo-200/60 rounded-xl flex items-center justify-between gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-indigo-950">
            全公司統一品牌中樞資料：與 OFFICE 辦公系統（office.im-tourist.com）實時雙向同步。
          </span>
        </div>
        <span className="text-slate-500">任一邊設定即全站生效</span>
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="品牌名稱"><input value={b.name} onChange={e => setB({ ...b, name: e.target.value })} className={inp} /></Field>
          <Field label="標語 Slogan"><input value={b.slogan} onChange={e => setB({ ...b, slogan: e.target.value })} className={inp} /></Field>
        </div>
        <Field label="一句話定位 Tagline" hint="用一句話說明品牌是什麼"><input value={b.tagline} onChange={e => setB({ ...b, tagline: e.target.value })} className={inp} /></Field>
        <Field label="標準色" hint="主色／輔色／點綴色">
          <div className="flex flex-wrap gap-4">
            {(['primary', 'secondary', 'accent'] as const).map(k => (
              <div key={k} className="flex items-center gap-2">
                <input type="color" value={b.colors[k] || '#000000'} onChange={e => setColor(k, e.target.value)} className="h-9 w-12 rounded border border-gray-200 cursor-pointer" />
                <input value={b.colors[k] || ''} onChange={e => setColor(k, e.target.value)} placeholder={k} className={`${inp} w-28`} />
              </div>
            ))}
          </div>
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="字型規範"><input value={b.fonts} onChange={e => setB({ ...b, fonts: e.target.value })} className={inp} placeholder="標題／內文字型" /></Field>
          <Field label="Logo 連結"><input value={b.logo_url} onChange={e => setB({ ...b, logo_url: e.target.value })} className={inp} placeholder="https://" /></Field>
        </div>

        {/* 官方社群與數位通路平台 */}
        <div className="pt-2 border-t border-gray-100">
          <div className="mb-3">
            <span className="font-semibold text-gray-900 text-sm">官方社群與數位通路平台</span>
            <p className="text-xs text-gray-400 mt-0.5">全公司共用統一通路網址（OFFICE 門市後勤、業務手冊與行銷貼文自動引用）</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="官方網站" hint="官網網址"><input value={b.platforms?.website ?? ''} onChange={e => setPlat('website', e.target.value)} className={inp} placeholder="https://..." /></Field>
            <Field label="Facebook 粉專"><input value={b.platforms?.facebook ?? ''} onChange={e => setPlat('facebook', e.target.value)} className={inp} placeholder="https://facebook.com/..." /></Field>
            <Field label="Instagram"><input value={b.platforms?.instagram ?? ''} onChange={e => setPlat('instagram', e.target.value)} className={inp} placeholder="https://instagram.com/..." /></Field>
            <Field label="LINE 官方帳號"><input value={b.platforms?.line ?? ''} onChange={e => setPlat('line', e.target.value)} className={inp} placeholder="https://line.me/R/ti/p/..." /></Field>
            <Field label="TikTok"><input value={b.platforms?.tiktok ?? ''} onChange={e => setPlat('tiktok', e.target.value)} className={inp} placeholder="https://tiktok.com/@..." /></Field>
            <Field label="Threads"><input value={b.platforms?.threads ?? ''} onChange={e => setPlat('threads', e.target.value)} className={inp} placeholder="https://threads.net/@..." /></Field>
            <Field label="Zalo 官方帳號" hint="東南亞/越南"><input value={b.platforms?.zalo ?? ''} onChange={e => setPlat('zalo', e.target.value)} className={inp} placeholder="https://zalo.me/..." /></Field>
            <Field label="Google 商家主頁" hint="商家檔案"><input value={b.platforms?.google_business ?? ''} onChange={e => setPlat('google_business', e.target.value)} className={inp} placeholder="https://g.page/..." /></Field>
          </div>
        </div>

        <Field label="品牌語氣 Tone of Voice" hint="AI 寫文案的口吻"><textarea rows={2} className={ta} value={b.tone} onChange={e => setB({ ...b, tone: e.target.value })} placeholder="例：年輕、活潑、親切，多用口語與 emoji" /></Field>
        <Field label="目標客群"><textarea rows={2} className={ta} value={b.audience} onChange={e => setB({ ...b, audience: e.target.value })} placeholder="例：18–30 歲學生與上班族" /></Field>
        <Field label="產品特色／賣點"><textarea rows={3} className={ta} value={b.selling_points} onChange={e => setB({ ...b, selling_points: e.target.value })} placeholder="每行一個賣點" /></Field>
        <Field label="品牌故事"><textarea rows={3} className={ta} value={b.brand_story} onChange={e => setB({ ...b, brand_story: e.target.value })} /></Field>
        <Field label="禁用詞" hint="AI 產出時避免使用"><input value={b.banned_words} onChange={e => setB({ ...b, banned_words: e.target.value })} className={inp} placeholder="以逗號分隔" /></Field>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}儲存品牌檔
          </button>
          {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        </div>
      </div>
    </div>
  )
}
