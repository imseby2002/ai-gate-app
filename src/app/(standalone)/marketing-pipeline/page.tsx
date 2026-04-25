'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Search, Building2, BarChart3, PenLine, Image as ImageIcon,
  Film, Video, Upload, Phone, Mic, Headphones,
  Play, Pause, RotateCcw, CheckCircle2, AlertCircle,
  Loader2, Bell, BellOff, ChevronRight, Settings2,
  MessageSquare, Zap, ArrowLeft, Clock, Calendar,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped' | 'waiting'

interface PipelineStepDef {
  unitId: number
  name: string
  icon: React.ElementType
  desc: string
  canAuto: boolean   // false = manual required (Unit 2)
  configKey: string  // which config section
}

interface StepRun {
  unitId: number
  status: StepStatus
  output: string
  startedAt?: string
  doneAt?: string
}

interface PipelineSchedule {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  hour: number
  minute: number
  weekday: number    // 0=Sun … 6=Sat
  monthDay: number   // 1-31
  nextRunAt?: string
  lastRunAt?: string
}

interface PipelineConfig {
  steps: { unitId: number; enabled: boolean; notify: boolean }[]
  schedule: PipelineSchedule
  // Unit 1
  u1_types: string[]
  u1_subOptions: Record<string, string[]>
  u1_keywords: string
  u1_location: string
  u1_shopeeCountry: string
  u1_appIds: string
  u1_alertRssUrls: string
  // Unit 3-11 (same as before)
  u3_types: string[]
  u4_copyTypes: string[]
  u4_instructions: string
  u5_count: number
  u5_platforms: string[]
  u6_model: string
  u6_size: string
  u6_count: number
  u7_count: number
  u7_duration: number
  u8_model: string
  u9_platforms: string[]
  u10_phones: string
  u10_voiceId: string
  u10_callerId: string
  u11_avatarId: string
  u11_voiceId: string
}

interface Campaign {
  id: string
  title: string
  unit_data: Record<string, unknown>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_DEFS: PipelineStepDef[] = [
  { unitId: 1,  name: '蒐集資訊',  icon: Search,     desc: '新聞/網頁/地圖/評論',  canAuto: true,  configKey: 'u1' },
  { unitId: 2,  name: '公司資料',  icon: Building2,  desc: '請預先在行銷自動化填寫', canAuto: false, configKey: '' },
  { unitId: 3,  name: '分析資料',  icon: BarChart3,  desc: 'SWOT/競爭對手/市場',  canAuto: true,  configKey: 'u3' },
  { unitId: 4,  name: '文案產出',  icon: PenLine,    desc: '多平台行銷文案',       canAuto: true,  configKey: 'u4' },
  { unitId: 5,  name: '圖片腳本',  icon: ImageIcon,  desc: '視覺腳本生成',        canAuto: true,  configKey: 'u5' },
  { unitId: 6,  name: '圖片產出',  icon: ImageIcon,  desc: 'AI 圖片生成',        canAuto: true,  configKey: 'u6' },
  { unitId: 7,  name: '影片腳本',  icon: Film,       desc: '分鏡腳本生成',        canAuto: true,  configKey: 'u7' },
  { unitId: 8,  name: '影片產出',  icon: Video,      desc: 'AI 影片生成',        canAuto: true,  configKey: 'u8' },
  { unitId: 9,  name: '上傳平台',  icon: Upload,     desc: '自動上傳各平台',       canAuto: true,  configKey: 'u9' },
  { unitId: 10, name: '電話行銷',  icon: Phone,      desc: '批次語音電話',        canAuto: true,  configKey: 'u10' },
  { unitId: 11, name: '主播行銷',  icon: Mic,        desc: 'HeyGen 主播影片',     canAuto: true,  configKey: 'u11' },
  { unitId: 12, name: '客服系統',  icon: Headphones, desc: '設定後自動運行',       canAuto: false, configKey: '' },
]

const DEFAULT_SCHEDULE: PipelineSchedule = {
  enabled: false,
  frequency: 'weekly',
  hour: 8,
  minute: 0,
  weekday: 1,
  monthDay: 1,
}

const DEFAULT_CONFIG: PipelineConfig = {
  steps: STEP_DEFS.map(s => ({ unitId: s.unitId, enabled: s.canAuto, notify: [4, 6, 8, 9, 10, 11].includes(s.unitId) })),
  schedule: DEFAULT_SCHEDULE,
  u1_types: ['web'],
  u1_subOptions: {},
  u1_keywords: '',
  u1_location: '',
  u1_shopeeCountry: 'tw',
  u1_appIds: '',
  u1_alertRssUrls: '',
  u3_types: ['swot', 'company', 'marketing'],
  u4_copyTypes: ['facebook_post', 'instagram_caption', 'line_message'],
  u4_instructions: '',
  u5_count: 3,
  u5_platforms: ['instagram', 'facebook'],
  u6_model: 'flux',
  u6_size: '1:1',
  u6_count: 2,
  u7_count: 2,
  u7_duration: 30,
  u8_model: 'kling-standard',
  u9_platforms: [],
  u10_phones: '',
  u10_voiceId: 'EXAVITQu4vr4xnSDxMaL',
  u10_callerId: '',
  u11_avatarId: '',
  u11_voiceId: '',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const LS_CONFIG_KEY = 'aigate_pipeline_config'
const LS_CAMPAIGN_KEY = 'aigate_pipeline_campaignId'

function loadConfigFromLS(): PipelineConfig {
  try {
    const raw = localStorage.getItem(LS_CONFIG_KEY)
    if (!raw) return DEFAULT_CONFIG
    const parsed = JSON.parse(raw) as Partial<PipelineConfig>
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch { return DEFAULT_CONFIG }
}

export default function MarketingPipelinePage() {
  const supabase = createClient()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignId, setCampaignId] = useState<string>('')
  const [campaignData, setCampaignData] = useState<Record<string, unknown>>({})

  const [config, setConfig] = useState<PipelineConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_CONFIG
    return loadConfigFromLS()
  })
  const [tab, setTab] = useState<'config' | 'run'>('config')

  // Run state
  const [isRunning, setIsRunning] = useState(false)
  const [stepRuns, setStepRuns] = useState<StepRun[]>([])
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [runLog, setRunLog] = useState<string[]>([])
  const [waitingUnitId, setWaitingUnitId] = useState<number | null>(null)

  const confirmRef = useRef<(() => void) | null>(null)
  const abortRef = useRef(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  // ── Auto-save config to localStorage on change ───────────────────────────
  useEffect(() => {
    try { localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config)) } catch { /* ignore */ }
  }, [config])

  // ── Load campaigns ───────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('marketing_campaigns').select('id, title, unit_data')
      .order('updated_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!data) return
        setCampaigns(data as Campaign[])
        // Restore last selected campaign
        const lastId = localStorage.getItem(LS_CAMPAIGN_KEY)
        if (lastId && data.find(c => c.id === lastId)) {
          const c = data.find(c => c.id === lastId)!
          setCampaignId(lastId)
          setCampaignData(c.unit_data ?? {})
        }
      })
  }, [])

  const loadCampaign = useCallback((id: string) => {
    const c = campaigns.find(c => c.id === id)
    if (c) {
      setCampaignId(id)
      setCampaignData(c.unit_data ?? {})
      try { localStorage.setItem(LS_CAMPAIGN_KEY, id) } catch { /* ignore */ }
    }
  }, [campaigns])

  // Scroll log to bottom
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [runLog])

  // ── Config helpers ───────────────────────────────────────────────────────
  const setStepEnabled = (unitId: number, enabled: boolean) =>
    setConfig(c => ({ ...c, steps: c.steps.map(s => s.unitId === unitId ? { ...s, enabled } : s) }))

  const setStepNotify = (unitId: number, notify: boolean) =>
    setConfig(c => ({ ...c, steps: c.steps.map(s => s.unitId === unitId ? { ...s, notify } : s) }))

  // ── Save unit data to DB ─────────────────────────────────────────────────
  const saveUnit = useCallback(async (unitId: number, data: unknown) => {
    if (!campaignId) return
    // Re-read latest unit_data then merge
    const { data: row } = await supabase.from('marketing_campaigns').select('unit_data').eq('id', campaignId).single()
    const prev = (row?.unit_data ?? {}) as Record<string, unknown>
    await supabase.from('marketing_campaigns').update({ unit_data: { ...prev, [unitId]: data } }).eq('id', campaignId)
    setCampaignData(p => ({ ...p, [unitId]: data }))
  }, [campaignId, supabase])

  // ── Telegram notify ──────────────────────────────────────────────────────
  const sendTelegram = useCallback(async (msg: string) => {
    try {
      await fetch('/api/marketing/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
    } catch (_) { /* silent */ }
  }, [])

  // ── Log helper ───────────────────────────────────────────────────────────
  const log = useCallback((msg: string) =>
    setRunLog(p => [...p, `[${new Date().toLocaleTimeString('zh-TW')}] ${msg}`])
  , [])

  const updateStep = useCallback((unitId: number, status: StepStatus, output = '') =>
    setStepRuns(p => p.map(s => s.unitId === unitId ? { ...s, status, output, ...(status === 'running' ? { startedAt: new Date().toISOString() } : status === 'done' || status === 'error' ? { doneAt: new Date().toISOString() } : {}) } : s))
  , [])

  // ── Wait for confirmation ────────────────────────────────────────────────
  const waitConfirm = useCallback((unitId: number): Promise<void> =>
    new Promise(resolve => {
      setWaitingUnitId(unitId)
      confirmRef.current = () => { setWaitingUnitId(null); resolve() }
    })
  , [])

  function handleConfirm() { confirmRef.current?.(); confirmRef.current = null }

  // ── Safe JSON fetch ──────────────────────────────────────────────────────
  async function safeFetch(url: string, init: RequestInit): Promise<{ res: Response; data: Record<string, unknown> }> {
    try {
      const res = await fetch(url, init)
      let data: Record<string, unknown> = {}
      try {
        const text = await res.text()
        data = text ? JSON.parse(text) : {}
      } catch (parseErr) {
        data = { error: String(parseErr) }
      }
      return { res, data }
    } catch (networkErr) {
      return { res: new Response(null, { status: 503 }), data: { error: String(networkErr) } }
    }
  }

  // ── Unit runners ─────────────────────────────────────────────────────────
  const runUnit = useCallback(async (unitId: number, ud: Record<string, unknown>): Promise<{ ok: boolean; output: string; data?: unknown }> => {
    const u1d = ud[1] as { summary?: string } | undefined
    const u2d = ud[2] as Record<string, unknown> | undefined
    const u3d = ud[3] as { summary?: string } | undefined
    const u4d = ud[4] as { copies?: unknown[] } | undefined
    const u5d = ud[5] as { scripts?: unknown[] } | undefined
    const u6d = ud[6] as { images?: Array<{ url?: string }> } | undefined

    if (unitId === 1) {
      const { res, data } = await safeFetch('/api/marketing/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          types: config.u1_types,
          keywords: config.u1_keywords,
          location: config.u1_location,
          limit: 8,
          subOptions: config.u1_subOptions,
          shopeeCountry: config.u1_shopeeCountry,
          appIds: config.u1_appIds.split('\n').map(s => s.trim()).filter(Boolean),
          alertRssUrls: config.u1_alertRssUrls.split('\n').map(s => s.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) return { ok: false, output: String(data.error ?? '蒐集失敗') }
      return { ok: true, output: `蒐集完成 · ${String(data.summary ?? '').slice(0, 100)}…`, data }
    }

    if (unitId === 3) {
      const { res, data } = await safeFetch('/api/marketing/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types: config.u3_types, collectedData: u1d?.summary, companyData: u2d }),
      })
      if (!res.ok) return { ok: false, output: String(data.error ?? '分析失敗') }
      return { ok: true, output: `分析完成 · 類型：${config.u3_types.join('、')}`, data }
    }

    if (unitId === 4) {
      const { res, data } = await safeFetch('/api/marketing/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copyTypes: config.u4_copyTypes,
          userInstructions: config.u4_instructions,
          companyData: u2d,
          analysisData: u3d,
          collectedSummary: u1d?.summary,
        }),
      })
      if (!res.ok) return { ok: false, output: String(data.error ?? '文案生成失敗') }
      const count = (data.copies as unknown[])?.length ?? 0
      return { ok: true, output: `文案完成 · 生成 ${count} 份`, data }
    }

    if (unitId === 5) {
      const { res, data } = await safeFetch('/api/marketing/image-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: config.u5_count,
          platforms: config.u5_platforms,
          companyData: u2d,
          analysisData: u3d,
          copyData: u4d,
          collectedSummary: u1d?.summary,
        }),
      })
      if (!res.ok) return { ok: false, output: String(data.error ?? '圖片腳本失敗') }
      return { ok: true, output: `圖片腳本完成 · ${(data.scripts as unknown[])?.length ?? 0} 份`, data }
    }

    if (unitId === 6) {
      const scripts = (u5d?.scripts ?? []) as string[]
      if (scripts.length === 0) return { ok: false, output: '無圖片腳本，請先執行單元 5' }
      const toGenerate = scripts.slice(0, config.u6_count)
      const images: { url: string; prompt: string }[] = []
      for (const prompt of toGenerate) {
        if (abortRef.current) break
        const { res, data } = await safeFetch('/api/marketing/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, model: config.u6_model, size: config.u6_size, campaignId }),
        })
        if (res.ok && data.imageUrl) images.push({ url: String(data.imageUrl), prompt: prompt.slice(0, 60) })
      }
      return { ok: true, output: `圖片生成完成 · ${images.length} 張`, data: { images } }
    }

    if (unitId === 7) {
      const { res, data } = await safeFetch('/api/marketing/video-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: config.u7_count,
          duration: config.u7_duration,
          videoTypes: ['brand_story'],
          platforms: ['youtube', 'facebook'],
          companyData: u2d,
          analysisData: u3d,
          copyData: u4d,
          collectedSummary: u1d?.summary,
        }),
      })
      if (!res.ok) return { ok: false, output: String(data.error ?? '影片腳本失敗') }
      return { ok: true, output: `影片腳本完成 · ${(data.scripts as unknown[])?.length ?? 0} 份`, data }
    }

    if (unitId === 8) {
      const scripts = (ud[7] as { scripts?: string[] } | undefined)?.scripts ?? []
      if (scripts.length === 0) return { ok: false, output: '無影片腳本，請先執行單元 7' }
      const prompt = scripts[0].slice(0, 500)
      const { res: submitRes, data: submit } = await safeFetch('/api/marketing/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.u8_model, prompt }),
      })
      if (!submitRes.ok) return { ok: false, output: String(submit.error ?? '影片提交失敗') }
      const requestId = submit.requestId
      // Poll up to 10 min
      for (let i = 0; i < 75; i++) {
        if (abortRef.current) return { ok: false, output: '已中止' }
        await new Promise(r => setTimeout(r, 8000))
        const { data: poll } = await safeFetch(`/api/marketing/generate-video?requestId=${requestId}&model=${config.u8_model}&campaignId=${campaignId}`, {})
        if (poll.status === 'completed' && poll.videoUrl) {
          return { ok: true, output: `影片生成完成`, data: { videos: [{ url: poll.videoUrl, model: config.u8_model }] } }
        }
        if (poll.status === 'failed') return { ok: false, output: '影片生成失敗' }
      }
      return { ok: false, output: '影片生成逾時（10分鐘）' }
    }

    if (unitId === 9) {
      if (config.u9_platforms.length === 0) return { ok: false, output: '請選擇上傳平台' }
      const images = u6d?.images?.map(i => i.url).filter(Boolean) ?? []
      const copies = u4d?.copies ?? []
      const { res, data } = await safeFetch('/api/marketing/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, platforms: config.u9_platforms, copies, images }),
      })
      if (!res.ok) return { ok: false, output: String(data.error ?? '上傳失敗') }
      return { ok: true, output: `上傳完成 · ${config.u9_platforms.join('、')}`, data }
    }

    if (unitId === 10) {
      const phones = config.u10_phones.split('\n').map(p => p.trim()).filter(Boolean)
      if (phones.length === 0) return { ok: false, output: '請填入電話號碼清單' }
      const copies = u4d?.copies as Array<{ body?: string }> | undefined
      const script = copies?.[0]?.body ?? '您好，感謝您對我們產品的關注。'
      const { res, data } = await safeFetch('/api/marketing/phone-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batch', phones, script, voiceId: config.u10_voiceId, birdCallerId: config.u10_callerId }),
      })
      if (!res.ok) return { ok: false, output: String(data.error ?? '撥打失敗') }
      return { ok: true, output: `電話行銷完成 · ${data.success}/${data.total} 成功`, data }
    }

    if (unitId === 11) {
      if (!config.u11_avatarId || !config.u11_voiceId) return { ok: false, output: '請先設定 HeyGen Avatar & Voice ID' }
      const copies = u4d?.copies as Array<{ body?: string }> | undefined
      const script = copies?.[0]?.body?.slice(0, 500) ?? '您好，歡迎使用 AI GATE 行銷自動化！'
      const { res: submitRes, data: submit } = await safeFetch('/api/marketing/heygen-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarId: config.u11_avatarId, voiceId: config.u11_voiceId, script }),
      })
      if (!submitRes.ok) return { ok: false, output: String(submit.error ?? 'HeyGen 提交失敗') }
      const videoId = submit.videoId
      for (let i = 0; i < 75; i++) {
        if (abortRef.current) return { ok: false, output: '已中止' }
        await new Promise(r => setTimeout(r, 8000))
        const { data: poll } = await safeFetch(`/api/marketing/heygen-avatar?videoId=${videoId}`, {})
        if (poll.status === 'completed') return { ok: true, output: `主播影片完成`, data: { videos: [{ videoId, videoUrl: poll.videoUrl }] } }
        if (poll.status === 'failed') return { ok: false, output: '主播影片生成失敗' }
      }
      return { ok: false, output: 'HeyGen 逾時' }
    }

    return { ok: false, output: `Unit ${unitId} 不支援自動執行` }
  }, [config, campaignId])

  // ── Start pipeline ───────────────────────────────────────────────────────
  const startPipeline = useCallback(async () => {
    if (!campaignId) { alert('請先選擇活動'); return }
    abortRef.current = false
    const enabled = config.steps.filter(s => s.enabled && STEP_DEFS.find(d => d.unitId === s.unitId)?.canAuto)
    const initialRuns: StepRun[] = enabled.map(s => ({ unitId: s.unitId, status: 'pending', output: '' }))
    setStepRuns(initialRuns)
    setRunLog([])
    setCurrentIdx(0)
    setIsRunning(true)
    setTab('run')

    let ud = { ...campaignData }

    for (let i = 0; i < enabled.length; i++) {
      if (abortRef.current) break
      const stepCfg = enabled[i]
      const def = STEP_DEFS.find(d => d.unitId === stepCfg.unitId)!
      setCurrentIdx(i)
      updateStep(stepCfg.unitId, 'running')
      log(`▶ 開始執行：${def.name}`)

      try {
        const result = await runUnit(stepCfg.unitId, ud)
        if (result.data) {
          await saveUnit(stepCfg.unitId, result.data)
          ud = { ...ud, [stepCfg.unitId]: result.data }
        }

        if (!result.ok) {
          updateStep(stepCfg.unitId, 'error', result.output)
          log(`✗ ${def.name} 失敗：${result.output}`)
          break
        }

        log(`✓ ${def.name} 完成：${result.output}`)

        if (stepCfg.notify) {
          updateStep(stepCfg.unitId, 'waiting', result.output)
          const notifyMsg = `✅ AI GATE 流程更新\n\n步驟完成：${def.name}\n結果：${result.output}\n\n請返回 AI GATE 確認並點擊「繼續」繼續下一步。`
          await sendTelegram(notifyMsg)
          log(`🔔 已發送 Telegram 通知，等待確認…`)
          await waitConfirm(stepCfg.unitId)
          log(`→ 已確認，繼續執行`)
        }

        updateStep(stepCfg.unitId, 'done', result.output)
      } catch (e) {
        updateStep(stepCfg.unitId, 'error', String(e))
        log(`✗ ${def.name} 發生錯誤：${String(e)}`)
        break
      }
    }

    setIsRunning(false)
    setCurrentIdx(-1)
    log(`── 流程結束 ──`)
  }, [campaignId, config, campaignData, runUnit, saveUnit, sendTelegram, updateStep, waitConfirm, log])

  function stopPipeline() { abortRef.current = true; setIsRunning(false); log('⏹ 已手動停止') }

  // ── Enabled steps for display ────────────────────────────────────────────
  const enabledSteps = config.steps.filter(s => {
    const def = STEP_DEFS.find(d => d.unitId === s.unitId)
    return s.enabled && def?.canAuto
  })

  const campaign = campaigns.find(c => c.id === campaignId)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── Left: Step Selector ─────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <a href="/marketing-auto" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-3">
            <ArrowLeft className="h-3.5 w-3.5" /> 返回行銷自動化
          </a>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h1 className="font-bold text-sm text-gray-800">自動化流程</h1>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">勾選步驟，一鍵全自動執行</p>
        </div>

        {/* Campaign selector */}
        <div className="p-3 border-b">
          <label className="text-[10px] text-gray-500 block mb-1">活動</label>
          <select value={campaignId} onChange={e => loadCampaign(e.target.value)}
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
            <option value="">— 選擇活動 —</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          {campaignId && (
            <div className="text-[10px] text-gray-400 mt-1">
              {Object.keys(campaignData).filter(k => !isNaN(Number(k))).length} 個單元已有資料
            </div>
          )}
        </div>

        {/* Step list */}
        <div className="flex-1 overflow-y-auto py-2">
          {STEP_DEFS.map(def => {
            const stepCfg = config.steps.find(s => s.unitId === def.unitId)!
            const Icon = def.icon
            const run = stepRuns.find(r => r.unitId === def.unitId)
            return (
              <div key={def.unitId}
                className={`flex items-center gap-2 px-3 py-2 ${!def.canAuto ? 'opacity-40' : ''}`}>
                {def.canAuto
                  ? <input type="checkbox" checked={stepCfg.enabled} onChange={e => setStepEnabled(def.unitId, e.target.checked)}
                      className="rounded accent-amber-500 shrink-0" />
                  : <div className="w-4 h-4 shrink-0" />
                }
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  run?.status === 'done' ? 'bg-green-100' : run?.status === 'error' ? 'bg-red-100' : run?.status === 'running' ? 'bg-blue-100' : run?.status === 'waiting' ? 'bg-amber-100' : 'bg-gray-100'
                }`}>
                  {run?.status === 'done'    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> :
                   run?.status === 'error'   ? <AlertCircle  className="h-3.5 w-3.5 text-red-500" /> :
                   run?.status === 'running' ? <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" /> :
                   run?.status === 'waiting' ? <Bell className="h-3.5 w-3.5 text-amber-500" /> :
                   <Icon className="h-3.5 w-3.5 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-700 truncate">{def.unitId}. {def.name}</div>
                  <div className="text-[10px] text-gray-400 truncate">{def.desc}</div>
                </div>
                {def.canAuto && stepCfg.enabled && (
                  <button onClick={() => setStepNotify(def.unitId, !stepCfg.notify)}
                    title={stepCfg.notify ? '通知後繼續' : '自動繼續'}
                    className={`shrink-0 p-1 rounded ${stepCfg.notify ? 'text-amber-500' : 'text-gray-300'}`}>
                    {stepCfg.notify ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="p-3 border-t text-[10px] text-gray-400 space-y-1">
          <div className="flex items-center gap-1.5"><Bell className="h-3 w-3 text-amber-400" /> 通知並等待確認</div>
          <div className="flex items-center gap-1.5"><BellOff className="h-3 w-3 text-gray-300" /> 完成後自動繼續</div>
        </div>
      </aside>

      {/* ── Right: Config + Run ──────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white border-b px-6 py-3 flex items-center gap-3">
          <div className="flex gap-2">
            <button onClick={() => setTab('config')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === 'config' ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              style={tab === 'config' ? { background: 'var(--primary)' } : {}}>
              <Settings2 className="h-3.5 w-3.5 inline mr-1" />配置
            </button>
            <button onClick={() => setTab('run')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === 'run' ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              style={tab === 'run' ? { background: 'var(--primary)' } : {}}>
              <Play className="h-3.5 w-3.5 inline mr-1" />執行
            </button>
          </div>
          <div className="flex-1 text-xs text-gray-400">
            {campaign ? `活動：${campaign.title}` : '請先選擇活動'}
            {enabledSteps.length > 0 && ` · ${enabledSteps.length} 個步驟已啟用`}
          </div>
          <div className="flex gap-2">
            {isRunning
              ? <button onClick={stopPipeline}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-500">
                  <Pause className="h-4 w-4" />停止
                </button>
              : <button onClick={startPipeline} disabled={!campaignId || enabledSteps.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40 shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                  <Zap className="h-4 w-4" />開始自動執行
                </button>
            }
            {stepRuns.length > 0 && !isRunning && (
              <button onClick={() => { setStepRuns([]); setRunLog([]); setCurrentIdx(-1) }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-500 bg-gray-100 hover:bg-gray-200">
                <RotateCcw className="h-3.5 w-3.5" />重置
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Config Tab ──────────────────────────────────────────────── */}
          {tab === 'config' && (
            <div className="p-6 max-w-2xl space-y-5">

              {/* ── Schedule Section ───────────────────────────────────── */}
              <div className="border-2 border-amber-200 rounded-xl p-4 bg-amber-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="font-bold text-sm text-amber-800">定時自動執行</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-amber-700">{config.schedule.enabled ? '已啟用' : '已停用'}</span>
                    <div
                      onClick={() => setConfig(c => ({ ...c, schedule: { ...c.schedule, enabled: !c.schedule.enabled } }))}
                      className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${config.schedule.enabled ? 'bg-amber-500' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.schedule.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                  </label>
                </div>

                {config.schedule.enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-amber-700 block mb-1">頻率</label>
                      <select value={config.schedule.frequency}
                        onChange={e => setConfig(c => ({ ...c, schedule: { ...c.schedule, frequency: e.target.value as 'daily'|'weekly'|'monthly' } }))}
                        className="w-full text-sm border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                        <option value="daily">每日</option>
                        <option value="weekly">每週</option>
                        <option value="monthly">每月</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-amber-700 block mb-1">執行時間</label>
                      <div className="flex gap-1.5">
                        <select value={config.schedule.hour}
                          onChange={e => setConfig(c => ({ ...c, schedule: { ...c.schedule, hour: Number(e.target.value) } }))}
                          className="flex-1 text-sm border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                          {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}時</option>)}
                        </select>
                        <select value={config.schedule.minute}
                          onChange={e => setConfig(c => ({ ...c, schedule: { ...c.schedule, minute: Number(e.target.value) } }))}
                          className="w-20 text-sm border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                          <option value={0}>00分</option>
                          <option value={30}>30分</option>
                        </select>
                      </div>
                    </div>
                    {config.schedule.frequency === 'weekly' && (
                      <div>
                        <label className="text-xs text-amber-700 block mb-1">星期幾</label>
                        <select value={config.schedule.weekday}
                          onChange={e => setConfig(c => ({ ...c, schedule: { ...c.schedule, weekday: Number(e.target.value) } }))}
                          className="w-full text-sm border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                          {['日','一','二','三','四','五','六'].map((d, i) => <option key={i} value={i}>星期{d}</option>)}
                        </select>
                      </div>
                    )}
                    {config.schedule.frequency === 'monthly' && (
                      <div>
                        <label className="text-xs text-amber-700 block mb-1">每月第幾日</label>
                        <input type="number" min={1} max={28} value={config.schedule.monthDay}
                          onChange={e => setConfig(c => ({ ...c, schedule: { ...c.schedule, monthDay: Number(e.target.value) } }))}
                          className="w-full text-sm border border-amber-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                      </div>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-amber-600">
                  排程由 Vercel Cron 每小時檢查，自動執行已勾選的單元。需設定 Vercel 環境變數：
                  <code className="bg-amber-100 px-1 rounded ml-1">CRON_SECRET</code>
                  <code className="bg-amber-100 px-1 rounded ml-1">NEXT_PUBLIC_APP_URL</code>
                  <span className="ml-1">（Vercel Pro 支援每小時，Free 每日一次）</span>
                </p>
                {config.schedule.enabled && campaignId && (
                  <button onClick={async () => {
                    const { data: row } = await supabase.from('marketing_campaigns').select('unit_data').eq('id', campaignId).single()
                    const prev = (row?.unit_data ?? {}) as Record<string, unknown>
                    const scheduleToSave = {
                      ...config.schedule,
                      steps: config.steps,
                      config: {
                        u1_types: config.u1_types, u1_keywords: config.u1_keywords,
                        u1_subOptions: config.u1_subOptions, u1_location: config.u1_location,
                        u1_shopeeCountry: config.u1_shopeeCountry,
                        u1_appIds: config.u1_appIds.split('\n').filter(Boolean),
                        u1_alertRssUrls: config.u1_alertRssUrls.split('\n').filter(Boolean),
                        u3_types: config.u3_types, u4_copyTypes: config.u4_copyTypes, u4_instructions: config.u4_instructions,
                        u5_count: config.u5_count, u5_platforms: config.u5_platforms,
                        u6_model: config.u6_model, u6_size: config.u6_size, u6_count: config.u6_count,
                        u7_count: config.u7_count, u7_duration: config.u7_duration, u8_model: config.u8_model,
                        u9_platforms: config.u9_platforms, u10_phones: config.u10_phones,
                        u10_voiceId: config.u10_voiceId, u10_callerId: config.u10_callerId,
                        u11_avatarId: config.u11_avatarId, u11_voiceId: config.u11_voiceId,
                      },
                    }
                    await supabase.from('marketing_campaigns').update({ unit_data: { ...prev, _schedule: scheduleToSave } }).eq('id', campaignId)
                    alert('排程已儲存！')
                  }}
                    className="w-full py-2 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                    <Calendar className="h-4 w-4" />儲存排程設定
                  </button>
                )}
              </div>

              <ConfigSection title="單元 1 · 蒐集資訊" enabled={config.steps.find(s => s.unitId === 1)?.enabled ?? false}>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">搜尋關鍵字</label>
                    <input value={config.u1_keywords} onChange={e => setConfig(c => ({ ...c, u1_keywords: e.target.value }))}
                      placeholder="例：AI 行銷、競爭對手名稱"
                      className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">蒐集管道（點選後可設定子項目）</label>
                    <div className="space-y-1">
                      {[
                        { id: 'map',         emoji: '🗺️', label: '地圖搜尋',       subs: [{ id: 'info', l: '基本資訊' }, { id: 'coordinates', l: '距離' }, { id: 'reviews', l: '評論' }, { id: 'hours', l: '營業時間' }] },
                        { id: 'tiktok',      emoji: '📱', label: 'TikTok',         subs: [{ id: 'videos', l: '影音' }, { id: 'comments', l: '評論' }] },
                        { id: 'facebook',    emoji: '👥', label: 'Facebook',        subs: [{ id: 'posts', l: '內文' }, { id: 'comments', l: '評論' }] },
                        { id: 'instagram',   emoji: '📸', label: 'Instagram',       subs: [{ id: 'posts', l: '內文' }, { id: 'comments', l: '評論' }] },
                        { id: 'threads',     emoji: '🧵', label: 'Threads',         subs: [{ id: 'posts', l: '內文' }, { id: 'comments', l: '評論' }] },
                        { id: 'youtube',     emoji: '🎬', label: 'YouTube',         subs: [{ id: 'shorts', l: '短影音' }, { id: 'videos', l: '長影音' }, { id: 'comments', l: '評論' }] },
                        { id: 'amazon',      emoji: '📦', label: 'Amazon',          subs: [{ id: 'products', l: '產品' }, { id: 'reviews', l: '評論' }] },
                        { id: 'shopee',      emoji: '🛒', label: 'Shopee',          subs: [{ id: 'products', l: '產品' }, { id: 'reviews', l: '評論' }] },
                        { id: 'ios_android', emoji: '📲', label: 'iOS/Android',     subs: [{ id: 'reviews', l: '評論' }] },
                        { id: 'news',        emoji: '🔔', label: '新聞搜尋',        subs: [] },
                        { id: 'web',         emoji: '🌐', label: '網頁搜尋',        subs: [] },
                        { id: 'competitors', emoji: '🎯', label: '競爭對手',        subs: [] },
                      ].map(t => {
                        const on = config.u1_types.includes(t.id)
                        const curSubs: string[] = (config.u1_subOptions[t.id] ?? t.subs.map(s => s.id))
                        return (
                          <div key={t.id} className={`rounded-lg border overflow-hidden transition-all ${on ? 'border-amber-400' : 'border-gray-200'}`}>
                            <label className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer ${on ? 'bg-amber-50' : 'bg-white'}`}>
                              <input type="checkbox" className="rounded accent-amber-500"
                                checked={on}
                                onChange={e => {
                                  const next = e.target.checked ? [...config.u1_types, t.id] : config.u1_types.filter(x => x !== t.id)
                                  const nextSubs = e.target.checked && t.subs.length > 0 && !config.u1_subOptions[t.id]
                                    ? { ...config.u1_subOptions, [t.id]: t.subs.map(s => s.id) }
                                    : config.u1_subOptions
                                  setConfig(c => ({ ...c, u1_types: next, u1_subOptions: nextSubs }))
                                }} />
                              <span className="text-sm">{t.emoji} {t.label}</span>
                            </label>
                            {on && t.subs.length > 0 && (
                              <div className="flex flex-wrap gap-3 px-3 py-1.5 border-t border-amber-100 bg-amber-50/50">
                                {t.subs.map(s => (
                                  <label key={s.id} className="flex items-center gap-1 text-xs cursor-pointer">
                                    <input type="checkbox" className="rounded accent-amber-500"
                                      checked={curSubs.includes(s.id)}
                                      onChange={e => {
                                        const next = e.target.checked ? [...curSubs, s.id] : curSubs.filter(x => x !== s.id)
                                        setConfig(c => ({ ...c, u1_subOptions: { ...c.u1_subOptions, [t.id]: next } }))
                                      }} />
                                    {s.l}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {config.u1_types.includes('map') && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">🗺️ 地點（地圖搜尋用）</label>
                      <input value={config.u1_location} onChange={e => setConfig(c => ({ ...c, u1_location: e.target.value }))}
                        placeholder="例：台北市信義區"
                        className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    </div>
                  )}
                  {config.u1_types.includes('shopee') && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">🛒 Shopee 國家</label>
                      <select value={config.u1_shopeeCountry} onChange={e => setConfig(c => ({ ...c, u1_shopeeCountry: e.target.value }))}
                        className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300">
                        {[
                          { code: 'tw', label: '🇹🇼 台灣' }, { code: 'vn', label: '🇻🇳 越南' },
                          { code: 'id', label: '🇮🇩 印尼' }, { code: 'ph', label: '🇵🇭 菲律賓' },
                          { code: 'my', label: '🇲🇾 馬來西亞' }, { code: 'th', label: '🇹🇭 泰國' },
                          { code: 'sg', label: '🇸🇬 新加坡' }, { code: 'br', label: '🇧🇷 巴西' },
                        ].map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                    </div>
                  )}
                  {config.u1_types.includes('ios_android') && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">📲 App ID（App Store / Google Play，每行一個）</label>
                      <textarea value={config.u1_appIds} onChange={e => setConfig(c => ({ ...c, u1_appIds: e.target.value }))}
                        rows={2} placeholder={'id1234567890\ncom.example.app'}
                        className="w-full text-xs border rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    </div>
                  )}
                  {config.u1_types.includes('news') && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">🔔 Google Alerts RSS URL（每行一個）</label>
                      <textarea value={config.u1_alertRssUrls} onChange={e => setConfig(c => ({ ...c, u1_alertRssUrls: e.target.value }))}
                        rows={3} placeholder={'https://www.google.com/alerts/feeds/XXXXX/XXXXX\nhttps://...'}
                        className="w-full text-xs border rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300" />
                      <p className="text-[10px] text-gray-400 mt-0.5">至 google.com/alerts → 管理 → 訂閱 → RSS feed → 複製 URL</p>
                    </div>
                  )}
                </div>
              </ConfigSection>

              <ConfigSection title="單元 2 · 公司資料" enabled={false} note="請至「行銷自動化」→「公司資料」預先填寫" />

              <ConfigSection title="單元 3 · 分析資料" enabled={config.steps.find(s => s.unitId === 3)?.enabled ?? false}>
                <div className="flex flex-wrap gap-2">
                  {[['swot','SWOT分析'],['company','公司分析'],['competitor_activity','競爭動態'],['content','內容分析'],['marketing','行銷策略']].map(([v, label]) => (
                    <label key={v} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" className="rounded accent-amber-500"
                        checked={config.u3_types.includes(v)}
                        onChange={e => setConfig(c => ({ ...c, u3_types: e.target.checked ? [...c.u3_types, v] : c.u3_types.filter(t => t !== v) }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </ConfigSection>

              <ConfigSection title="單元 4 · 文案產出" enabled={config.steps.find(s => s.unitId === 4)?.enabled ?? false}>
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 block">文案類型</label>
                  <div className="flex flex-wrap gap-2">
                    {[['facebook_post','FB貼文'],['instagram_caption','IG說明'],['line_message','LINE訊息'],['youtube_description','YouTube說明'],['email','Email']].map(([v, label]) => (
                      <label key={v} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" className="rounded accent-amber-500"
                          checked={config.u4_copyTypes.includes(v)}
                          onChange={e => setConfig(c => ({ ...c, u4_copyTypes: e.target.checked ? [...c.u4_copyTypes, v] : c.u4_copyTypes.filter(t => t !== v) }))} />
                        {label}
                      </label>
                    ))}
                  </div>
                  <input value={config.u4_instructions} onChange={e => setConfig(c => ({ ...c, u4_instructions: e.target.value }))}
                    placeholder="補充指示（選填）"
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </ConfigSection>

              <ConfigSection title="單元 5 · 圖片腳本" enabled={config.steps.find(s => s.unitId === 5)?.enabled ?? false}>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">數量</label>
                    <input type="number" min={1} max={8} value={config.u5_count}
                      onChange={e => setConfig(c => ({ ...c, u5_count: Number(e.target.value) }))}
                      className="w-20 text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  </div>
                </div>
              </ConfigSection>

              <ConfigSection title="單元 6 · 圖片產出" enabled={config.steps.find(s => s.unitId === 6)?.enabled ?? false}>
                <div className="flex gap-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">模型</label>
                    <select value={config.u6_model} onChange={e => setConfig(c => ({ ...c, u6_model: e.target.value }))}
                      className="text-sm border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                      <option value="flux">FLUX Dev</option>
                      <option value="dalle3">DALL-E 3</option>
                      <option value="nano">Nano (快)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">尺寸</label>
                    <select value={config.u6_size} onChange={e => setConfig(c => ({ ...c, u6_size: e.target.value }))}
                      className="text-sm border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                      <option value="1:1">1:1</option>
                      <option value="16:9">16:9</option>
                      <option value="9:16">9:16</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">張數</label>
                    <input type="number" min={1} max={6} value={config.u6_count}
                      onChange={e => setConfig(c => ({ ...c, u6_count: Number(e.target.value) }))}
                      className="w-16 text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  </div>
                </div>
              </ConfigSection>

              <ConfigSection title="單元 7 · 影片腳本" enabled={config.steps.find(s => s.unitId === 7)?.enabled ?? false}>
                <div className="flex gap-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">份數</label>
                    <input type="number" min={1} max={4} value={config.u7_count}
                      onChange={e => setConfig(c => ({ ...c, u7_count: Number(e.target.value) }))}
                      className="w-20 text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">時長（秒）</label>
                    <select value={config.u7_duration} onChange={e => setConfig(c => ({ ...c, u7_duration: Number(e.target.value) }))}
                      className="text-sm border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                      <option value={15}>15秒</option>
                      <option value={30}>30秒</option>
                      <option value={60}>60秒</option>
                      <option value={90}>90秒</option>
                    </select>
                  </div>
                </div>
              </ConfigSection>

              <ConfigSection title="單元 8 · 影片產出" enabled={config.steps.find(s => s.unitId === 8)?.enabled ?? false}>
                <select value={config.u8_model} onChange={e => setConfig(c => ({ ...c, u8_model: e.target.value }))}
                  className="text-sm border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                  <option value="kling-standard">KLING Standard</option>
                  <option value="kling-pro">KLING Pro</option>
                </select>
              </ConfigSection>

              <ConfigSection title="單元 9 · 上傳平台" enabled={config.steps.find(s => s.unitId === 9)?.enabled ?? false}>
                <div className="flex flex-wrap gap-2">
                  {[['facebook','Facebook'],['instagram','Instagram'],['youtube','YouTube'],['line','LINE'],['twitter','X/Twitter']].map(([v, label]) => (
                    <label key={v} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" className="rounded accent-amber-500"
                        checked={config.u9_platforms.includes(v)}
                        onChange={e => setConfig(c => ({ ...c, u9_platforms: e.target.checked ? [...c.u9_platforms, v] : c.u9_platforms.filter(p => p !== v) }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </ConfigSection>

              <ConfigSection title="單元 10 · 電話行銷" enabled={config.steps.find(s => s.unitId === 10)?.enabled ?? false}>
                <div className="space-y-2">
                  <textarea value={config.u10_phones}
                    onChange={e => setConfig(c => ({ ...c, u10_phones: e.target.value }))}
                    rows={4} placeholder={'+886912345678\n+84901234567\n...'}
                    className="w-full text-sm border rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  <input value={config.u10_callerId}
                    onChange={e => setConfig(c => ({ ...c, u10_callerId: e.target.value }))}
                    placeholder="Bird 顯示號碼 (e.g. +886...)"
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  <select value={config.u10_voiceId} onChange={e => setConfig(c => ({ ...c, u10_voiceId: e.target.value }))}
                    className="w-full text-sm border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                    <option value="EXAVITQu4vr4xnSDxMaL">Sarah — 多語言，女</option>
                    <option value="TX3LPaxmHKxFdv7VOQHJ">Liam — 多語言，男</option>
                    <option value="XB0fDUnXU5powFXDhCwa">Charlotte — 多語言，女</option>
                    <option value="pFZP5JQG7iQjIQuC4Bku">Lily — 多語言，女</option>
                  </select>
                </div>
              </ConfigSection>

              <ConfigSection title="單元 11 · 主播行銷" enabled={config.steps.find(s => s.unitId === 11)?.enabled ?? false}>
                <div className="space-y-2">
                  <input value={config.u11_avatarId}
                    onChange={e => setConfig(c => ({ ...c, u11_avatarId: e.target.value }))}
                    placeholder="HeyGen Avatar ID"
                    className="w-full text-sm border rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  <input value={config.u11_voiceId}
                    onChange={e => setConfig(c => ({ ...c, u11_voiceId: e.target.value }))}
                    placeholder="HeyGen Voice ID"
                    className="w-full text-sm border rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  <p className="text-[10px] text-gray-400">可至「行銷自動化 → 主播行銷」載入主播清單後查看 ID</p>
                </div>
              </ConfigSection>
            </div>
          )}

          {/* ── Run Tab ─────────────────────────────────────────────────── */}
          {tab === 'run' && (
            <div className="flex h-full">

              {/* Stepper */}
              <div className="w-56 shrink-0 border-r bg-white overflow-y-auto py-4">
                {enabledSteps.length === 0
                  ? <p className="text-xs text-gray-400 text-center py-8 px-4">請勾選步驟後點擊「開始自動執行」</p>
                  : enabledSteps.map((stepCfg, i) => {
                    const def = STEP_DEFS.find(d => d.unitId === stepCfg.unitId)!
                    const run = stepRuns.find(r => r.unitId === stepCfg.unitId)
                    const Icon = def.icon
                    const isCurrent = i === currentIdx
                    return (
                      <div key={stepCfg.unitId} className="flex items-start gap-2 px-3 py-2.5">
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                            run?.status === 'done'    ? 'border-green-400 bg-green-50' :
                            run?.status === 'error'   ? 'border-red-400 bg-red-50' :
                            run?.status === 'running' ? 'border-blue-400 bg-blue-50' :
                            run?.status === 'waiting' ? 'border-amber-400 bg-amber-50' :
                            isCurrent                 ? 'border-blue-300 bg-blue-50' :
                                                        'border-gray-200 bg-gray-50'
                          }`}>
                            {run?.status === 'done'    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> :
                             run?.status === 'error'   ? <AlertCircle  className="h-3.5 w-3.5 text-red-500" /> :
                             run?.status === 'running' ? <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" /> :
                             run?.status === 'waiting' ? <Bell className="h-3.5 w-3.5 text-amber-500" /> :
                             <Icon className="h-3.5 w-3.5 text-gray-400" />}
                          </div>
                          {i < enabledSteps.length - 1 && (
                            <div className={`w-0.5 h-4 ${run?.status === 'done' ? 'bg-green-300' : 'bg-gray-200'}`} />
                          )}
                        </div>
                        <div className="min-w-0 pb-2">
                          <div className={`text-xs font-medium ${isCurrent ? 'text-blue-600' : 'text-gray-700'}`}>{def.name}</div>
                          {run?.output && <div className="text-[10px] text-gray-400 truncate mt-0.5">{run.output}</div>}
                          {stepCfg.notify && <div className="flex items-center gap-1 mt-0.5"><Bell className="h-2.5 w-2.5 text-amber-400" /><span className="text-[10px] text-amber-500">通知</span></div>}
                        </div>
                      </div>
                    )
                  })
                }
              </div>

              {/* Log + Confirm */}
              <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">

                {/* Waiting confirmation banner */}
                {waitingUnitId !== null && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-amber-500 shrink-0" />
                      <div>
                        <div className="font-bold text-sm text-amber-800">
                          {STEP_DEFS.find(d => d.unitId === waitingUnitId)?.name} 已完成
                        </div>
                        <div className="text-xs text-amber-600 mt-0.5">
                          已發送 Telegram 通知。確認結果後點擊繼續。
                        </div>
                      </div>
                    </div>
                    <button onClick={handleConfirm}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white whitespace-nowrap"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                      <ChevronRight className="h-4 w-4" />確認繼續
                    </button>
                  </div>
                )}

                {/* Console log */}
                <div className="flex-1 bg-gray-900 rounded-xl p-4 overflow-y-auto font-mono text-xs">
                  {runLog.length === 0
                    ? <div className="text-gray-500 text-center pt-16">點擊「開始自動執行」啟動流程</div>
                    : runLog.map((line, i) => (
                        <div key={i} className={`leading-relaxed ${
                          line.includes('✗') ? 'text-red-400' :
                          line.includes('✓') ? 'text-green-400' :
                          line.includes('🔔') ? 'text-amber-400' :
                          line.includes('▶') ? 'text-blue-400' :
                          line.includes('⏹') || line.includes('──') ? 'text-gray-500' :
                          'text-gray-300'
                        }`}>{line}</div>
                      ))
                  }
                  <div ref={logEndRef} />
                </div>

                {/* Stats */}
                {stepRuns.length > 0 && (
                  <div className="flex gap-4 text-xs text-gray-500 shrink-0">
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />{stepRuns.filter(r => r.status === 'done').length} 完成</span>
                    <span className="flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 text-red-400" />{stepRuns.filter(r => r.status === 'error').length} 失敗</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5 text-gray-400" />{stepRuns.filter(r => r.status === 'pending').length} 待執行</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ─── ConfigSection helper ─────────────────────────────────────────────────────

function ConfigSection({ title, enabled, note, children }: {
  title: string
  enabled: boolean
  note?: string
  children?: React.ReactNode
}) {
  return (
    <div className={`border rounded-xl p-4 space-y-3 transition-opacity ${!enabled ? 'opacity-40' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm text-gray-700">{title}</span>
        {!enabled && <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{note ?? '未啟用'}</span>}
      </div>
      {enabled && children}
      {!enabled && note && <p className="text-xs text-gray-400">{note}</p>}
    </div>
  )
}
