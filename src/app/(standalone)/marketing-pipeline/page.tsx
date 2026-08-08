'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { PlanGate } from '@/components/marketing/PlanGate'
import {
  Search, Building2, BarChart3, PenLine, Image as ImageIcon,
  Film, Video, Upload, Phone, Mic, Headphones,
  Play, Pause, RotateCcw, CheckCircle2, AlertCircle,
  Loader2, Bell, BellOff, ChevronRight,
  MessageSquare, Zap, ArrowLeft, Clock, Link2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped' | 'waiting'

interface PipelineStepDef {
  unitId: number
  nameKey: string
  icon: React.ElementType
  descKey: string
  canAuto: boolean
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
  weekday: number
  monthDay: number
}

interface PipelineConfig {
  activityName: string
  steps: { unitId: number; enabled: boolean; notify: boolean }[]
  schedule: PipelineSchedule
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_DEFS: PipelineStepDef[] = [
  { unitId: 1,  nameKey: 'steps.1.name',  icon: Search,     descKey: 'steps.1.desc',  canAuto: true  },
  { unitId: 2,  nameKey: 'steps.2.name',  icon: Building2,  descKey: 'steps.2.desc',  canAuto: false },
  { unitId: 3,  nameKey: 'steps.3.name',  icon: BarChart3,  descKey: 'steps.3.desc',  canAuto: true  },
  { unitId: 4,  nameKey: 'steps.4.name',  icon: PenLine,    descKey: 'steps.4.desc',  canAuto: true  },
  { unitId: 5,  nameKey: 'steps.5.name',  icon: ImageIcon,  descKey: 'steps.5.desc',  canAuto: true  },
  { unitId: 6,  nameKey: 'steps.6.name',  icon: ImageIcon,  descKey: 'steps.6.desc',  canAuto: true  },
  { unitId: 7,  nameKey: 'steps.7.name',  icon: Film,       descKey: 'steps.7.desc',  canAuto: true  },
  { unitId: 8,  nameKey: 'steps.8.name',  icon: Video,      descKey: 'steps.8.desc',  canAuto: true  },
  { unitId: 9,  nameKey: 'steps.9.name',  icon: Upload,     descKey: 'steps.9.desc',  canAuto: true  },
  { unitId: 10, nameKey: 'steps.10.name', icon: Phone,      descKey: 'steps.10.desc', canAuto: true  },
  { unitId: 11, nameKey: 'steps.11.name', icon: Mic,        descKey: 'steps.11.desc', canAuto: true  },
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
  activityName: '自動化流程',
  steps: STEP_DEFS.map(s => ({ unitId: s.unitId, enabled: s.canAuto, notify: [4, 6, 8, 9, 10, 11].includes(s.unitId) })),
  schedule: DEFAULT_SCHEDULE,
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const LS_CONFIG_KEY  = 'aigate_pipeline_config_v2'
const LS_RESULTS_KEY = 'aigate_pipeline_results'

function loadConfigFromLS(): PipelineConfig {
  try {
    const raw = localStorage.getItem(LS_CONFIG_KEY)
    if (!raw) return DEFAULT_CONFIG
    const parsed = JSON.parse(raw) as Partial<PipelineConfig>
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch { return DEFAULT_CONFIG }
}

function loadResultsFromLS(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(LS_RESULTS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export default function MarketingPipelinePage() {
  return (
    <PlanGate
      allowed={info => info.features.marketingPipeline === true}
      featureName="行銷流水線"
      requiredPlan="TEAM 以上"
    >
      <MarketingPipelineContent />
    </PlanGate>
  )
}

function MarketingPipelineContent() {
  const t = useTranslations('Pipeline')
  const locale = useLocale()
  const searchParams = useSearchParams()

  const [campaignData, setCampaignData] = useState<Record<string, unknown>>(() => {
    if (typeof window === 'undefined') return {}
    return loadResultsFromLS()
  })

  const [config, setConfig] = useState<PipelineConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_CONFIG
    return loadConfigFromLS()
  })

  const [showSchedule, setShowSchedule] = useState(false)

  // Source campaign (linked from marketing-auto)
  const [sourceCampaign, setSourceCampaign] = useState<{ id: string; title: string; loadedUnits: number[] } | null>(null)
  const [loadingCampaign, setLoadingCampaign] = useState(false)

  // Run state
  const [isRunning, setIsRunning] = useState(false)
  const [stepRuns, setStepRuns] = useState<StepRun[]>([])
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [runLog, setRunLog] = useState<string[]>([])
  const [waitingUnitId, setWaitingUnitId] = useState<number | null>(null)
  const [telegramApprovalId, setTelegramApprovalId] = useState<string | null>(null)

  const confirmRef = useRef<(() => void) | null>(null)
  const abortRef = useRef(false)
  const logEndRef = useRef<HTMLDivElement>(null)
  const pendingFeedbackRef = useRef<string | null>(null)

  // Auto-save config
  useEffect(() => {
    try { localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config)) } catch { /* ignore */ }
  }, [config])

  // Load from campaign when ?campaign=xxx is present
  useEffect(() => {
    const campaignId = searchParams.get('campaign')
    if (!campaignId) return

    const load = async () => {
      setLoadingCampaign(true)
      try {
        const [campaignRes, companyRes] = await Promise.all([
          fetch(`/api/marketing/campaign/${campaignId}`),
          fetch('/api/marketing/company-data'),
        ])
        if (!campaignRes.ok) return

        const { campaign } = await campaignRes.json()
        const companyJson = companyRes.ok ? await companyRes.json() : {}

        const unitData: Record<string, unknown> = { ...(campaign.unit_data ?? {}) }
        if (companyJson.data) unitData['2'] = companyJson.data

        const loadedUnits = Object.keys(unitData)
          .map(Number)
          .filter(n => !isNaN(n) && unitData[String(n)])

        setCampaignData(prev => {
          const merged = { ...prev }
          for (const [k, v] of Object.entries(unitData)) {
            if (v != null) merged[k] = v
          }
          try { localStorage.setItem(LS_RESULTS_KEY, JSON.stringify(merged)) } catch { /* ignore */ }
          return merged
        })

        setConfig(prev => ({
          ...prev,
          activityName: campaign.title ?? prev.activityName,
        }))

        setSourceCampaign({ id: campaignId, title: campaign.title ?? t('untitledCampaign'), loadedUnits })
      } catch { /* ignore */ } finally {
        setLoadingCampaign(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [runLog])

  const setStepEnabled = (unitId: number, enabled: boolean) =>
    setConfig(c => ({ ...c, steps: c.steps.map(s => s.unitId === unitId ? { ...s, enabled } : s) }))

  const setStepNotify = (unitId: number, notify: boolean) =>
    setConfig(c => ({ ...c, steps: c.steps.map(s => s.unitId === unitId ? { ...s, notify } : s) }))

  const saveUnit = useCallback(async (unitId: number, data: unknown) => {
    setCampaignData(prev => {
      const next = { ...prev, [unitId]: data }
      try { localStorage.setItem(LS_RESULTS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const sendTelegramApproval = useCallback(async (msg: string, context?: object): Promise<string | null> => {
    try {
      const res = await fetch('/api/marketing/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, withApprovalButtons: true, context }),
      })
      const data = await res.json()
      return data.approvalId ?? null
    } catch { return null }
  }, [])

  const log = useCallback((msg: string) =>
    setRunLog(p => [...p, `[${new Date().toLocaleTimeString(locale)}] ${msg}`])
  , [locale])

  const updateStep = useCallback((unitId: number, status: StepStatus, output = '') =>
    setStepRuns(p => p.map(s => s.unitId === unitId ? { ...s, status, output,
      ...(status === 'running' ? { startedAt: new Date().toISOString() } :
         (status === 'done' || status === 'error') ? { doneAt: new Date().toISOString() } : {})
    } : s))
  , [])

  const waitConfirm = useCallback((unitId: number, approvalId?: string): Promise<void> =>
    new Promise(resolve => {
      setWaitingUnitId(unitId)
      setTelegramApprovalId(approvalId ?? null)
      confirmRef.current = () => {
        setWaitingUnitId(null)
        setTelegramApprovalId(null)
        resolve()
      }
    })
  , [])

  function handleConfirm() { confirmRef.current?.(); confirmRef.current = null }

  // Poll Telegram
  useEffect(() => {
    if (!telegramApprovalId) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/marketing/telegram-poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approvalId: telegramApprovalId }),
        })
        const data = await res.json()
        if (data.action === 'approved' || data.action === 'rejected' || data.action === 'feedback') {
          if (data.feedback) pendingFeedbackRef.current = data.feedback
          confirmRef.current?.()
          confirmRef.current = null
        }
      } catch { /* silent */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [telegramApprovalId])

  async function safeFetch(url: string, init: RequestInit): Promise<{ res: Response; data: Record<string, unknown> }> {
    try {
      const res = await fetch(url, init)
      let data: Record<string, unknown> = {}
      try { const text = await res.text(); data = text ? JSON.parse(text) : {} } catch (e) { data = { error: String(e) } }
      return { res, data }
    } catch (e) {
      return { res: new Response(null, { status: 503 }), data: { error: String(e) } }
    }
  }

  // ── Unit runners — all settings derived from campaign data ────────────────
  const runUnit = useCallback(async (unitId: number, ud: Record<string, unknown>): Promise<{ ok: boolean; output: string; data?: unknown }> => {
    // Pre-loaded data → skip re-execution (units 1–8)
    const SKIPPABLE = [1, 3, 4, 5, 6, 7, 8]
    if (SKIPPABLE.includes(unitId) && ud[unitId] != null) {
      return { ok: true, output: t('out.loadedSkip'), data: ud[unitId] }
    }

    // Extract context from campaign data
    const u2d  = ud[2]  as Record<string, string>  | undefined
    const u1d  = ud[1]  as { summary?: string }     | undefined
    const u3d  = ud[3]  as { summary?: string; results?: Record<string, string> } | undefined
    const u4d  = ud[4]  as { results?: Record<string, string>; types?: string[] } | undefined
    const u5d  = ud[5]  as { scripts?: string[] }   | undefined
    const u6d  = ud[6]  as { images?: Array<{ url?: string }> } | undefined
    const u9d  = ud[9]  as { lastUpload?: { platforms?: string[] }; platforms?: string[] } | undefined
    const u10d = ud[10] as { phones?: string[]; voiceId?: string; callerId?: string } | undefined
    const u11d = ud[11] as { avatarId?: string; voiceId?: string } | undefined

    // Derived defaults from company data
    const companyKeyword = u2d?.companyName ?? u2d?.name ?? ''
    const collectKeywords = companyKeyword

    if (unitId === 1) {
      const { res, data } = await safeFetch('/api/marketing/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          types: ['web', 'news'],
          keywords: collectKeywords,
          limit: 8,
        }),
      })
      if (!res.ok) return { ok: false, output: String(data.error ?? t('out.collectFailed')) }
      return { ok: true, output: `${t('out.collectDone')} · ${String(data.summary ?? '').slice(0, 100)}…`, data }
    }

    if (unitId === 3) {
      const { res, data } = await safeFetch('/api/marketing/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          types: ['swot', 'company', 'marketing'],
          collectedData: u1d?.summary,
          companyData: u2d,
        }),
      })
      if (!res.ok) return { ok: false, output: String(data.error ?? t('out.analyzeFailed', { status: res.status })) }

      // Run consumer simulation alongside analysis
      let simulation = null
      try {
        const { res: simRes, data: simData } = await safeFetch('/api/marketing/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyData: u2d,
            collectedData: u1d?.summary ?? '',
            analysisData: data,
            personaCount: 10,
          }),
        })
        if (simRes.ok) simulation = simData
      } catch { /* simulation failure is non-fatal */ }

      return {
        ok: true,
        output: `${t('out.analyzeDone')}${simulation ? ` · ${t('out.simDone')}` : ''}`,
        data: { ...data, simulation },
      }
    }

    if (unitId === 4) {
      const copyTypes = u4d?.types ?? ['facebook_post', 'instagram_caption', 'line_message']
      const { res, data } = await safeFetch('/api/marketing/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copyTypes, companyData: u2d, analysisData: u3d, collectedSummary: u1d?.summary }),
      })
      if (!res.ok) return { ok: false, output: String(data.error ?? t('out.copyFailed')) }
      const count = data.results ? Object.keys(data.results as object).length : 0
      return { ok: true, output: t('out.copyDone', { count }), data }
    }

    if (unitId === 5) {
      const { res, data } = await safeFetch('/api/marketing/image-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 3, platforms: ['instagram', 'facebook'], companyData: u2d, analysisData: u3d, copyData: u4d, collectedSummary: u1d?.summary }),
      })
      if (!res.ok) return { ok: false, output: String(data.error ?? t('out.imgScriptFailed')) }
      return { ok: true, output: t('out.imgScriptDone', { count: (data.scripts as unknown[])?.length ?? 0 }), data }
    }

    if (unitId === 6) {
      const scripts = (u5d?.scripts ?? []) as string[]
      if (scripts.length === 0) return { ok: false, output: t('out.noImgScript') }
      const images: { url: string; prompt: string }[] = []
      for (const prompt of scripts.slice(0, 2)) {
        if (abortRef.current) break
        const { res, data } = await safeFetch('/api/marketing/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, model: 'flux', size: '1:1' }),
        })
        if (res.ok && data.imageUrl) images.push({ url: String(data.imageUrl), prompt: prompt.slice(0, 60) })
      }
      return { ok: true, output: t('out.imgDone', { count: images.length }), data: { images } }
    }

    if (unitId === 7) {
      const { res, data } = await safeFetch('/api/marketing/video-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 1, duration: 30, videoTypes: ['brand_story'], platforms: ['youtube', 'facebook'], companyData: u2d, analysisData: u3d, copyData: u4d, collectedSummary: u1d?.summary }),
      })
      if (!res.ok) return { ok: false, output: String(data.error ?? t('out.videoScriptFailed')) }
      return { ok: true, output: t('out.videoScriptDone', { count: (data.scripts as unknown[])?.length ?? 0 }), data }
    }

    if (unitId === 8) {
      const scriptObjs = (ud[7] as { scripts?: { id: number; content: string }[] } | undefined)?.scripts ?? []
      if (scriptObjs.length === 0) return { ok: false, output: t('out.noVideoScript') }
      const prompt = scriptObjs[0].content.slice(0, 500)
      const { res: submitRes, data: submit } = await safeFetch('/api/marketing/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'kling-standard', prompt }),
      })
      if (!submitRes.ok) return { ok: false, output: String(submit.error ?? t('out.videoSubmitFailed')) }
      for (let i = 0; i < 75; i++) {
        if (abortRef.current) return { ok: false, output: t('out.aborted') }
        await new Promise(r => setTimeout(r, 8000))
        const { data: poll } = await safeFetch(`/api/marketing/generate-video?requestId=${submit.requestId}&model=kling-standard`, {})
        if (poll.status === 'completed' && poll.videoUrl) return { ok: true, output: t('out.videoDone'), data: { videos: [{ url: poll.videoUrl }] } }
        if (poll.status === 'failed') return { ok: false, output: t('out.videoFailed') }
      }
      return { ok: false, output: t('out.videoTimeout') }
    }

    if (unitId === 9) {
      const allPlatforms = u9d?.lastUpload?.platforms ?? u9d?.platforms ?? []
      if (allPlatforms.length === 0) return { ok: false, output: t('out.noUploadPlatforms') }

      const VIDEO_PLATFORMS = ['FB Reels', 'IG Reels', 'YouTube Shorts', 'TikTok']
      const imagePlatforms = allPlatforms.filter((p: string) => !VIDEO_PLATFORMS.includes(p))
      const videoPlatforms = allPlatforms.filter((p: string) => VIDEO_PLATFORMS.includes(p))

      const images = u6d?.images?.map(i => i.url).filter(Boolean) ?? []
      const copies = u4d?.results ? Object.values(u4d.results) : []

      // Upload images + text to image platforms
      const uploadResults: string[] = []
      if (imagePlatforms.length > 0) {
        const { res, data } = await safeFetch('/api/marketing/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platforms: imagePlatforms, copies, images }),
        })
        if (!res.ok) return { ok: false, output: String(data.error ?? t('out.uploadFailed')) }
        uploadResults.push(imagePlatforms.join('、'))
      }

      // Video platforms: will be uploaded by Unit 11 after video is generated
      if (videoPlatforms.length > 0) {
        uploadResults.push(t('out.waitAnchorUpload', { platforms: videoPlatforms.join('、') }))
      }

      return { ok: true, output: `${t('out.uploadDone')} · ${uploadResults.join(' | ')}`, data: { imagePlatforms, videoPlatforms, copies, images } }
    }

    if (unitId === 10) {
      const outputs: string[] = []

      // Phone marketing
      const phones = (u10d as { phones?: string[] } | undefined)?.phones ?? []
      if (phones.length > 0) {
        const script = u4d?.results?.line_message ?? u4d?.results?.facebook_post ?? t('out.defaultCallScript')
        const { res, data } = await safeFetch('/api/marketing/phone-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'batch', phones, script, voiceId: (u10d as { voiceId?: string } | undefined)?.voiceId ?? 'EXAVITQu4vr4xnSDxMaL', birdCallerId: (u10d as { callerId?: string } | undefined)?.callerId }),
        })
        if (res.ok) outputs.push(t('out.phoneResult', { success: String(data.success), total: String(data.total) }))
        else outputs.push(t('out.phoneFailed', { error: String(data.error) }))
      }

      // Email marketing
      const emailBatch = (u10d as { lastEmailBatch?: { results: { email: string; group: string }[] } } | undefined)?.lastEmailBatch
      const emailRecipients = emailBatch?.results?.map((r) => ({ email: r.email, group: r.group })) ?? []
      if (emailRecipients.length > 0) {
        const { res, data } = await safeFetch('/api/marketing/email-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipients: emailRecipients,
            defaultSubject: u4d?.results?.email_subject ?? t('out.defaultEmailSubject'),
            defaultBody: u4d?.results?.email_body ?? '',
          }),
        })
        if (res.ok) outputs.push(t('out.emailResult', { success: String(data.success), total: String(data.total) }))
        else outputs.push(t('out.emailFailed', { error: String(data.error) }))
      }

      if (outputs.length === 0) return { ok: false, output: t('out.noLeadsList') }
      return { ok: true, output: `${t('out.leadsDone')} · ${outputs.join(' | ')}` }
    }

    if (unitId === 11) {
      const avatarId = u11d?.avatarId
      const voiceId  = u11d?.voiceId
      if (!avatarId || !voiceId) return { ok: false, output: t('out.noAnchorConfig') }

      // Script: use Unit 4 anchor_script; if missing, auto-generate using Unit 4's duration settings
      let anchorScript = (u4d?.results as Record<string, string> | undefined)?.anchor_script ?? ''
      if (!anchorScript) {
        const duration = (ud[4] as { anchorDuration?: number } | undefined)?.anchorDuration ?? 60
        const style    = (ud[4] as { anchorStyle?: string } | undefined)?.anchorStyle ?? t('out.defaultAnchorStyle')
        const genRes = await safeFetch('/api/marketing/avatar-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            count: 1,
            duration,
            style,
            companyData: u2d ?? {},
            analysisData: u3d ?? {},
            collectedSummary: u1d?.summary ?? '',
            existingCopies: u4d?.results ?? {},
          }),
        })
        anchorScript = (genRes.data.scripts as string[] | undefined)?.[0] ?? ''
        if (!anchorScript) return { ok: false, output: t('out.anchorScriptGenFailed', { error: String(genRes.data.error ?? t('out.unknownError')) }) }
      }
      const script = anchorScript

      const { res: submitRes, data: submit } = await safeFetch('/api/marketing/heygen-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarId, voiceId, script: script.slice(0, 500) }),
      })
      if (!submitRes.ok) return { ok: false, output: String(submit.error ?? t('out.heygenSubmitFailed')) }

      for (let i = 0; i < 75; i++) {
        if (abortRef.current) return { ok: false, output: t('out.aborted') }
        await new Promise(r => setTimeout(r, 8000))
        const { data: poll } = await safeFetch(`/api/marketing/heygen-avatar?videoId=${submit.videoId}`, {})

        if (poll.status === 'completed') {
          const videoUrl = String(poll.videoUrl ?? '')

          // Auto-upload to video platforms configured in Unit 9
          const u9Result = ud[9] as { videoPlatforms?: string[]; copies?: string[] } | undefined
          const videoPlatforms = u9Result?.videoPlatforms ?? []
          let uploadNote = ''

          if (videoPlatforms.length > 0 && videoUrl) {
            const caption = anchorScript ?? (u4d?.results ? Object.values(u4d.results)[0] : '') ?? ''
            const { res: upRes, data: upData } = await safeFetch('/api/marketing/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                platforms: videoPlatforms,
                copies: caption ? [caption] : [],
                videos: [{ url: videoUrl }],
              }),
            })
            uploadNote = upRes.ok
              ? ` · ${t('out.uploadedTo', { platforms: videoPlatforms.join('、') })}`
              : ` · ${t('out.uploadFailedShort', { error: String(upData.error ?? '').slice(0, 60) })}`
          }

          return {
            ok: true,
            output: `${t('out.anchorVideoDone')}${uploadNote}`,
            data: { videos: [{ videoId: submit.videoId, videoUrl }] },
          }
        }

        if (poll.status === 'failed') return { ok: false, output: t('out.anchorVideoFailed') }
      }
      return { ok: false, output: t('out.heygenTimeout') }
    }

    return { ok: false, output: t('out.unitNotSupported', { unitId }) }
  }, [t])

  // ── Start pipeline ───────────────────────────────────────────────────────
  const startPipeline = useCallback(async () => {
    abortRef.current = false
    const enabled = config.steps.filter(s => s.enabled && STEP_DEFS.find(d => d.unitId === s.unitId)?.canAuto)
    setStepRuns(enabled.map(s => ({ unitId: s.unitId, status: 'pending', output: '' })))
    setRunLog([])
    setCurrentIdx(0)
    setIsRunning(true)

    let ud = { ...campaignData }

    for (let i = 0; i < enabled.length; i++) {
      if (abortRef.current) break
      const stepCfg = enabled[i]
      const def = STEP_DEFS.find(d => d.unitId === stepCfg.unitId)!
      setCurrentIdx(i)
      updateStep(stepCfg.unitId, 'running')
      log(`▶ ${t('log.start', { name: t(def.nameKey) })}`)

      try {
        const result = await runUnit(stepCfg.unitId, ud)
        if (result.data) {
          await saveUnit(stepCfg.unitId, result.data)
          ud = { ...ud, [stepCfg.unitId]: result.data }
        }

        if (!result.ok) {
          updateStep(stepCfg.unitId, 'error', result.output)
          log(`✗ ${t('log.stepFailed', { name: t(def.nameKey), output: result.output })}`)
          break
        }

        log(`✓ ${t('log.stepDone', { name: t(def.nameKey), output: result.output })}`)

        if (stepCfg.notify) {
          updateStep(stepCfg.unitId, 'waiting', result.output)
          pendingFeedbackRef.current = null
          const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          const lines = result.output.split('\n')
          const notifyMsg = [`🤖 <b>${t('tg.title')}</b>`, ``, t('tg.stepDone', { name: esc(t(def.nameKey)) }), t('tg.result', { result: esc(lines[0]) }), ``, t('tg.chooseAction')].join('\n')
          const approvalId = await sendTelegramApproval(notifyMsg, { unitId: stepCfg.unitId })
          log(`🔔 ${t('log.tgSent', { btn: approvalId ? t('log.withButtons') : '' })}`)
          await waitConfirm(stepCfg.unitId, approvalId ?? undefined)
          const fb = pendingFeedbackRef.current
          if (fb) log(`📱 ${t('log.tgFeedback', { fb })}`)
          log(`→ ${t('log.confirmedContinue')}`)
        }

        updateStep(stepCfg.unitId, 'done', result.output)
      } catch (e) {
        updateStep(stepCfg.unitId, 'error', String(e))
        log(`✗ ${t('log.stepError', { name: t(def.nameKey), error: String(e) })}`)
        break
      }
    }

    setIsRunning(false)
    setCurrentIdx(-1)
    log(`── ${t('log.flowEnd')} ──`)
  }, [config, campaignData, runUnit, saveUnit, sendTelegramApproval, updateStep, waitConfirm, log, t])

  function stopPipeline() { abortRef.current = true; setIsRunning(false); log(`⏹ ${t('log.stopped')}`) }

  const enabledSteps = config.steps.filter(s => {
    const def = STEP_DEFS.find(d => d.unitId === s.unitId)
    return s.enabled && def?.canAuto
  })

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── Left: Step Selector ─────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <a href="/marketing-auto" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-3">
            <ArrowLeft className="h-3.5 w-3.5" /> {t('backToAuto')}
          </a>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h1 className="font-bold text-sm text-gray-800">{t('title')}</h1>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">{t('subtitle')}</p>
        </div>

        {/* Source campaign banner */}
        {loadingCampaign && (
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-[10px] text-amber-600">
            <Loader2 className="h-3 w-3 animate-spin" /> {t('loadingCampaign')}
          </div>
        )}
        {sourceCampaign && !loadingCampaign && (
          <div className="px-3 py-2 bg-green-50 border-b border-green-100 space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-green-700">
              <Link2 className="h-3 w-3" /> {t('linkedCampaign')}
            </div>
            <div className="text-[10px] text-green-600 font-medium truncate">《{sourceCampaign.title}》</div>
            <div className="text-[10px] text-green-500">
              {t('loadedUnits', { units: sourceCampaign.loadedUnits.sort((a,b)=>a-b).map(n => `U${n}`).join('、') || t('none') })}
            </div>
          </div>
        )}

        {/* Flow name */}
        <div className="px-3 py-2.5 border-b">
          <input
            type="text"
            value={config.activityName}
            onChange={e => setConfig(c => ({ ...c, activityName: e.target.value }))}
            placeholder={t('flowName')}
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        {/* Step list */}
        <div className="flex-1 overflow-y-auto py-1">
          {STEP_DEFS.map(def => {
            const stepCfg = config.steps.find(s => s.unitId === def.unitId)!
            const Icon = def.icon
            const run = stepRuns.find(r => r.unitId === def.unitId)
            const hasData = campaignData[def.unitId] != null
            return (
              <div key={def.unitId}
                className={`flex items-center gap-2 px-3 py-2 ${!def.canAuto ? 'opacity-40' : ''}`}>
                {def.canAuto
                  ? <input type="checkbox" checked={stepCfg.enabled} onChange={e => setStepEnabled(def.unitId, e.target.checked)}
                      className="rounded accent-amber-500 shrink-0" />
                  : <div className="w-4 h-4 shrink-0" />
                }
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  run?.status === 'done'    ? 'bg-green-100' :
                  run?.status === 'error'   ? 'bg-red-100' :
                  run?.status === 'running' ? 'bg-blue-100' :
                  run?.status === 'waiting' ? 'bg-amber-100' :
                  hasData                   ? 'bg-green-50' : 'bg-gray-100'
                }`}>
                  {run?.status === 'done'    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> :
                   run?.status === 'error'   ? <AlertCircle  className="h-3.5 w-3.5 text-red-500" /> :
                   run?.status === 'running' ? <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" /> :
                   run?.status === 'waiting' ? <Bell className="h-3.5 w-3.5 text-amber-500" /> :
                   hasData                   ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> :
                   <Icon className="h-3.5 w-3.5 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-700 truncate">{def.unitId}. {t(def.nameKey)}</div>
                  <div className="text-[10px] truncate">
                    {hasData
                      ? <span className="text-green-500">{t('dataReady')}</span>
                      : <span className="text-gray-400">{t(def.descKey)}</span>
                    }
                  </div>
                </div>
                {def.canAuto && stepCfg.enabled && (
                  <button onClick={() => setStepNotify(def.unitId, !stepCfg.notify)}
                    title={stepCfg.notify ? t('notifyThenContinue') : t('autoContinue')}
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
          <div className="flex items-center gap-1.5"><Bell className="h-3 w-3 text-amber-400" /> {t('legendNotify')}</div>
          <div className="flex items-center gap-1.5"><BellOff className="h-3 w-3 text-gray-300" /> {t('legendAuto')}</div>
        </div>
      </aside>

      {/* ── Right: Run Area ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white border-b px-6 py-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-700">{config.activityName || t('title')}</div>
            <div className="text-[10px] text-gray-400">
              {enabledSteps.length > 0 ? t('stepsChecked', { count: enabledSteps.length }) : t('pleaseCheck')}
              {Object.keys(campaignData).filter(k => !isNaN(Number(k))).length > 0 &&
                ` · ${t('unitsReady', { count: Object.keys(campaignData).filter(k => !isNaN(Number(k))).length })}`}
            </div>
          </div>
          <button onClick={() => setShowSchedule(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              showSchedule || config.schedule.enabled
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            <Clock className="h-3.5 w-3.5" />
            {config.schedule.enabled ? t('scheduleEnabled') : t('schedule')}
          </button>
          <div className="flex gap-2">
            {isRunning
              ? <button onClick={stopPipeline}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-500">
                  <Pause className="h-4 w-4" />{t('stop')}
                </button>
              : <button onClick={startPipeline} disabled={enabledSteps.length === 0}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40 shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                  <Zap className="h-4 w-4" />{t('start')}
                </button>
            }
            {stepRuns.length > 0 && !isRunning && (
              <button onClick={() => { setStepRuns([]); setRunLog([]); setCurrentIdx(-1) }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-500 bg-gray-100 hover:bg-gray-200">
                <RotateCcw className="h-3.5 w-3.5" />{t('reset')}
              </button>
            )}
          </div>
        </div>

        {/* Schedule panel (collapsible) */}
        {showSchedule && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="font-bold text-sm text-amber-800">{t('scheduledRun')}</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-amber-700">{config.schedule.enabled ? t('enabled') : t('disabled')}</span>
                <div onClick={() => setConfig(c => ({ ...c, schedule: { ...c.schedule, enabled: !c.schedule.enabled } }))}
                  className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${config.schedule.enabled ? 'bg-amber-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.schedule.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>
            {config.schedule.enabled && (
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs text-amber-700 block mb-1">{t('frequency')}</label>
                  <select value={config.schedule.frequency}
                    onChange={e => setConfig(c => ({ ...c, schedule: { ...c.schedule, frequency: e.target.value as 'daily'|'weekly'|'monthly' } }))}
                    className="text-sm border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                    <option value="daily">{t('freqDaily')}</option>
                    <option value="weekly">{t('freqWeekly')}</option>
                    <option value="monthly">{t('freqMonthly')}</option>
                  </select>
                </div>
                {config.schedule.frequency === 'weekly' && (
                  <div>
                    <label className="text-xs text-amber-700 block mb-1">{t('weekday')}</label>
                    <select value={config.schedule.weekday}
                      onChange={e => setConfig(c => ({ ...c, schedule: { ...c.schedule, weekday: Number(e.target.value) } }))}
                      className="text-sm border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                      {[0,1,2,3,4,5,6].map(i => <option key={i} value={i}>{t(`weekdayOpt.${i}`)}</option>)}
                    </select>
                  </div>
                )}
                {config.schedule.frequency === 'monthly' && (
                  <div>
                    <label className="text-xs text-amber-700 block mb-1">{t('monthDay')}</label>
                    <input type="number" min={1} max={28} value={config.schedule.monthDay}
                      onChange={e => setConfig(c => ({ ...c, schedule: { ...c.schedule, monthDay: Number(e.target.value) } }))}
                      className="w-20 text-sm border border-amber-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-amber-700 block mb-1">{t('runTime')}</label>
                  <div className="flex gap-1.5">
                    <select value={config.schedule.hour}
                      onChange={e => setConfig(c => ({ ...c, schedule: { ...c.schedule, hour: Number(e.target.value) } }))}
                      className="text-sm border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                      {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{t('hourUnit', { h: String(i).padStart(2,'0') })}</option>)}
                    </select>
                    <select value={config.schedule.minute}
                      onChange={e => setConfig(c => ({ ...c, schedule: { ...c.schedule, minute: Number(e.target.value) } }))}
                      className="w-20 text-sm border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                      <option value={0}>{t('minUnit', { m: '00' })}</option>
                      <option value={30}>{t('minUnit', { m: '30' })}</option>
                    </select>
                  </div>
                </div>
                <div className="text-[10px] text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" />{t('autoSaved')}
                </div>
              </div>
            )}
            <p className="text-[10px] text-amber-600 mt-2">
              {t('cronNote')}
              <code className="bg-amber-100 px-1 rounded mx-1">CRON_SECRET</code>
              <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_APP_URL</code>
            </p>
          </div>
        )}

        {/* Run area */}
        <div className="flex-1 flex overflow-hidden">

          {/* Stepper */}
          <div className="w-52 shrink-0 border-r bg-white overflow-y-auto py-3">
            {enabledSteps.length === 0
              ? <p className="text-xs text-gray-400 text-center py-12 px-4">{t('pleaseCheck')}</p>
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
                        <div className={`text-xs font-medium ${isCurrent ? 'text-blue-600' : 'text-gray-700'}`}>{t(def.nameKey)}</div>
                        {run?.output && <div className="text-[10px] text-gray-400 truncate mt-0.5">{run.output}</div>}
                        {stepCfg.notify && <div className="flex items-center gap-1 mt-0.5"><Bell className="h-2.5 w-2.5 text-amber-400" /><span className="text-[10px] text-amber-500">{t('notify')}</span></div>}
                      </div>
                    </div>
                  )
                })
            }
          </div>

          {/* Log + Confirm */}
          <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">

            {waitingUnitId !== null && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <div className="font-bold text-sm text-amber-800">
                      {t('stepCompleted', { name: t(STEP_DEFS.find(d => d.unitId === waitingUnitId)?.nameKey ?? 'steps.1.name') })}
                    </div>
                    <div className="text-xs text-amber-600 mt-0.5">
                      {telegramApprovalId ? t('tgWaitHint') : t('confirmHint')}
                    </div>
                  </div>
                </div>
                <button onClick={handleConfirm}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                  <ChevronRight className="h-4 w-4" />{t('confirmContinue')}
                </button>
              </div>
            )}

            <div className="flex-1 bg-gray-900 rounded-xl p-4 overflow-y-auto font-mono text-xs">
              {runLog.length === 0
                ? <div className="text-gray-500 text-center pt-16">
                    <Zap className="h-8 w-8 text-gray-700 mx-auto mb-3" />
                    <div>{t('logEmpty')}</div>
                    <div className="text-gray-600 mt-1 text-[10px]">{t('logEmptyHint')}</div>
                  </div>
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

            {stepRuns.length > 0 && (
              <div className="flex gap-4 text-xs text-gray-500 shrink-0">
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />{t('statDone', { count: stepRuns.filter(r => r.status === 'done').length })}</span>
                <span className="flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 text-red-400" />{t('statError', { count: stepRuns.filter(r => r.status === 'error').length })}</span>
                <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5 text-gray-400" />{t('statPending', { count: stepRuns.filter(r => r.status === 'pending').length })}</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
