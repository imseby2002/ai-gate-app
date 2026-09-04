'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, Megaphone, Palette, CalendarDays, Plus, Trash2, Pencil, X, Save, Sparkles, Check, RotateCcw, CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const selCls = 'h-9 rounded-md border border-input bg-transparent px-3 text-sm'
const ta = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm'
type Tab = 'brand' | 'generate' | 'calendar'

export default function MktPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('brand')

  useEffect(() => { fetch('/api/mkt/brand').then(r => setAllowed(r.status !== 403)) }, [])

  if (allowed === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅行銷單位可使用</p></div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Megaphone className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">品牌・行銷</h1>
          <p className="text-sm text-muted-foreground">品牌中樞、內容行事曆</p>
        </div>
        <div className="ml-auto"><Link href="/office"><Button variant="outline" size="sm">返回</Button></Link></div>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {([['brand', '品牌中樞', <Palette key="b" className="h-4 w-4" />], ['generate', '一鍵產出', <Sparkles key="g" className="h-4 w-4" />], ['calendar', '內容行事曆', <CalendarDays key="c" className="h-4 w-4" />]] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>{icon}{label}</button>
        ))}
      </div>

      {tab === 'brand' ? <BrandTab /> : tab === 'generate' ? <GenerateTab /> : <CalendarTab />}
    </div>
  )
}

// ─────────────────────── 品牌中樞 ───────────────────────
interface Brand {
  name: string; slogan: string; tagline: string
  colors: { primary?: string; secondary?: string; accent?: string }
  fonts: string; tone: string; audience: string; selling_points: string
  banned_words: string; brand_story: string; logo_url: string
}
const emptyBrand = (): Brand => ({ name: '', slogan: '', tagline: '', colors: {}, fonts: '', tone: '', audience: '', selling_points: '', banned_words: '', brand_story: '', logo_url: '' })

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>{hint && <span className="ml-1.5 text-xs text-muted-foreground">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}

function BrandTab() {
  const [b, setB] = useState<Brand | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/mkt/brand').then(async r => {
      const j = await r.json().catch(() => ({}))
      const d = j.brand
      setB(d ? { ...emptyBrand(), ...d, colors: d.colors ?? {} } : emptyBrand())
    })
  }, [])

  async function save() {
    if (!b) return
    setSaving(true); setMsg('')
    const r = await fetch('/api/mkt/brand', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
    setSaving(false)
    setMsg(r.ok ? '已儲存' : '儲存失敗')
  }

  if (!b) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  const setColor = (k: 'primary' | 'secondary' | 'accent', v: string) => setB({ ...b, colors: { ...b.colors, [k]: v } })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">品牌守則會作為後續 AI 產出文案／圖／影片的依據，填得越完整，產出品質越一致。</p>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="品牌名稱"><Input value={b.name} onChange={e => setB({ ...b, name: e.target.value })} /></Field>
          <Field label="標語 Slogan"><Input value={b.slogan} onChange={e => setB({ ...b, slogan: e.target.value })} /></Field>
        </div>
        <Field label="一句話定位 Tagline" hint="用一句話說明品牌是什麼"><Input value={b.tagline} onChange={e => setB({ ...b, tagline: e.target.value })} /></Field>

        <Field label="標準色" hint="品牌主色／輔色／點綴色">
          <div className="flex flex-wrap gap-4">
            {(['primary', 'secondary', 'accent'] as const).map(k => (
              <div key={k} className="flex items-center gap-2">
                <input type="color" value={b.colors[k] || '#000000'} onChange={e => setColor(k, e.target.value)} className="h-9 w-12 rounded border border-input bg-transparent cursor-pointer" />
                <Input value={b.colors[k] || ''} onChange={e => setColor(k, e.target.value)} placeholder={k} className="w-28" />
              </div>
            ))}
          </div>
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="字型規範"><Input value={b.fonts} onChange={e => setB({ ...b, fonts: e.target.value })} placeholder="標題／內文字型" /></Field>
          <Field label="Logo 連結"><Input value={b.logo_url} onChange={e => setB({ ...b, logo_url: e.target.value })} placeholder="https://" /></Field>
        </div>

        <Field label="品牌語氣 Tone of Voice" hint="AI 寫文案的口吻"><textarea rows={2} className={ta} value={b.tone} onChange={e => setB({ ...b, tone: e.target.value })} placeholder="例：年輕、活潑、親切，多用口語與 emoji" /></Field>
        <Field label="目標客群"><textarea rows={2} className={ta} value={b.audience} onChange={e => setB({ ...b, audience: e.target.value })} placeholder="例：18–30 歲學生與上班族" /></Field>
        <Field label="產品特色／賣點"><textarea rows={3} className={ta} value={b.selling_points} onChange={e => setB({ ...b, selling_points: e.target.value })} placeholder="每行一個賣點" /></Field>
        <Field label="品牌故事"><textarea rows={3} className={ta} value={b.brand_story} onChange={e => setB({ ...b, brand_story: e.target.value })} /></Field>
        <Field label="禁用詞" hint="AI 產出時避免使用"><Input value={b.banned_words} onChange={e => setB({ ...b, banned_words: e.target.value })} placeholder="以逗號分隔" /></Field>

        <div className="flex items-center gap-3 pt-1">
          <Button onClick={save} disabled={saving} className="gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}儲存品牌檔</Button>
          {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────── 一鍵產出 ───────────────────────
const GEN_CHANNELS: [string, string][] = [['fb', 'Facebook'], ['ig', 'Instagram'], ['tiktok', 'TikTok'], ['zalo', 'Zalo'], ['line', 'LINE']]
const CONTENT_STATUS_LABEL: Record<string, string> = { review: '待審核', approved: '已核准', scheduled: '已排程', published: '已發布', rejected: '退回' }
const CONTENT_STATUS_VARIANT: Record<string, 'warning' | 'success' | 'default' | 'secondary' | 'destructive'> = { review: 'warning', approved: 'success', scheduled: 'default', published: 'success', rejected: 'destructive' }
interface ContentRow { id: string; topic: string; channels: string[]; status: string; created_at: string }
interface ContentFull { id: string; topic: string; brief: string; channels: string[]; outputs: Record<string, any>; status: string; review_note: string }

function GenerateTab() {
  const [list, setList] = useState<ContentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [topic, setTopic] = useState('')
  const [brief, setBrief] = useState('')
  const [channels, setChannels] = useState<string[]>(['fb', 'ig'])
  const [generating, setGenerating] = useState(false)
  const [err, setErr] = useState('')
  const [detailId, setDetailId] = useState('')

  const loadList = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/mkt/content')
    const j = await r.json().catch(() => ({}))
    setList(j.items ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { loadList() }, [loadList])

  async function generate() {
    if (!topic.trim()) { setErr('主題必填'); return }
    setGenerating(true); setErr('')
    const r = await fetch('/api/mkt/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, brief, channels }) })
    const j = await r.json().catch(() => ({})); setGenerating(false)
    if (!r.ok) { setErr(j.error || '產出失敗'); return }
    setTopic(''); setBrief('')
    await loadList()
    setDetailId(j.id)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" />一鍵產出整套內容</div>
        <p className="text-xs text-muted-foreground">輸入主題／新品，AI 依品牌守則產出各平台文案＋短影片腳本＋圖片提示＋GEO 文章，進入「待審核」，核准後才發布。</p>
        <Field label="主題／新品 *"><Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="例：芋頭珍珠鮮奶新品上市" /></Field>
        <Field label="補充說明" hint="賣點、活動、優惠等"><textarea rows={2} className={ta} value={brief} onChange={e => setBrief(e.target.value)} /></Field>
        <div>
          <div className="text-sm font-medium mb-1.5">產出平台</div>
          <div className="flex flex-wrap gap-2">
            {GEN_CHANNELS.map(([k, label]) => {
              const on = channels.includes(k)
              return (
                <button key={k} type="button" onClick={() => setChannels(on ? channels.filter(x => x !== k) : [...channels, k])}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground hover:border-primary/50'}`}>{label}</button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={generate} disabled={generating} className="gap-1.5">{generating ? <><Loader2 className="h-4 w-4 animate-spin" />產出中（約 20–40 秒）</> : <><Sparkles className="h-4 w-4" />AI 產出整套</>}</Button>
          {err && <span className="text-sm text-red-500">{err}</span>}
        </div>
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : list.length === 0 ? <div className="text-center py-10 text-muted-foreground text-sm">尚無產出內容</div>
        : (
          <div className="space-y-2">
            {list.map(i => (
              <button key={i.id} onClick={() => setDetailId(i.id)} className="w-full text-left flex items-center gap-3 rounded-xl border bg-card px-4 py-3 hover:bg-muted/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{i.topic}</span>
                    <Badge variant={CONTENT_STATUS_VARIANT[i.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0">{CONTENT_STATUS_LABEL[i.status] ?? i.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{(i.channels ?? []).map(c => (GEN_CHANNELS.find(g => g[0] === c)?.[1] ?? c)).join('、')}　{i.created_at?.slice(0, 10)}</div>
                </div>
              </button>
            ))}
          </div>
        )}

      {detailId && <ContentDetail id={detailId} onClose={() => setDetailId('')} onChanged={loadList} />}
    </div>
  )
}

function ContentDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [item, setItem] = useState<ContentFull | null>(null)
  const [outputs, setOutputs] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/mkt/content?id=' + id).then(async r => {
      const j = await r.json().catch(() => ({}))
      if (j.item) { setItem(j.item); setOutputs(j.item.outputs ?? {}) }
    })
  }, [id])

  async function patch(body: Record<string, unknown>, tag: string) {
    setSaving(tag); setMsg('')
    const r = await fetch('/api/mkt/content', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) })
    setSaving('')
    if (r.ok) { setMsg('已更新'); onChanged() } else setMsg('失敗')
  }
  async function addToCalendar() {
    if (!item) return
    setSaving('cal')
    await fetch('/api/mkt/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: item.topic, channel: item.channels?.[0] ?? 'other', status: 'scheduled', note: '由一鍵產出核准' }) })
    setSaving(''); setMsg('已加入行事曆')
  }

  const setCh = (ch: string, field: string, v: string) => setOutputs(o => ({ ...o, [ch]: { ...(o[ch] ?? {}), [field]: v } }))
  const setGeo = (field: string, v: string) => setOutputs(o => ({ ...o, geo_article: { ...(o.geo_article ?? {}), [field]: v } }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-card p-5 shadow-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {!item ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : <>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold">{item.topic}</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Badge variant={CONTENT_STATUS_VARIANT[item.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0">{CONTENT_STATUS_LABEL[item.status] ?? item.status}</Badge>
            <span className="text-xs text-muted-foreground">審核後再發布</span>
          </div>

          {outputs._raw ? (
            <textarea rows={16} className={ta} value={outputs._raw} onChange={e => setOutputs({ _raw: e.target.value })} />
          ) : (
            <div className="space-y-4">
              {(item.channels ?? []).filter(c => outputs[c]).map(c => (
                <div key={c} className="space-y-1.5">
                  <div className="text-sm font-semibold">{GEN_CHANNELS.find(g => g[0] === c)?.[1] ?? c}</div>
                  <textarea rows={4} className={ta} value={outputs[c]?.copy ?? ''} onChange={e => setCh(c, 'copy', e.target.value)} />
                  <Input value={Array.isArray(outputs[c]?.hashtags) ? outputs[c].hashtags.join(' ') : (outputs[c]?.hashtags ?? '')}
                    onChange={e => setOutputs(o => ({ ...o, [c]: { ...(o[c] ?? {}), hashtags: e.target.value.split(/\s+/).filter(Boolean) } }))}
                    placeholder="hashtags" />
                </div>
              ))}
              {outputs.video_script !== undefined && (
                <div className="space-y-1.5"><div className="text-sm font-semibold">短影片腳本</div>
                  <textarea rows={5} className={ta} value={outputs.video_script ?? ''} onChange={e => setOutputs(o => ({ ...o, video_script: e.target.value }))} /></div>
              )}
              {outputs.image_prompt !== undefined && (
                <div className="space-y-1.5"><div className="text-sm font-semibold">圖片提示（生圖用）</div>
                  <textarea rows={2} className={ta} value={outputs.image_prompt ?? ''} onChange={e => setOutputs(o => ({ ...o, image_prompt: e.target.value }))} /></div>
              )}
              {outputs.geo_article !== undefined && (
                <div className="space-y-1.5"><div className="text-sm font-semibold">GEO 文章</div>
                  <Input value={outputs.geo_article?.title ?? ''} onChange={e => setGeo('title', e.target.value)} placeholder="標題" />
                  <textarea rows={8} className={ta} value={outputs.geo_article?.body ?? ''} onChange={e => setGeo('body', e.target.value)} /></div>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => patch({ outputs }, 'save')} disabled={!!saving} className="gap-1.5">{saving === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}儲存修改</Button>
            <Button size="sm" onClick={() => patch({ status: 'approved' }, 'ap')} disabled={!!saving} className="gap-1.5"><Check className="h-4 w-4" />核准</Button>
            <Button variant="outline" size="sm" onClick={() => patch({ status: 'rejected' }, 'rj')} disabled={!!saving} className="gap-1.5"><RotateCcw className="h-4 w-4" />退回</Button>
            <Button variant="outline" size="sm" onClick={addToCalendar} disabled={!!saving} className="gap-1.5"><CalendarPlus className="h-4 w-4" />加入行事曆</Button>
            {msg && <span className="text-sm text-emerald-600">{msg}</span>}
          </div>
        </>}
      </div>
    </div>
  )
}

// ─────────────────────── 內容行事曆 ───────────────────────
interface Item { id: string; title: string; channel: string; scheduled_date: string | null; status: string; note: string }
const CHANNEL_LABEL: Record<string, string> = { fb: 'Facebook', ig: 'Instagram', tiktok: 'TikTok', zalo: 'Zalo', line: 'LINE', store: '門市', other: '其他' }
const STATUS_LABEL: Record<string, string> = { idea: '構想', draft: '草稿', review: '待審核', scheduled: '已排程', published: '已發布' }
const STATUS_VARIANT: Record<string, 'secondary' | 'warning' | 'success' | 'default'> = { idea: 'secondary', draft: 'secondary', review: 'warning', scheduled: 'default', published: 'success' }

const blank = (): Partial<Item> => ({ title: '', channel: 'fb', scheduled_date: '', status: 'idea', note: '' })

function CalendarTab() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<Partial<Item> | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams(); if (status) sp.set('status', status)
    const r = await fetch('/api/mkt/calendar?' + sp.toString())
    const j = await r.json().catch(() => ({}))
    setItems(j.items ?? [])
    setLoading(false)
  }, [status])
  useEffect(() => { load() }, [load])

  async function save() {
    if (!editing) return
    if (!String(editing.title ?? '').trim()) { setErr('標題必填'); return }
    setSaving(true); setErr('')
    const method = editing.id ? 'PATCH' : 'POST'
    const r = await fetch('/api/mkt/calendar', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    const j = await r.json().catch(() => ({})); setSaving(false)
    if (!r.ok) { setErr(j.error || '儲存失敗'); return }
    setEditing(null); load()
  }
  async function del(id: string) {
    if (!confirm('確定刪除？')) return
    await fetch('/api/mkt/calendar', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => setStatus(e.target.value)} className={selCls}>
          <option value="">全部狀態</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => { setErr(''); setEditing(blank()) }}><Plus className="h-4 w-4" />新增內容</Button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : items.length === 0 ? <div className="text-center py-16 text-muted-foreground text-sm">尚無排程內容</div>
        : (
          <div className="space-y-2">
            {items.map(i => (
              <div key={i.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                <div className="text-center shrink-0 w-16">
                  <div className="text-xs text-muted-foreground">{i.scheduled_date ? i.scheduled_date.slice(5) : '未排'}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{i.title}</span>
                    <Badge variant={STATUS_VARIANT[i.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0">{STATUS_LABEL[i.status] ?? i.status}</Badge>
                    <span className="text-xs text-muted-foreground">{CHANNEL_LABEL[i.channel] ?? i.channel}</span>
                  </div>
                  {i.note && <p className="text-sm text-muted-foreground truncate">{i.note}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setErr(''); setEditing({ ...i, scheduled_date: i.scheduled_date ?? '' }) }} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(i.id)} className="p-1.5 rounded hover:bg-muted text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-xl bg-card p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing.id ? '編輯內容' : '新增內容'}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <Field label="標題 *"><Input value={editing.title ?? ''} onChange={e => setEditing({ ...editing, title: e.target.value })} /></Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="平台">
                  <select value={editing.channel ?? 'fb'} onChange={e => setEditing({ ...editing, channel: e.target.value })} className={`w-full ${selCls}`}>
                    {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="狀態">
                  <select value={editing.status ?? 'idea'} onChange={e => setEditing({ ...editing, status: e.target.value })} className={`w-full ${selCls}`}>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="排程日"><Input type="date" value={editing.scheduled_date ?? ''} onChange={e => setEditing({ ...editing, scheduled_date: e.target.value })} /></Field>
              </div>
              <Field label="備註"><textarea rows={3} className={ta} value={editing.note ?? ''} onChange={e => setEditing({ ...editing, note: e.target.value })} /></Field>
            </div>
            {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
              <Button onClick={save} disabled={saving} className="gap-1.5">{saving && <Loader2 className="h-4 w-4 animate-spin" />}儲存</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
