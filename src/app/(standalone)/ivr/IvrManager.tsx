'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Phone, Plus, Trash2, Loader2, PhoneOutgoing, Link as LinkIcon, X,
} from 'lucide-react'

type Channel = 'line' | 'whatsapp' | 'zalo'
type TargetType = 'personal' | 'group' | 'official'

type Mapping = {
  id?: string
  digit: string
  channel: Channel
  target_type: TargetType
  join_url: string
  label?: string | null
}
type Campaign = {
  id: string
  name: string
  voice_script: string | null
  is_active: boolean
  created_at: string
  mappings: Mapping[]
}

const CHANNELS: { v: Channel; label: string; color: string }[] = [
  { v: 'line', label: 'LINE', color: '#00B900' },
  { v: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
  { v: 'zalo', label: 'ZALO', color: '#0068FF' },
]
const TARGETS: { v: TargetType; label: string }[] = [
  { v: 'official', label: '官方帳號' },
  { v: 'group', label: '群組' },
  { v: 'personal', label: '個人' },
]

const emptyMapping = (): Mapping => ({ digit: '', channel: 'line', target_type: 'official', join_url: '', label: '' })

export function IvrManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  // 新增活動表單
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [voiceScript, setVoiceScript] = useState('')
  const [mappings, setMappings] = useState<Mapping[]>([emptyMapping()])
  const [saving, setSaving] = useState(false)

  // 外撥
  const [dialFor, setDialFor] = useState<string | null>(null)
  const [phones, setPhones] = useState('')
  const [dialing, setDialing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ivr/campaigns')
      const data = await res.json()
      setCampaigns(data.campaigns ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000) }

  async function createCampaign() {
    if (!name.trim()) return flash('請輸入活動名稱')
    const valid = mappings.filter((m) => m.digit && m.join_url)
    setSaving(true)
    try {
      const res = await fetch('/api/ivr/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), voice_script: voiceScript.trim() || null, mappings: valid }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        return flash('建立失敗：' + (e.error ?? res.status))
      }
      setName(''); setVoiceScript(''); setMappings([emptyMapping()]); setCreating(false)
      flash('已建立活動')
      load()
    } finally {
      setSaving(false)
    }
  }

  async function startCalls(campaignId: string) {
    const list = phones.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean)
    if (list.length === 0) return flash('請輸入至少一個號碼')
    setDialing(true)
    try {
      const res = await fetch('/api/ivr/calls/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, phones: list }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return flash('外撥失敗：' + (data.error ?? res.status))
      const dialed = (data.results ?? []).filter((r: { dialed: boolean }) => r.dialed).length
      flash(`已送出 ${list.length} 通，成功撥出 ${dialed} 通`)
      setPhones(''); setDialFor(null)
    } finally {
      setDialing(false)
    }
  }

  const updateMapping = (i: number, patch: Partial<Mapping>) =>
    setMappings((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)))

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center gap-3 mb-6">
          <Phone className="w-6 h-6 text-indigo-600" />
          <h1 className="text-xl font-semibold">電話行銷 — 按鍵加入社群</h1>
        </header>

        {msg && (
          <div className="mb-4 px-4 py-2 rounded bg-indigo-50 text-indigo-700 text-sm">{msg}</div>
        )}

        {/* 新增活動 */}
        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> 新增活動
          </button>
        ) : (
          <div className="mb-6 bg-white rounded-xl border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">新增活動</h2>
              <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="活動名稱"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            <textarea
              value={voiceScript} onChange={(e) => setVoiceScript(e.target.value)}
              placeholder="IVR 播報稿，例：加 LINE 請按 1，加 WhatsApp 請按 2，加 ZALO 請按 3"
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />

            <div className="space-y-2">
              <div className="text-sm text-gray-500">按鍵對應</div>
              {mappings.map((m, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    value={m.digit} onChange={(e) => updateMapping(i, { digit: e.target.value.replace(/\D/g, '').slice(0, 1) })}
                    placeholder="鍵" maxLength={1}
                    className="w-12 px-2 py-2 border rounded text-sm text-center"
                  />
                  <select value={m.channel} onChange={(e) => updateMapping(i, { channel: e.target.value as Channel })} className="px-2 py-2 border rounded text-sm">
                    {CHANNELS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                  </select>
                  <select value={m.target_type} onChange={(e) => updateMapping(i, { target_type: e.target.value as TargetType })} className="px-2 py-2 border rounded text-sm">
                    {TARGETS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                  </select>
                  <input
                    value={m.join_url} onChange={(e) => updateMapping(i, { join_url: e.target.value })}
                    placeholder="加入連結 https://..."
                    className="flex-1 min-w-[180px] px-2 py-2 border rounded text-sm"
                  />
                  {mappings.length > 1 && (
                    <button onClick={() => setMappings((ms) => ms.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
              <button onClick={() => setMappings((ms) => [...ms, emptyMapping()])} className="text-indigo-600 text-sm inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> 增加按鍵
              </button>
            </div>

            <button
              onClick={createCampaign} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 建立
            </button>
          </div>
        )}

        {/* 活動列表 */}
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> 載入中…</div>
        ) : campaigns.length === 0 ? (
          <div className="text-gray-400 text-sm">尚無活動</div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    {c.voice_script && <div className="text-sm text-gray-500 mt-1">{c.voice_script}</div>}
                  </div>
                  <button
                    onClick={() => { setDialFor(dialFor === c.id ? null : c.id); setPhones('') }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                  >
                    <PhoneOutgoing className="w-4 h-4" /> 外撥
                  </button>
                </div>

                {c.mappings.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.mappings.sort((a, b) => a.digit.localeCompare(b.digit)).map((m) => {
                      const ch = CHANNELS.find((x) => x.v === m.channel)
                      return (
                        <span key={m.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border" style={{ borderColor: ch?.color }}>
                          <span className="font-mono font-semibold">{m.digit}</span>
                          <span style={{ color: ch?.color }}>{ch?.label}</span>
                          <span className="text-gray-400">{TARGETS.find((t) => t.v === m.target_type)?.label}</span>
                          <LinkIcon className="w-3 h-3 text-gray-300" />
                        </span>
                      )
                    })}
                  </div>
                )}

                {dialFor === c.id && (
                  <div className="mt-4 border-t pt-4 space-y-2">
                    <textarea
                      value={phones} onChange={(e) => setPhones(e.target.value)}
                      placeholder="貼上電話號碼，每行一個或以逗號分隔"
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                    <button
                      onClick={() => startCalls(c.id)} disabled={dialing}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {dialing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneOutgoing className="w-4 h-4" />} 開始外撥
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
