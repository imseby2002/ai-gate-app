'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Search, Building2, BarChart3, PenLine, MessageSquare,
  Image, Film, Video, Upload, CheckCircle2, XCircle,
  Clock, Loader2, ChevronRight, Send, RefreshCw, AlertCircle,
  Megaphone, Plus, ChevronDown, Trash2
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'done' | 'waiting' | 'approved' | 'rejected'

interface Step {
  id: number
  label: string
  icon: React.ElementType
  type: 'action' | 'telegram'
  description: string
}

interface StepData {
  collectedData?: string
  analysis?: string
  metrics?: { opportunity: number; competitors: number; audience: string }
  copy?: string
  imageUrls?: string[]
  script?: string
  videoJobId?: string
}

interface Campaign {
  id: string
  title: string
  topic?: string
  company_name?: string
  status: string
  active_step: number
  updated_at: string
}

// ── Constants ────────────────────────────────────────────────────

const STEPS: Step[] = [
  { id: 1,  label: '蒐集相關資料',      icon: Search,        type: 'action',   description: 'Tavily 搜尋行業趨勢、競品資訊，DeepSeek 整理摘要' },
  { id: 2,  label: '匯入公司資料',      icon: Building2,     type: 'action',   description: '輸入公司名稱並上傳公司簡介、產品資料、品牌圖片' },
  { id: 3,  label: '分析資料',          icon: BarChart3,     type: 'action',   description: 'Gemini 1.5 Flash 分析市場資料、SWOT 與行銷策略' },
  { id: 4,  label: '產生行銷文案',      icon: PenLine,       type: 'action',   description: 'Claude Sonnet 依據分析產生行銷文案' },
  { id: 5,  label: 'Telegram 審核文案', icon: MessageSquare, type: 'telegram', description: '傳送文案至 Telegram，等待核准或修改意見' },
  { id: 6,  label: '產生行銷圖片',      icon: Image,         type: 'action',   description: 'GPT-4o-mini 生成 Prompt → FLUX AI 產生 3 張圖片' },
  { id: 7,  label: 'Telegram 審核圖片', icon: MessageSquare, type: 'telegram', description: '傳送圖片至 Telegram，等待核准或修改意見' },
  { id: 8,  label: '產生影片腳本',      icon: Film,          type: 'action',   description: 'Claude Sonnet 產生 30 秒影片分鏡腳本' },
  { id: 9,  label: 'Telegram 審核腳本', icon: MessageSquare, type: 'telegram', description: '傳送腳本至 Telegram，等待核准或修改意見' },
  { id: 10, label: '產生影片',          icon: Video,         type: 'action',   description: 'Kling V2 / VEO3 依腳本產生完整行銷影片' },
  { id: 11, label: 'Telegram 審核影片', icon: MessageSquare, type: 'telegram', description: '傳送影片至 Telegram，等待核准或修改意見' },
  { id: 12, label: '上傳至各大平台',    icon: Upload,        type: 'action',   description: '自動上傳至 Facebook、Instagram、YouTube、LinkedIn' },
  { id: 13, label: 'Telegram 完成通知', icon: MessageSquare, type: 'telegram', description: '發送完成通知至 Telegram' },
]

const IMAGE_PLATFORMS = ['Facebook', 'Instagram', 'Threads', 'LINE VOOM', 'Zalo', 'LinkedIn', 'Twitter/X']
const VIDEO_PLATFORMS = ['FB Reels', 'IG Reels', 'YouTube Shorts', 'TikTok']
const PLATFORMS = [...IMAGE_PLATFORMS, ...VIDEO_PLATFORMS]

const STATUS_CONFIG: Record<StepStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: '待執行',  color: 'text-gray-400',   bg: 'bg-gray-100' },
  running:  { label: '執行中',  color: 'text-blue-600',   bg: 'bg-blue-50' },
  done:     { label: '完成',    color: 'text-green-600',  bg: 'bg-green-50' },
  waiting:  { label: '等待審核', color: 'text-amber-600', bg: 'bg-amber-50' },
  approved: { label: '已核准',  color: 'text-green-600',  bg: 'bg-green-50' },
  rejected: { label: '修改中',  color: 'text-red-600',    bg: 'bg-red-50' },
}

const DEFAULT_STATUSES: Record<number, StepStatus> =
  Object.fromEntries(STEPS.map(s => [s.id, 'pending' as StepStatus]))

// ── Helpers ──────────────────────────────────────────────────────

async function patchCampaign(id: string, body: Record<string, unknown>) {
  await fetch(`/api/marketing/campaign/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Component ─────────────────────────────────────────────────────

export default function MarketingAutoPage() {
  // Campaign list
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [showCampaigns, setShowCampaigns] = useState(false)
  const [loadingCampaign, setLoadingCampaign] = useState(false)

  // Pipeline state
  const [statuses, setStatuses] = useState<Record<number, StepStatus>>(DEFAULT_STATUSES)
  const [activeStep, setActiveStep] = useState(1)
  const [stepData, setStepData] = useState<StepData>({})
  const [feedbacks, setFeedbacks] = useState<Record<number, string>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})

  // Step 1
  const [topic, setTopic] = useState('')
  const [industry, setIndustry] = useState('科技/軟體')

  // Step 2
  const [companyName, setCompanyName] = useState('')
  const [companyInfo, setCompanyInfo] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // Settings
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['Facebook', 'Instagram'])
  const [uploadResults, setUploadResults] = useState<{ platform: string; ok: boolean; postId?: string; error?: string }[]>([])
  const [imageModel, setImageModel] = useState('flux-1-pro')
  const [feedbackInput, setFeedbackInput] = useState('')

  // Telegram profile config
  const [tgConfigured, setTgConfigured] = useState<'loading' | 'ok' | 'missing'>('loading')

  // Polling ref
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── DB persistence helpers ───────────────────────────────────────

  // Load Telegram config from profile on mount
  useEffect(() => {
    fetch('/api/marketing/telegram-config')
      .then(r => r.json())
      .then(d => setTgConfigured(d.configured ? 'ok' : 'missing'))
      .catch(() => setTgConfigured('missing'))
  }, [])

  const saveSnapshot = useCallback(async (
    id: string,
    override?: Partial<{
      statuses: Record<number, StepStatus>
      activeStep: number
      stepData: StepData
      feedbacks: Record<number, string>
    }>
  ) => {
    const s = override?.statuses ?? statuses
    const a = override?.activeStep ?? activeStep
    const d = override?.stepData ?? stepData
    const f = override?.feedbacks ?? feedbacks

    await patchCampaign(id, {
      stepStatuses: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v])),
      activeStep: a,
      collectedData: d.collectedData,
      analysis: d.analysis,
      metrics: d.metrics,
      copyText: d.copy,
      imageUrls: d.imageUrls,
      scriptText: d.script,
      videoJobId: d.videoJobId,
      feedbacks: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v])),
      selectedPlatforms,
      status: 'running',
    })
  }, [statuses, activeStep, stepData, feedbacks, selectedPlatforms])

  // ── Load campaign list ───────────────────────────────────────────

  const loadCampaigns = useCallback(async () => {
    const res = await fetch('/api/marketing/campaign')
    if (!res.ok) return
    const data = await res.json()
    setCampaigns(data.campaigns ?? [])
  }, [])

  useEffect(() => { loadCampaigns() }, [loadCampaigns])

  // ── Create new campaign ──────────────────────────────────────────

  const createCampaign = async () => {
    const res = await fetch('/api/marketing/campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: topic ? `${topic} - ${companyName || '行銷活動'}` : '新行銷活動',
        topic, industry, companyName, companyInfo,
        selectedPlatforms,
      }),
    })
    const data = await res.json()
    if (data.id) {
      setCampaignId(data.id)
      await loadCampaigns()
      return data.id as string
    }
    return null
  }

  // ── Load existing campaign ───────────────────────────────────────

  const loadCampaign = async (id: string) => {
    setLoadingCampaign(true)
    setShowCampaigns(false)
    const res = await fetch(`/api/marketing/campaign/${id}`)
    const data = await res.json()
    const c = data.campaign
    if (!c) { setLoadingCampaign(false); return }

    setTopic(c.topic ?? '')
    setIndustry(c.industry ?? '科技/軟體')
    setCompanyName(c.company_name ?? '')
    setCompanyInfo(c.company_info ?? '')
    // telegram settings come from user profile, not campaign
    setSelectedPlatforms(c.selected_platforms ?? ['Facebook', 'Instagram'])
    setActiveStep(c.active_step ?? 1)
    setFeedbacks(Object.fromEntries(
      Object.entries(c.feedbacks ?? {}).map(([k, v]) => [Number(k), v as string])
    ))
    setStepData({
      collectedData: c.collected_data ?? undefined,
      analysis: c.analysis ?? undefined,
      metrics: c.metrics ?? undefined,
      copy: c.copy_text ?? undefined,
      imageUrls: c.image_urls ?? undefined,
      script: c.script_text ?? undefined,
      videoJobId: c.video_job_id ?? undefined,
    })

    // Restore step statuses
    const restored: Record<number, StepStatus> = { ...DEFAULT_STATUSES }
    for (const [k, v] of Object.entries(c.step_statuses ?? {})) {
      restored[Number(k)] = v as StepStatus
    }
    setStatuses(restored)
    setCampaignId(id)
    setLoadingCampaign(false)
  }

  // ── Polling: call telegram-poll then sync campaign state ─────────

  const pollTelegram = useCallback(async (id: string) => {
    // 1. 呼叫 telegram-poll（getUpdates + 自動更新 DB）
    const pollRes = await fetch('/api/marketing/telegram-poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: id }),
    })
    if (!pollRes.ok) return

    const pollData = await pollRes.json()

    // 2. 若有變動，重新從 DB 載入最新狀態
    if (pollData.action !== 'none') {
      const res = await fetch(`/api/marketing/campaign/${id}`)
      if (!res.ok) return
      const { campaign: c } = await res.json()
      if (!c) return

      const dbStatuses: Record<number, StepStatus> = { ...DEFAULT_STATUSES }
      for (const [k, v] of Object.entries(c.step_statuses ?? {})) {
        dbStatuses[Number(k)] = v as StepStatus
      }
      setStatuses(dbStatuses)
      setActiveStep(c.active_step ?? 1)
      setFeedbacks(Object.fromEntries(
        Object.entries(c.feedbacks ?? {}).map(([k, v]) => [Number(k), v as string])
      ))
    }
  }, [])

  // Start polling when a step is 'waiting'
  useEffect(() => {
    const hasWaiting = Object.values(statuses).some(s => s === 'waiting')
    if (hasWaiting && campaignId) {
      if (!pollRef.current) {
        pollRef.current = setInterval(() => pollTelegram(campaignId), 5000)
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [statuses, campaignId, pollTelegram])

  // ── Status helpers ───────────────────────────────────────────────

  const updateStatus = (id: number, status: StepStatus) =>
    setStatuses(prev => ({ ...prev, [id]: status }))

  const setError = (id: number, msg: string) =>
    setErrors(prev => ({ ...prev, [id]: msg }))

  const clearError = (id: number) =>
    setErrors(prev => { const n = { ...prev }; delete n[id]; return n })

  // ── Ensure campaign exists before running ────────────────────────

  const ensureCampaign = async (): Promise<string | null> => {
    if (campaignId) return campaignId
    return createCampaign()
  }

  // ── API callers ──────────────────────────────────────────────────

  const runCollect = async () => {
    updateStatus(1, 'running'); clearError(1)
    try {
      const cid = await ensureCampaign()
      const res = await fetch('/api/marketing/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, industry }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const newData = { ...stepData, collectedData: data.data }
      setStepData(newData)
      updateStatus(1, 'done')
      setActiveStep(2)
      if (cid) await saveSnapshot(cid, { statuses: { ...statuses, 1: 'done' }, activeStep: 2, stepData: newData, feedbacks })
    } catch (e) { setError(1, String(e)); updateStatus(1, 'pending') }
  }

  const runImport = async () => {
    const cid = await ensureCampaign()
    updateStatus(2, 'done')
    setActiveStep(3)
    if (cid) await patchCampaign(cid, {
      companyName, companyInfo, topic, industry,
      stepStatuses: { ...statuses, 2: 'done' }, activeStep: 3,
    })
  }

  const runAnalyze = async () => {
    updateStatus(3, 'running'); clearError(3)
    try {
      const res = await fetch('/api/marketing/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectedData: stepData.collectedData ?? '', companyName, companyInfo, topic, industry }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const newData = { ...stepData, analysis: data.analysis, metrics: data.metrics }
      setStepData(newData)
      updateStatus(3, 'done')
      setActiveStep(4)
      if (campaignId) await saveSnapshot(campaignId, { statuses: { ...statuses, 3: 'done' }, activeStep: 4, stepData: newData, feedbacks })
    } catch (e) { setError(3, String(e)); updateStatus(3, 'pending') }
  }

  const runCopy = async () => {
    updateStatus(4, 'running'); clearError(4)
    try {
      const res = await fetch('/api/marketing/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: stepData.analysis, companyName, topic, industry, feedback: feedbacks[4] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const newData = { ...stepData, copy: data.copy }
      setStepData(newData)
      updateStatus(4, 'done')
      setActiveStep(5)
      if (campaignId) await saveSnapshot(campaignId, { statuses: { ...statuses, 4: 'done' }, activeStep: 5, stepData: newData, feedbacks })
    } catch (e) { setError(4, String(e)); updateStatus(4, 'pending') }
  }

  const runImages = async () => {
    updateStatus(6, 'running'); clearError(6)
    try {
      const res = await fetch('/api/marketing/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copy: stepData.copy, companyName, model: imageModel, count: 3 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const newData = { ...stepData, imageUrls: data.imageUrls }
      setStepData(newData)
      updateStatus(6, 'done')
      setActiveStep(7)
      if (campaignId) await saveSnapshot(campaignId, { statuses: { ...statuses, 6: 'done' }, activeStep: 7, stepData: newData, feedbacks })
    } catch (e) { setError(6, String(e)); updateStatus(6, 'pending') }
  }

  const runScript = async () => {
    updateStatus(8, 'running'); clearError(8)
    try {
      const res = await fetch('/api/marketing/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copy: stepData.copy, companyName, topic, feedback: feedbacks[8] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const newData = { ...stepData, script: data.script }
      setStepData(newData)
      updateStatus(8, 'done')
      setActiveStep(9)
      if (campaignId) await saveSnapshot(campaignId, { statuses: { ...statuses, 8: 'done' }, activeStep: 9, stepData: newData, feedbacks })
    } catch (e) { setError(8, String(e)); updateStatus(8, 'pending') }
  }

  const runVideo = async () => {
    updateStatus(10, 'running'); clearError(10)
    try {
      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: stepData.script ?? topic, model: 'kling-v2', duration: 10 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const newData = { ...stepData, videoJobId: data.jobId }
      setStepData(newData)
      updateStatus(10, 'done')
      setActiveStep(11)
      if (campaignId) await saveSnapshot(campaignId, { statuses: { ...statuses, 10: 'done' }, activeStep: 11, stepData: newData, feedbacks })
    } catch (e) { setError(10, String(e)); updateStatus(10, 'pending') }
  }

  const runUpload = async () => {
    updateStatus(12, 'running'); clearError(12)
    try {
      const res = await fetch('/api/marketing/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          platforms: selectedPlatforms,
          imageUrls: stepData.imageUrls ?? [],
          videoUrl: stepData.videoJobId ?? '',
          copyText: stepData.copy ?? '',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUploadResults(data.results ?? [])
      updateStatus(12, 'done')
      setActiveStep(13)
      if (campaignId) await patchCampaign(campaignId, { stepStatuses: { ...statuses, 12: 'done' }, activeStep: 13 })
    } catch (e) { setError(12, String(e)); updateStatus(12, 'pending') }
  }

  const sendTelegram = async (stepId: number, message: string) => {
    updateStatus(stepId, 'running'); clearError(stepId)
    try {
      const res = await fetch('/api/marketing/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }), // chatId 由 server 從 profile 讀取
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      updateStatus(stepId, 'waiting')
      if (campaignId) await patchCampaign(campaignId, {
        stepStatuses: { ...statuses, [stepId]: 'waiting' },
        activeStep: stepId,
        status: 'running',
      })
    } catch (e) {
      setError(stepId, String(e))
      updateStatus(stepId, 'pending')
    }
  }

  // ── Step dispatcher ──────────────────────────────────────────────

  const runStep = (stepId: number) => {
    switch (stepId) {
      case 1:  return runCollect()
      case 2:  return runImport()
      case 3:  return runAnalyze()
      case 4:  return runCopy()
      case 5:  return sendTelegram(5, buildTelegramMsg(5))
      case 6:  return runImages()
      case 7:  return sendTelegram(7, buildTelegramMsg(7))
      case 8:  return runScript()
      case 9:  return sendTelegram(9, buildTelegramMsg(9))
      case 10: return runVideo()
      case 11: return sendTelegram(11, buildTelegramMsg(11))
      case 12: return runUpload()
      case 13: return sendTelegram(13, buildTelegramMsg(13))
    }
  }

  const buildTelegramMsg = (stepId: number): string => {
    const cTag = campaignId ? `\n[campaign:${campaignId}:step:${stepId}]` : ''
    const header = `<b>【AI GATE 行銷自動化】</b>\n主題：${topic || '未設定'}｜公司：${companyName || '未設定'}`
    switch (stepId) {
      case 5:
        return `${header}\n\n📝 <b>行銷文案已生成，請審核：</b>\n\n${stepData.copy ?? ''}\n\n✅ 回覆「核准」繼續，或直接輸入修改意見退回重生成。${cTag}`
      case 7:
        return `${header}\n\n🖼️ <b>行銷圖片已生成 ${stepData.imageUrls?.length ?? 0} 張：</b>\n${(stepData.imageUrls ?? []).map((u, i) => `${i + 1}. ${u}`).join('\n')}\n\n✅ 回覆「核准」繼續，或輸入修改意見退回重生成。${cTag}`
      case 9:
        return `${header}\n\n🎬 <b>影片腳本已生成：</b>\n\n${(stepData.script ?? '').slice(0, 800)}${(stepData.script?.length ?? 0) > 800 ? '...' : ''}\n\n✅ 回覆「核准」繼續，或輸入修改意見退回重生成。${cTag}`
      case 11:
        return `${header}\n\n🎥 <b>行銷影片生成任務已提交</b>\n任務 ID：${stepData.videoJobId ?? '處理中'}\n\n✅ 回覆「核准」繼續上傳平台，或輸入修改意見。${cTag}`
      case 13:
        return `${header}\n\n✅ <b>行銷流程全部完成！</b>\n已發布至：${selectedPlatforms.join('、')}\n感謝使用 AI GATE 自動化行銷系統。`
      default:
        return `${header}\n\n步驟 ${stepId} 已完成。${cTag}`
    }
  }

  // ── Approval / Rejection (local override) ───────────────────────

  const handleApprove = async (stepId: number) => {
    const newStatuses = { ...statuses, [stepId]: 'approved' as StepStatus }
    const next = stepId + 1
    const nextStep = next <= STEPS.length ? next : stepId
    setStatuses(newStatuses)
    setActiveStep(nextStep)
    if (campaignId) await patchCampaign(campaignId, { stepStatuses: newStatuses, activeStep: nextStep })
  }

  const handleReject = async (stepId: number) => {
    if (!feedbackInput.trim()) return
    const contentStep = stepId - 1
    const newFeedbacks = { ...feedbacks, [contentStep]: feedbackInput }
    const newStatuses = {
      ...statuses,
      [stepId]: 'rejected' as StepStatus,
      [contentStep]: 'pending' as StepStatus,
    }
    setFeedbacks(newFeedbacks)
    setStatuses(newStatuses)
    setActiveStep(contentStep)
    setFeedbackInput('')
    if (campaignId) await patchCampaign(campaignId, {
      stepStatuses: newStatuses,
      activeStep: contentStep,
      feedbacks: Object.fromEntries(Object.entries(newFeedbacks).map(([k, v]) => [k, v])),
    })
  }

  const handleReset = () => {
    setStatuses(DEFAULT_STATUSES)
    setActiveStep(1)
    setStepData({})
    setFeedbacks({})
    setErrors({})
    setUploadedFiles([])
    setCampaignId(null)
  }

  const handleDeleteCampaign = async (id: string) => {
    await fetch(`/api/marketing/campaign/${id}`, { method: 'DELETE' })
    await loadCampaigns()
    if (id === campaignId) handleReset()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadedFiles(prev => [...prev, ...files.map(f => f.name)])
    setCompanyInfo(prev => {
      const names = files.map(f => f.name).join('、')
      return prev ? `${prev}\n[已上傳：${names}]` : `[已上傳：${names}]`
    })
  }

  const togglePlatform = (p: string) =>
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  // ── Derived ──────────────────────────────────────────────────────

  const completedCount = Object.values(statuses).filter(s => s === 'done' || s === 'approved').length
  const progress = Math.round((completedCount / STEPS.length) * 100)
  const currentStep = STEPS.find(s => s.id === activeStep)!
  const currentStatus = statuses[activeStep]
  const canRun = currentStatus === 'pending' || currentStatus === 'rejected'
  const isWaiting = currentStatus === 'waiting'
  const currentError = errors[activeStep]

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto px-6 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" style={{ color: 'var(--primary)' }} />
            自動化行銷
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            AI 全自動行銷流程 · Tavily / DeepSeek / Gemini / Claude / GPT-4o-mini · Telegram 雙向審核
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Campaign picker */}
          <div className="relative">
            <button
              onClick={() => { setShowCampaigns(!showCampaigns); loadCampaigns() }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {campaignId
                ? campaigns.find(c => c.id === campaignId)?.title?.slice(0, 14) ?? '活動'
                : '選擇活動'
              }
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {showCampaigns && (
              <div className="absolute right-0 top-10 z-20 w-72 bg-white rounded-xl border shadow-lg overflow-hidden">
                <div className="px-3 py-2 border-b">
                  <button
                    onClick={() => { handleReset(); setShowCampaigns(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 text-left"
                    style={{ color: 'var(--primary)' }}
                  >
                    <Plus className="h-4 w-4" /> 新建行銷活動
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {campaigns.length === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">尚無歷史活動</div>
                  )}
                  {campaigns.map(c => (
                    <div key={c.id} className={`flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 ${c.id === campaignId ? 'bg-gray-50' : ''}`}>
                      <div className="flex-1 min-w-0" onClick={() => loadCampaign(c.id)}>
                        <div className="text-sm font-medium truncate">{c.title}</div>
                        <div className="text-xs text-gray-400">
                          步驟 {c.active_step} · {new Date(c.updated_at).toLocaleDateString('zh-TW')}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteCampaign(c.id) }}
                        className="p-1 hover:text-red-500 text-gray-300 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> 重置
          </button>
        </div>
      </div>

      {/* Campaign ID badge */}
      {campaignId && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 border border-green-100 w-fit">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span className="text-xs text-green-700 font-medium">已儲存至資料庫</span>
          <span className="text-xs text-green-400 font-mono">{campaignId.slice(0, 8)}…</span>
          {Object.values(statuses).some(s => s === 'waiting') && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <Clock className="h-3 w-3 animate-pulse" /> 輪詢 Telegram 中…
            </span>
          )}
        </div>
      )}

      {/* Progress */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">整體進度</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
            {completedCount} / {STEPS.length} 步驟
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div className="h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: 'var(--primary)' }} />
        </div>
      </div>

      {/* Pipeline visual */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {STEPS.map((step, idx) => {
            const Icon = step.icon
            const status = statuses[step.id]
            const isActive = step.id === activeStep
            const cfg = STATUS_CONFIG[status]
            const isTg = step.type === 'telegram'
            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => setActiveStep(step.id)}
                  className={`flex flex-col items-center gap-1.5 px-2 py-2 rounded-xl transition-all ${isActive ? 'ring-2 ring-offset-1' : 'hover:bg-gray-50'}`}
                  style={isActive ? { '--tw-ring-color': 'var(--primary)' } as React.CSSProperties : {}}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    status === 'done' || status === 'approved' ? 'bg-green-100' :
                    status === 'running' ? 'bg-blue-100' :
                    status === 'waiting' ? 'bg-amber-100' :
                    status === 'rejected' ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    {status === 'running'  ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> :
                     status === 'done' || status === 'approved' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                     status === 'waiting'  ? <Clock className="h-4 w-4 text-amber-600" /> :
                     status === 'rejected' ? <XCircle className="h-4 w-4 text-red-500" /> :
                     <Icon className={`h-4 w-4 ${isTg ? 'text-blue-400' : 'text-gray-400'}`} />}
                  </div>
                  <span className={`text-[10px] font-medium text-center leading-tight max-w-[56px] ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                    {step.label.replace('Telegram ', '')}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                </button>
                {idx < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Current step panel */}
      {loadingCampaign ? (
        <div className="bg-white rounded-2xl border shadow-sm p-10 flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          <span className="text-sm text-gray-500">載入活動資料中…</span>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          {/* Step header */}
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentStep.type === 'telegram' ? 'bg-blue-50' : ''}`}
                style={currentStep.type !== 'telegram' ? { background: 'color-mix(in oklch, var(--primary) 10%, transparent)' } : {}}>
                <currentStep.icon className="h-4 w-4"
                  style={currentStep.type !== 'telegram' ? { color: 'var(--primary)' } : { color: '#2CA5E0' }} />
              </div>
              <div>
                <h2 className="font-semibold text-base">步驟 {currentStep.id}：{currentStep.label}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{currentStep.description}</p>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_CONFIG[currentStatus].bg} ${STATUS_CONFIG[currentStatus].color}`}>
              {currentStatus === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
              {STATUS_CONFIG[currentStatus].label}
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Error */}
            {currentError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">{currentError}</div>
              </div>
            )}

            {/* Step 1 */}
            {currentStep.id === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">行銷主題 / 關鍵字</label>
                  <input value={topic} onChange={e => setTopic(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2"
                    placeholder="例如：新產品發布、年末促銷、品牌形象提升..." />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">產業類別</label>
                  <select value={industry} onChange={e => setIndustry(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 bg-white">
                    {['科技/軟體', '製造業', '零售/電商', '金融服務', '醫療健康', '餐飲/消費', '教育培訓', '其他'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                {stepData.collectedData && currentStatus === 'done' && (
                  <div className="p-3 rounded-lg bg-gray-50 border">
                    <div className="text-xs font-medium text-gray-500 mb-1.5">Tavily 蒐集結果 → DeepSeek 整理</div>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">{stepData.collectedData}</pre>
                  </div>
                )}
              </div>
            )}

            {/* Step 2 */}
            {currentStep.id === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">公司名稱</label>
                  <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2"
                    placeholder="輸入公司名稱..." />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">公司簡介 / 產品描述</label>
                  <textarea value={companyInfo} onChange={e => setCompanyInfo(e.target.value)} rows={4}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
                    placeholder="簡述公司背景、主要產品/服務、核心競爭優勢..." />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">上傳公司資料（選填）</label>
                  <div className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => fileRef.current?.click()}>
                    <Upload className="h-7 w-7 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">點擊上傳公司圖片、Logo</p>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF</p>
                  </div>
                  <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600 px-3 py-2 bg-gray-50 rounded-lg mt-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />{f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3 */}
            {currentStep.id === 3 && (
              <div className="space-y-4">
                {currentStatus === 'done' && stepData.metrics && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: '市場機會指數', value: `${stepData.metrics.opportunity}/100`, color: 'text-green-600' },
                      { label: '競品數量',     value: `${stepData.metrics.competitors} 家`,  color: 'text-blue-600' },
                      { label: '目標受眾',     value: stepData.metrics.audience,             color: 'text-purple-600' },
                    ].map(m => (
                      <div key={m.label} className="p-4 rounded-xl bg-gray-50 text-center">
                        <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
                        <div className="text-xs text-gray-500 mt-1">{m.label}</div>
                      </div>
                    ))}
                  </div>
                )}
                {currentStatus === 'done' && stepData.analysis && (
                  <div className="p-3 rounded-lg bg-gray-50 border">
                    <div className="text-xs font-medium text-gray-500 mb-1.5">Gemini 1.5 Flash 分析報告</div>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">{stepData.analysis}</pre>
                  </div>
                )}
                {currentStatus === 'pending' && !stepData.collectedData && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-700">請先完成步驟 1（蒐集資料）再執行分析。</div>
                )}
              </div>
            )}

            {/* Step 4 */}
            {currentStep.id === 4 && (
              <div className="space-y-4">
                {feedbacks[4] && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div><div className="text-xs font-medium text-amber-700">上次修改意見</div>
                    <div className="text-xs text-amber-600 mt-0.5">{feedbacks[4]}</div></div>
                  </div>
                )}
                {stepData.copy && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Claude Sonnet 生成的行銷文案</label>
                    <textarea value={stepData.copy}
                      onChange={e => setStepData(prev => ({ ...prev, copy: e.target.value }))}
                      rows={12} className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none" />
                    <p className="text-xs text-gray-400 mt-1.5">可直接編輯後繼續</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 6 */}
            {currentStep.id === 6 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">圖片生成模型</label>
                  <div className="flex gap-3">
                    {[{ id: 'flux-1-pro', name: 'FLUX.1 Pro', desc: '高品質寫實' }, { id: 'nano-banana', name: 'Nano Banana', desc: '快速多風格' }].map(m => (
                      <button key={m.id} type="button" onClick={() => setImageModel(m.id)}
                        className="flex-1 p-3 rounded-xl border-2 text-left transition-all"
                        style={imageModel === m.id ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 5%, transparent)' } : {}}>
                        <div className="text-sm font-medium">{m.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                {stepData.imageUrls && stepData.imageUrls.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">GPT-4o-mini Prompt → FAL AI 生成（{stepData.imageUrls.length} 張）</div>
                    <div className="grid grid-cols-3 gap-3">
                      {stepData.imageUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="aspect-video rounded-xl overflow-hidden border shadow-sm hover:opacity-90 transition-opacity">
                          <img src={url} alt={`行銷圖片 ${i + 1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 8 */}
            {currentStep.id === 8 && (
              <div className="space-y-4">
                {feedbacks[8] && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div><div className="text-xs font-medium text-amber-700">上次修改意見</div>
                    <div className="text-xs text-amber-600 mt-0.5">{feedbacks[8]}</div></div>
                  </div>
                )}
                {stepData.script && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Claude Sonnet 影片腳本</label>
                    <textarea value={stepData.script}
                      onChange={e => setStepData(prev => ({ ...prev, script: e.target.value }))}
                      rows={14} className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none font-mono" />
                  </div>
                )}
              </div>
            )}

            {/* Step 10 */}
            {currentStep.id === 10 && currentStatus === 'done' && (
              <div className="rounded-xl bg-gray-900 aspect-video flex items-center justify-center">
                <div className="text-center">
                  <Video className="h-12 w-12 text-gray-600 mx-auto" />
                  <div className="text-gray-400 text-sm mt-2">Kling V2 影片任務已提交</div>
                  <div className="text-gray-500 text-xs mt-1">Job ID: {stepData.videoJobId ?? '處理中'}</div>
                  <div className="text-gray-600 text-xs mt-1">通常需要 1-3 分鐘，可至影片生成頁面查看</div>
                </div>
              </div>
            )}

            {/* Step 12 */}
            {currentStep.id === 12 && (
              <div className="space-y-5">
                {/* Image platforms */}
                <div>
                  <label className="block text-sm font-semibold mb-2">🖼️ 圖文平台</label>
                  <div className="flex flex-wrap gap-2">
                    {IMAGE_PLATFORMS.map(p => (
                      <button key={p} type="button" onClick={() => togglePlatform(p)}
                        disabled={currentStatus === 'done'}
                        className="px-3 py-1.5 rounded-lg border text-sm font-medium transition-all disabled:cursor-not-allowed"
                        style={selectedPlatforms.includes(p) ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' } : {}}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video platforms */}
                <div>
                  <label className="block text-sm font-semibold mb-2">🎬 影片平台</label>
                  <div className="flex flex-wrap gap-2">
                    {VIDEO_PLATFORMS.map(p => (
                      <button key={p} type="button" onClick={() => togglePlatform(p)}
                        disabled={currentStatus === 'done'}
                        className="px-3 py-1.5 rounded-lg border text-sm font-medium transition-all disabled:cursor-not-allowed"
                        style={selectedPlatforms.includes(p) ? { borderColor: '#8b5cf6', background: '#f5f3ff', color: '#7c3aed' } : {}}>
                        {p}
                      </button>
                    ))}
                  </div>
                  {VIDEO_PLATFORMS.some(p => selectedPlatforms.includes(p)) && !stepData.videoJobId && (
                    <p className="text-xs text-amber-600 mt-2">⚠ 影片尚未生成（步驟 10），影片平台將在有影片 URL 後才能上傳。</p>
                  )}
                </div>

                <p className="text-xs text-gray-400">
                  各平台憑證請至
                  <a href="/settings" className="text-blue-500 hover:underline mx-1">設定 → 社群平台連結</a>
                  完成設定。
                </p>

                {/* Upload results */}
                {currentStatus === 'done' && uploadResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">上傳結果</div>
                    {uploadResults.map(r => (
                      <div key={r.platform} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                        r.ok ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
                      }`}>
                        {r.ok
                          ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          : <XCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />}
                        <div>
                          <span className={r.ok ? 'text-green-800 font-medium' : 'text-red-700 font-medium'}>{r.platform}</span>
                          {r.ok
                            ? <span className="text-green-700 ml-2">上傳成功{r.postId ? ` (ID: ${r.postId})` : ''}</span>
                            : <span className="text-red-600 ml-2">{r.error}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 13 done */}
            {currentStep.id === 13 && (currentStatus === 'approved' || currentStatus === 'waiting') && (
              <div className="text-center py-6">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-gray-900">行銷流程全部完成！</h3>
                <p className="text-sm text-gray-500 mt-1">完成通知已傳送至 Telegram</p>
                <p className="text-xs text-gray-400 mt-2">已發布至：{selectedPlatforms.join('、')}</p>
              </div>
            )}

            {/* Telegram steps */}
            {currentStep.type === 'telegram' && (
              <div className="space-y-4">
                {/* Telegram config status */}
                {tgConfigured === 'loading' && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> 載入 Telegram 設定中…
                  </div>
                )}
                {tgConfigured === 'missing' && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <span className="font-medium text-amber-700">尚未設定 Telegram Bot</span>
                      <span className="text-amber-600 ml-1">—</span>
                      <a href="/settings" className="ml-1 text-blue-500 hover:underline font-medium">
                        前往「設定」頁面完成設定 →
                      </a>
                    </div>
                  </div>
                )}
                {tgConfigured === 'ok' && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-100 text-sm text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>已使用您在「設定」頁面設定的 Telegram Bot 傳送通知</span>
                  </div>
                )}

                {(currentStatus === 'waiting' || currentStatus === 'approved') && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <Send className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-blue-900">已傳送至 Telegram</div>
                      <div className="text-xs text-blue-700 mt-0.5">（使用設定頁面的 Bot 設定）</div>
                      {currentStatus === 'waiting' && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-700">
                          <Clock className="h-3.5 w-3.5 animate-pulse" />
                          每 5 秒輪詢一次，等待 Telegram 回覆…
                        </div>
                      )}
                      {currentStatus === 'approved' && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-green-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> 已核准，可繼續下一步
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Content preview */}
                {currentStep.id === 5 && stepData.copy && (
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <div className="text-xs font-medium text-gray-500 mb-1.5">文案預覽</div>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">{stepData.copy}</pre>
                  </div>
                )}
                {currentStep.id === 7 && stepData.imageUrls && (
                  <div className="grid grid-cols-3 gap-2">
                    {stepData.imageUrls.map((url, i) => (
                      <img key={i} src={url} alt={`圖片 ${i + 1}`} className="rounded-lg border object-cover aspect-video" />
                    ))}
                  </div>
                )}
                {currentStep.id === 9 && stepData.script && (
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <div className="text-xs font-medium text-gray-500 mb-1.5">腳本預覽</div>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">{stepData.script}</pre>
                  </div>
                )}

                {feedbacks[currentStep.id] && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div><div className="text-xs font-medium text-red-700">已退回修改</div>
                    <div className="text-xs text-red-600 mt-0.5">{feedbacks[currentStep.id]}</div></div>
                  </div>
                )}

                {/* Local approve/reject (fallback if not using Telegram reply) */}
                {isWaiting && (
                  <div className="space-y-3">
                    <div className="text-xs text-gray-400 text-center">
                      ── 或在此手動操作（不使用 Telegram 回覆時）──
                    </div>
                    <button onClick={() => handleApprove(currentStep.id)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-500 hover:bg-green-600 transition-colors">
                      <CheckCircle2 className="h-4 w-4" /> 手動核准，繼續下一步
                    </button>
                    <div className="space-y-2">
                      <textarea value={feedbackInput} onChange={e => setFeedbackInput(e.target.value)} rows={2}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
                        placeholder="輸入修改意見…" />
                      <button onClick={() => handleReject(currentStep.id)} disabled={!feedbackInput.trim()}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                        <XCircle className="h-4 w-4" /> 手動退回修改
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action button */}
            <div className="flex gap-3 pt-2">
              {(canRun || currentStatus === 'running') && currentStep.type === 'action' && (
                <button onClick={() => runStep(currentStep.id)} disabled={currentStatus === 'running'}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
                  style={{ background: 'var(--primary)' }}>
                  {currentStatus === 'running'
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> 執行中…</>
                    : <><currentStep.icon className="h-4 w-4" /> 執行：{currentStep.label}</>}
                </button>
              )}
              {(canRun || currentStatus === 'running') && currentStep.type === 'telegram' && (
                <button onClick={() => runStep(currentStep.id)}
                  disabled={currentStatus === 'running' || tgConfigured !== 'ok'}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                  style={{ background: '#2CA5E0' }}>
                  {currentStatus === 'running'
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> 傳送中…</>
                    : <><Send className="h-4 w-4" /> 傳送至 Telegram</>}
                </button>
              )}
              {(currentStatus === 'done' || currentStatus === 'approved') && currentStep.id < STEPS.length && (
                <button onClick={() => setActiveStep(activeStep + 1)}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border text-gray-700 hover:bg-gray-50 transition-colors">
                  下一步 <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Steps overview */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b"><h3 className="font-semibold text-sm">流程總覽</h3></div>
        <div className="divide-y">
          {STEPS.map(step => {
            const Icon = step.icon
            const status = statuses[step.id]
            const cfg = STATUS_CONFIG[status]
            const isActive = step.id === activeStep
            return (
              <button key={step.id} onClick={() => setActiveStep(step.id)}
                className={`w-full flex items-center gap-4 px-6 py-3.5 text-left hover:bg-gray-50 transition-colors ${isActive ? 'bg-gray-50' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  status === 'done' || status === 'approved' ? 'bg-green-100' :
                  status === 'running'  ? 'bg-blue-100' :
                  status === 'waiting'  ? 'bg-amber-100' :
                  status === 'rejected' ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  {status === 'running'  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" /> :
                   status === 'done' || status === 'approved' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> :
                   status === 'waiting'  ? <Clock className="h-3.5 w-3.5 text-amber-600" /> :
                   status === 'rejected' ? <XCircle className="h-3.5 w-3.5 text-red-500" /> :
                   <Icon className="h-3.5 w-3.5 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
                    <span className="text-gray-400 mr-1.5">{step.id}.</span>{step.label}
                    {step.type === 'telegram' && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-medium">TG</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{step.description}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
