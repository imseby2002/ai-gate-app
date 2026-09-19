'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import {
  Compass,
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Send,
  Camera,
  Upload,
  Eye,
  ShieldCheck,
  Award,
  Zap,
  Clock,
  LayoutGrid,
  ChevronRight,
  ChevronDown,
  Info,
  Sliders,
  Store,
  Users,
  MessageSquare,
  FileCheck,
  HeartHandshake,
  TrendingUp,
  FlaskConical,
  Coffee,
  ArrowRight,
  ExternalLink,
  Flame,
  Volume2,
  GraduationCap,
  BookOpen,
  FileText,
  Plus,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { STORE_COACH_KNOWLEDGE } from '@/lib/store-coach/knowledge-base'
import type { DiagnosisOutput, VisionAnalysisResult, StoreLearningMaterial, CompanyRegulation } from '@/lib/types/store-coach'

type TabType = 'diagnose' | 'workstations' | 'hygiene' | 'coaching' | 'vision' | 'marketing' | 'principles' | 'learning'

export default function StoreCoachPage() {
  const t = useTranslations('StoreCoachPage')
  const locale = useLocale()
  const [activeTab, setActiveTab] = useState<TabType>('diagnose')
  const [data, setData] = useState(STORE_COACH_KNOWLEDGE)
  const [loading, setLoading] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // 10-Layer Diagnosis State
  const [problemTitle, setProblemTitle] = useState('多位顧客反映翡翠檸檬綠太甜、喉嚨有黏膩感')
  const [problemDesc, setProblemDesc] = useState('下午 15:30-17:00 兩組外帶客人反應微糖還是太甜，調茶出單速度有些許延遲。')
  const [selectedProduct, setSelectedProduct] = useState('翡翠檸檬綠')
  const [selectedCategory, setSelectedCategory] = useState('quality')
  const [selectedStore, setSelectedStore] = useState('TNN-01 (台南旗艦店)')
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisOutput | null>(null)
  const [expandedLayer, setExpandedLayer] = useState<number | string | null>(1)

  // Layout & Workstation State
  const [selectedLayoutId, setSelectedLayoutId] = useState('LAYOUT-01')
  const [selectedStationId, setSelectedStationId] = useState('WS-02')

  // Hygiene & 90s Cleaning State
  const [selectedSeqId, setSelectedSeqId] = useState('SOP-CLEAN-02')

  // Vision AI State
  const [visionScene, setVisionScene] = useState<'bar_station' | 'refrigerator' | 'sink_drain' | 'cashier_pickup'>('bar_station')
  const [visionLoading, setVisionLoading] = useState(false)
  const [visionResult, setVisionResult] = useState<VisionAnalysisResult | null>(null)
  const [customImageBase64, setCustomImageBase64] = useState<string | null>(null)

  // Learning Materials State
  const [learningMaterials, setLearningMaterials] = useState<StoreLearningMaterial[]>([])
  const [learnTitle, setLearnTitle] = useState('')
  const [learnType, setLearnType] = useState('sop_manual')
  const [learnUrl, setLearnUrl] = useState('')
  const [learnContent, setLearnContent] = useState('')
  const [learnDimension, setLearnDimension] = useState('sop')
  const [learnStoreCode, setLearnStoreCode] = useState('ALL')
  const [isLearning, setIsLearning] = useState(false)
  const [learnNotice, setLearnNotice] = useState('')
  const [lastLearnedMaterial, setLastLearnedMaterial] = useState<StoreLearningMaterial | null>(null)
  const [learnSearch, setLearnSearch] = useState('')
  const [learnDimFilter, setLearnDimFilter] = useState('all')

  // Coach Q&A based on learned data
  const [coachQuery, setCoachQuery] = useState('')
  const [coachAnswer, setCoachAnswer] = useState('')
  const [isAskingCoach, setIsAskingCoach] = useState(false)

  const fetchLearningMaterials = async () => {
    try {
      const res = await fetch('/api/store/coach/learn')
      if (res.ok) {
        const json = await res.json()
        setLearningMaterials(json.materials || [])
      }
    } catch (err) {
      console.warn('Failed to fetch learning materials:', err)
    }
  }

  // Company Regulations State
  const [regulations, setRegulations] = useState<CompanyRegulation[]>(STORE_COACH_KNOWLEDGE.companyRegulations || [])
  const [regTitle, setRegTitle] = useState('')
  const [regCode, setRegCode] = useState('')
  const [regCategory, setRegCategory] = useState('food_safety')
  const [regClause, setRegClause] = useState('')
  const [regPenalty, setRegPenalty] = useState('')
  const [regEnforcement, setRegEnforcement] = useState('')
  const [regLevel, setRegLevel] = useState('strict')
  const [isSubmittingReg, setIsSubmittingReg] = useState(false)
  const [regNotice, setRegNotice] = useState('')
  const [regFilterCat, setRegFilterCat] = useState('all')

  // Compliance AI Consultation
  const [regQuery, setRegQuery] = useState('')
  const [regAnswer, setRegAnswer] = useState('')
  const [isAskingReg, setIsAskingReg] = useState(false)

  const fetchRegulations = async () => {
    try {
      const res = await fetch('/api/store/coach/regulations')
      if (res.ok) {
        const json = await res.json()
        if (json.regulations && json.regulations.length > 0) {
          setRegulations(json.regulations)
        }
      }
    } catch (err) {
      console.warn('Failed to fetch regulations:', err)
    }
  }

  // Handle Transmit Regulation to Coach
  const handleTransmitRegulation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regTitle.trim() || !regClause.trim()) {
      alert(t('fillRegTitleAndClause'))
      return
    }
    setIsSubmittingReg(true)
    setRegNotice('')
    try {
      const res = await fetch('/api/store/coach/regulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: regTitle,
          code: regCode,
          category: regCategory,
          clause_content: regClause,
          violation_penalty: regPenalty,
          manager_enforcement: regEnforcement,
          mandatory_level: regLevel,
        }),
      })
      if (res.ok) {
        setRegNotice(t('regTransmitSuccess'))
        setRegTitle('')
        setRegCode('')
        setRegClause('')
        setRegPenalty('')
        setRegEnforcement('')
        fetchRegulations()
      } else {
        alert(t('regTransmitFailed'))
      }
    } catch (err) {
      console.error('Transmit regulation error:', err)
      alert(t('regTransmitError'))
    } finally {
      setIsSubmittingReg(false)
    }
  }

  // Handle Consult Compliance AI
  const handleAskCompliance = async () => {
    if (!regQuery.trim()) return
    setIsAskingReg(true)
    setRegAnswer('')
    try {
      const res = await fetch('/api/store/coach/regulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query_prompt: regQuery,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        setRegAnswer(json.answer)
      } else {
        alert(t('regAskFailed'))
      }
    } catch (err) {
      console.error('Compliance AI error:', err)
      alert(t('regAskError'))
    } finally {
      setIsAskingReg(false)
    }
  }

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Load store coach base data, learning materials, and company regulations
  useEffect(() => {
    async function fetchStoreCoachData() {
      try {
        const res = await fetch('/api/store/coach')
        if (res.ok) {
          const json = await res.json()
          setData(prev => ({ ...prev, ...json }))
        }
      } catch (err) {
        console.warn('Failed to fetch store coach data, using knowledge fallback:', err)
      }
    }
    fetchStoreCoachData()
    fetchLearningMaterials()
    fetchRegulations()
  }, [])

  // Handle Learning Ingestion
  const handleIngestMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!learnTitle.trim() && !learnContent.trim()) {
      alert(t('enterTitleOrContent'))
      return
    }
    setIsLearning(true)
    setLearnNotice('')
    try {
      const res = await fetch('/api/store/coach/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: learnTitle,
          source_type: learnType,
          source_url: learnUrl,
          raw_content: learnContent,
          dimension: learnDimension,
          store_code: learnStoreCode,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        setLastLearnedMaterial(json.material)
        setLearnNotice(t('ingestSuccess'))
        setLearnTitle('')
        setLearnUrl('')
        setLearnContent('')
        fetchLearningMaterials()
      } else {
        alert(t('ingestFailed'))
      }
    } catch (err) {
      console.error('Learn ingestion error:', err)
      alert(t('ingestError'))
    } finally {
      setIsLearning(false)
    }
  }

  // Handle Ask Coach based on Learned Materials
  const handleAskCoach = async () => {
    if (!coachQuery.trim()) return
    setIsAskingCoach(true)
    setCoachAnswer('')
    try {
      const res = await fetch('/api/store/coach/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query_prompt: coachQuery,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        setCoachAnswer(json.answer)
      } else {
        alert(t('coachAskFailed'))
      }
    } catch (err) {
      console.error('Ask coach error:', err)
      alert(t('coachAskError'))
    } finally {
      setIsAskingCoach(false)
    }
  }

  // Execute 10-Layer Diagnosis
  const handleRunDiagnosis = async () => {
    if (!problemTitle.trim()) return
    setDiagnosing(true)
    try {
      const res = await fetch('/api/store/coach/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_title: problemTitle,
          problem_description: problemDesc,
          product_name: selectedProduct,
          category: selectedCategory,
          store_code: selectedStore.split(' ')[0],
        }),
      })
      if (res.ok) {
        const result: DiagnosisOutput = await res.json()
        setDiagnosisResult(result)
        const rootCauseLayer = result.layers.find(l => l.status === 'root_cause')
        if (rootCauseLayer) {
          setExpandedLayer(rootCauseLayer.layer)
        }
      } else {
        alert(t('diagnosisFailed'))
      }
    } catch (err) {
      console.error('Diagnosis error:', err)
      alert(t('diagnosisError'))
    } finally {
      setDiagnosing(false)
    }
  }

  // Execute Vision AI Inspection
  const handleRunVision = async () => {
    setVisionLoading(true)
    try {
      const res = await fetch('/api/store/coach/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene_type: visionScene,
          store_code: selectedStore.split(' ')[0],
          image_base64: customImageBase64 || '',
        }),
      })
      if (res.ok) {
        const json = await res.json()
        setVisionResult(json.data)
      } else {
        alert(t('visionFailed'))
      }
    } catch (err) {
      console.error('Vision error:', err)
      alert(t('visionError'))
    } finally {
      setVisionLoading(false)
    }
  }

  // Handle image upload for vision AI
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1]
        setCustomImageBase64(base64String)
      }
      reader.readAsDataURL(file)
    }
  }

  const selectedLayout = useMemo(() => {
    return data.layouts.find(l => l.id === selectedLayoutId) || data.layouts[0]
  }, [data.layouts, selectedLayoutId])

  const selectedStation = useMemo(() => {
    return data.workstations.find(w => w.id === selectedStationId) || data.workstations[0]
  }, [data.workstations, selectedStationId])

  const selectedCleaningSeq = useMemo(() => {
    return data.cleaningSequences.find(s => s.id === selectedSeqId) || data.cleaningSequences[0]
  }, [data.cleaningSequences, selectedSeqId])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
      {/* 頂部導覽列與企業理念 Banner */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Feeling Tea {t('headerTitle')}
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300/60">
                  {t('headerBadge1')}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium border border-amber-300/60">
                  {t('headerBadge2')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('headerSubtitle')}
              </p>
            </div>
          </div>

          {/* 跨模組捷徑按鈕 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/store">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Store className="h-3.5 w-3.5" />
                {t('storeHomeLink')}
              </Button>
            </Link>
            <Link href="/rd-lab">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/50">
                <FlaskConical className="h-3.5 w-3.5" />
                {t('rdLabLink')}
              </Button>
            </Link>
            <Link href="/store/bills">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Zap className="h-3.5 w-3.5" />
                {t('billsLink')}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 核心企業底層心法 Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 border border-emerald-700/40">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-400/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-200 flex items-center gap-2">
                <span>{t('manifestoTitle')}</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {t('manifestoDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('principles')}
            className="text-xs px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-emerald-100 font-semibold border border-white/20 transition-colors shrink-0 flex items-center gap-1 self-start md:self-auto cursor-pointer"
          >
            {t('viewPrinciples')}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        {/* 核心功能分頁 Navigation Tabs (自適應換行排列 flex-wrap gap-2，徹底杜絕橫向捲軸) */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-200/80 dark:bg-slate-900/80 rounded-2xl border border-slate-300/80 dark:border-slate-800 text-xs sm:text-sm font-medium mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('diagnose')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-medium cursor-pointer ${
              activeTab === 'diagnose'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 hover:bg-white/90 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Search className="h-4 w-4 shrink-0" />
            <span>{t('tabDiagnose')}</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'diagnose' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            }`}>
              10-Layers
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workstations')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-medium cursor-pointer ${
              activeTab === 'workstations'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 hover:bg-white/90 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <LayoutGrid className="h-4 w-4 shrink-0" />
            <span>{t('tabWorkstations')}</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'workstations' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
            }`}>
              {t('stationsCount', { n: data.workstations.length })}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hygiene')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-medium cursor-pointer ${
              activeTab === 'hygiene'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 hover:bg-white/90 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>{t('tabHygiene')}</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'hygiene' ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
            }`}>
              {t('fourSequences')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('coaching')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-medium cursor-pointer ${
              activeTab === 'coaching'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 hover:bg-white/90 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <HeartHandshake className="h-4 w-4 shrink-0" />
            <span>{t('tabCoaching')}</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'coaching' ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
            }`}>
              {t('fiveSteps')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vision')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-medium cursor-pointer ${
              activeTab === 'vision'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 hover:bg-white/90 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Camera className="h-4 w-4 shrink-0" />
            <span>{t('tabVision')}</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'vision' ? 'bg-white/25 text-white' : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
            }`}>
              {t('fiveSEfficiency')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('marketing')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-medium cursor-pointer ${
              activeTab === 'marketing'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 hover:bg-white/90 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span>{t('tabMarketing')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('principles')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-medium cursor-pointer ${
              activeTab === 'principles'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 hover:bg-white/90 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Award className="h-4 w-4 shrink-0" />
            <span>{t('tabPrinciples')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('learning')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-medium cursor-pointer ${
              activeTab === 'learning'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 hover:bg-white/90 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <GraduationCap className="h-4 w-4 shrink-0" />
            <span>{t('tabLearning')}</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'learning' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            }`}>
              {t('articlesCount', { n: learningMaterials.length })}
            </span>
          </button>
        </div>

        {/* TAB 1: 🔍 十層全景診斷 (10-Layer Diagnosis) */}
        {activeTab === 'diagnose' && (
          <div className="space-y-6">
            {/* 輸入面板 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-emerald-600" />
                    {t('diagnoseTitle')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('diagnoseDesc')}
                  </p>
                </div>
                {/* 快速填入經典情境 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-400 font-medium">{t('commonScenariosLabel')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setProblemTitle('多位顧客反映翡翠檸檬綠太甜、喉嚨有黏膩感')
                      setProblemDesc('下午 15:30-17:00 兩組外帶客人反應微糖還是太甜，調茶出單速度有些許延遲。')
                      setSelectedProduct('翡翠檸檬綠')
                      setSelectedCategory('quality')
                    }}
                    className="text-xs px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
                  >
                    {t('scenarioSweet')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProblemTitle('下午茶外送尖峰時段，出單到封口出現瓶頸積單 15 杯')
                      setProblemDesc('調茶師頻繁在茶桶與封口機之間來回走動，取冰槽動線被點餐人員擋住，導致顧客催單。')
                      setSelectedProduct('全部熱門飲品')
                      setSelectedCategory('efficiency')
                    }}
                    className="text-xs px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 cursor-pointer"
                  >
                    {t('scenarioBottleneck')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProblemTitle('新進工讀夥伴在點餐時面部緊繃無笑容，遭熟客投訴態度冷淡')
                      setProblemDesc('晚班新夥伴剛來兩週，記不熟收銀 POS 促銷活動鍵，遇到客人催促時低頭慌張，未說進店問候語。')
                      setSelectedProduct('服務接觸')
                      setSelectedCategory('service')
                    }}
                    className="text-xs px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 cursor-pointer"
                  >
                    {t('scenarioColdService')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('occurredStoreLabel')}
                  </label>
                  <select
                    value={selectedStore}
                    onChange={e => setSelectedStore(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200"
                  >
                    <option>TNN-01 (台南旗艦店)</option>
                    <option>TPE-02 (台北信義門市)</option>
                    <option>KHH-03 (高雄巨蛋門市)</option>
                    <option>SGN-01 (胡志明第一郡示範店)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('involvedProductLabel')}
                  </label>
                  <input
                    type="text"
                    value={selectedProduct}
                    onChange={e => setSelectedProduct(e.target.value)}
                    placeholder={t('involvedProductPlaceholder')}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('problemScopeLabel')}
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200"
                  >
                    <option value="quality">{t('categoryQuality')}</option>
                    <option value="efficiency">{t('categoryEfficiency')}</option>
                    <option value="service">{t('categoryService')}</option>
                    <option value="hygiene">{t('categoryHygiene')}</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('eventTitleLabel')}
                  </label>
                  <input
                    type="text"
                    value={problemTitle}
                    onChange={e => setProblemTitle(e.target.value)}
                    className="w-full text-sm font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('detailedDescLabel')}
                  </label>
                  <textarea
                    rows={2}
                    value={problemDesc}
                    onChange={e => setProblemDesc(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>{t('autoLinkHint')}</span>
                </div>
                <Button
                  onClick={handleRunDiagnosis}
                  disabled={diagnosing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold px-5 text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  {diagnosing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('diagnosingInProgress')}
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      {t('runDiagnosisButton')}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* 診斷結果呈現區 */}
            {diagnosisResult && (
              <div className="space-y-5 animate-fadeIn">
                {/* 核心根因與 15 分鐘行動 Summary Banner */}
                <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-white dark:from-slate-900 dark:via-emerald-950/20 dark:to-slate-900 rounded-2xl p-5 border-2 border-emerald-500/40 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-2 max-w-3xl">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 text-xs rounded-full font-bold bg-rose-600 text-white flex items-center gap-1 shadow-xs">
                          <Flame className="h-3 w-3" />
                          {t('rootCauseLabel')}
                        </span>
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                          {diagnosisResult.related_rd_recipe?.name}
                        </span>
                      </div>
                      <p className="text-base font-bold text-slate-900 dark:text-white leading-relaxed">
                        {diagnosisResult.root_cause_summary}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {diagnosisResult.problem_analysis}
                      </p>
                    </div>

                    {/* 研發大腦配方標準卡 */}
                    {diagnosisResult.related_rd_recipe && (
                      <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-purple-200 dark:border-purple-800 shadow-xs shrink-0 lg:w-72">
                        <div className="flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-300 mb-1.5">
                          <span className="flex items-center gap-1">
                            <FlaskConical className="h-3.5 w-3.5" />
                            {t('rdRecipeLinkLabel')}
                          </span>
                          <Link
                            href={diagnosisResult.related_rd_recipe.link || '/rd-lab'}
                            className="text-[11px] underline flex items-center gap-0.5 text-purple-600 hover:text-purple-800"
                          >
                            {t('goToRecipe')}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        </div>
                        <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                          <div>{t('standardBrixLabel')}<strong className="text-purple-600 dark:text-purple-400">{diagnosisResult.related_rd_recipe.target_brix}</strong></div>
                          <div>{t('standardSyrupLabel')}<strong className="text-slate-800 dark:text-slate-200">{diagnosisResult.related_rd_recipe.standard_syrup}</strong></div>
                          <div>{t('brewingTempLabel')}<strong className="text-slate-800 dark:text-slate-200">{diagnosisResult.related_rd_recipe.brewing_temp}</strong></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 15分鐘即刻改善 vs 預防改善 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-900/50">
                    <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl p-3.5 border border-amber-200 dark:border-amber-900/60">
                      <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-2">
                        <Clock className="h-4 w-4" />
                        {t('immediateActionsTitle')}
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                        {diagnosisResult.immediate_actions.map((act, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-600 font-bold shrink-0">{i + 1}.</span>
                            <span>{act}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl p-3.5 border border-emerald-200 dark:border-emerald-900/60">
                      <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 mb-2">
                        <ShieldCheck className="h-4 w-4" />
                        {t('preventiveActionsTitle')}
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                        {diagnosisResult.preventive_actions.map((act, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-600 font-bold shrink-0">{i + 1}.</span>
                            <span>{act}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 10 層全景診斷矩陣展開區 */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Layers className="h-4 w-4 text-emerald-600" />
                      {t('layersAnalysisTitle')}
                    </h3>
                    <span className="text-xs text-slate-400">{t('layersAnalysisHint')}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {diagnosisResult.layers.map(layer => {
                      const isRoot = layer.status === 'root_cause'
                      const isSuspect = layer.status === 'suspect'
                      const isNormal = layer.status === 'normal'
                      const isExpanded = expandedLayer === layer.layer

                      return (
                        <div
                          key={layer.layer}
                          onClick={() => setExpandedLayer(isExpanded ? null : layer.layer)}
                          className={`rounded-xl p-3.5 border transition-all cursor-pointer ${
                            isRoot
                              ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900 ring-1 ring-rose-400'
                              : isSuspect
                              ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900'
                              : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                                isRoot ? 'bg-rose-600 text-white' : isSuspect ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                              }`}>
                                L{layer.layer}
                              </span>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {layer.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {isRoot && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200">
                                  {t('coreLesionBadge')}
                                </span>
                              )}
                              {isSuspect && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">
                                  {t('suspectedLinkBadge')}
                                </span>
                              )}
                              {isNormal && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                                  {t('normalBadge')}
                                </span>
                              )}
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                            </div>
                          </div>

                          {/* 展開之診斷與證據 */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs space-y-1.5 animate-fadeIn">
                              <div>
                                <span className="font-semibold text-slate-500 dark:text-slate-400">{t('findingLabel')}</span>
                                <span className="text-slate-900 dark:text-slate-100 font-medium ml-1">{layer.finding}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-500 dark:text-slate-400">{t('evidenceLabel')}</span>
                                <span className="text-slate-700 dark:text-slate-300 ml-1">{layer.evidence}</span>
                              </div>
                              <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 mt-1">
                                <span className="font-bold text-emerald-700 dark:text-emerald-400">{t('remedyLabel')}</span>
                                <span className="text-slate-800 dark:text-slate-200 ml-1">{layer.remedy}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 5 步驟引導式教練話術 (Manager Coaching Dialogue) */}
                <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-emerald-700/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-400 text-emerald-950 font-black">
                          {t('coachingPlaybookBadge')}
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-white">
                          {t('coachingPlaybookTitle')}
                        </h3>
                      </div>
                      <p className="text-xs text-emerald-200 mt-0.5">
                        {t('coachingPlaybookDesc')}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        const d = diagnosisResult.coaching_dialogue
                        const fullText = t('coachingScriptTemplate', { empathy: d.step_1_empathy, factual: d.step_2_factual_observation, question: d.step_3_guiding_question, agreement: d.step_4_action_agreement, empowerment: d.step_5_empowerment })
                        handleCopy(fullText, 'dialogue')
                      }}
                      className="bg-white/20 hover:bg-white/30 text-white text-xs gap-1.5 self-start sm:self-auto shrink-0 cursor-pointer"
                    >
                      {copiedKey === 'dialogue' ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedKey === 'dialogue' ? t('copiedScript') : t('copyFullScript')}
                    </Button>
                  </div>

                  <div className="space-y-2.5">
                    <div className="bg-black/25 rounded-xl p-3 border border-white/10 text-xs">
                      <span className="font-bold text-emerald-300 block mb-0.5">{t('step1Label')}</span>
                      <p className="text-slate-200 pl-3 border-l-2 border-emerald-400">{diagnosisResult.coaching_dialogue.step_1_empathy}</p>
                    </div>
                    <div className="bg-black/25 rounded-xl p-3 border border-white/10 text-xs">
                      <span className="font-bold text-teal-300 block mb-0.5">{t('step2Label')}</span>
                      <p className="text-slate-200 pl-3 border-l-2 border-teal-400">{diagnosisResult.coaching_dialogue.step_2_factual_observation}</p>
                    </div>
                    <div className="bg-black/25 rounded-xl p-3 border border-white/10 text-xs">
                      <span className="font-bold text-amber-300 block mb-0.5">{t('step3Label')}</span>
                      <p className="text-slate-200 pl-3 border-l-2 border-amber-400">{diagnosisResult.coaching_dialogue.step_3_guiding_question}</p>
                    </div>
                    <div className="bg-black/25 rounded-xl p-3 border border-white/10 text-xs">
                      <span className="font-bold text-sky-300 block mb-0.5">{t('step4Label')}</span>
                      <p className="text-slate-200 pl-3 border-l-2 border-sky-400">{diagnosisResult.coaching_dialogue.step_4_action_agreement}</p>
                    </div>
                    <div className="bg-black/25 rounded-xl p-3 border border-white/10 text-xs">
                      <span className="font-bold text-purple-300 block mb-0.5">{t('step5Label')}</span>
                      <p className="text-slate-200 pl-3 border-l-2 border-purple-400">{diagnosisResult.coaching_dialogue.step_5_empowerment}</p>
                    </div>
                  </div>
                </div>

                {/* 企業歷次記憶庫比對 */}
                {diagnosisResult.similar_past_cases && diagnosisResult.similar_past_cases.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-xs">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      {t('crossStoreMemoryTitle')}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {diagnosisResult.similar_past_cases.map((cs, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{cs.problem_title}</div>
                          <div className="text-slate-500 mt-0.5">{t('rootCauseColon')}{cs.root_cause}</div>
                          <div className="text-emerald-700 dark:text-emerald-400 font-semibold mt-1">{t('effectivenessColon')}{cs.effectiveness_result}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: 🛠️ 工作站・動線與空間配置 (Workstations & Layouts) */}
        {activeTab === 'workstations' && (
          <div className="space-y-6">
            {/* 三大標準店型空間配置 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-emerald-600" />
                  {t('layoutsTitle')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('layoutsDesc')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                {data.layouts.map(layout => {
                  const isSelected = selectedLayoutId === layout.id
                  return (
                    <div
                      key={layout.id}
                      onClick={() => setSelectedLayoutId(layout.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          {layout.code}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                          {layout.target_area_ping}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                        {layout.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                        {layout.description}
                      </p>
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span>{t('peakHourlyRateLabel')}</span>
                        <strong className="text-emerald-600 dark:text-emerald-400">{t('cupsPerHour', { n: layout.peak_capacity_cups_hr })}</strong>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 選定店型之工作站順序與動線規則 */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-emerald-600" />
                    {t('stationOrderTitle', { name: selectedLayout.name })}
                  </h4>
                  <span className="text-slate-500 font-medium">{t('recommendedStaffCount', { min: selectedLayout.staff_count_min, max: selectedLayout.staff_count_max })}</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {selectedLayout.station_sequence.map((st, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs">
                        {idx + 1}. {st}
                      </span>
                      {idx < selectedLayout.station_sequence.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{t('flowDesignFeaturesLabel')}</span>
                  <p className="text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">{selectedLayout.movement_characteristics}</p>
                </div>
              </div>
            </div>

            {/* 五大核心工作站與人體工學 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Coffee className="h-5 w-5 text-emerald-600" />
                  {t('workstationsTitle')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('workstationsDesc')}
                </p>
              </div>

              {/* 工作站切換 Tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                {data.workstations.map(ws => (
                  <button
                    key={ws.id}
                    onClick={() => setSelectedStationId(ws.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedStationId === ws.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {ws.name}
                  </button>
                ))}
              </div>

              {/* 選定工作站規格卡片 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-slate-500 dark:text-slate-400 block mb-1">{t('stationPurposeLabel')}</span>
                    <p className="text-sm font-medium text-slate-900 dark:text-white leading-relaxed">
                      {selectedStation.purpose}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 block mb-1">{t('ergonomicsLabel')}</span>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                      {selectedStation.ergonomics_rule}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-slate-500 dark:text-slate-400 block mb-1">{t('equipmentListLabel')}</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedStation.equipment_list.map((eq, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                          {eq}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                    <span className="font-bold text-rose-800 dark:text-rose-300 block mb-1">{t('pitfallsLabel')}</span>
                    <p className="text-rose-900 dark:text-rose-200 leading-relaxed">
                      {selectedStation.common_mistakes}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 🧼 衛生標準與 90秒清潔 (Hygiene & 90s Cleaning) */}
        {activeTab === 'hygiene' && (
          <div className="space-y-6">
            {/* 三色抹布分色管理 (絕對防呆) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  {t('threeColorClothTitle')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('threeColorClothDesc')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border-2 border-blue-400 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-4 w-4 rounded-full bg-blue-600 shrink-0" />
                    <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200">{t('blueClothTitle')}</h4>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    {t('blueClothDesc')}
                  </p>
                  <div className="mt-2 text-[11px] text-blue-800 dark:text-blue-400 font-semibold">
                    {t('blueClothWarning')}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border-2 border-amber-400 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-4 w-4 rounded-full bg-amber-500 shrink-0" />
                    <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">{t('yellowClothTitle')}</h4>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    {t('yellowClothDesc')}
                  </p>
                  <div className="mt-2 text-[11px] text-amber-800 dark:text-amber-400 font-semibold">
                    {t('yellowClothWarning')}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border-2 border-rose-400 dark:border-rose-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-4 w-4 rounded-full bg-rose-600 shrink-0" />
                    <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">{t('redClothTitle')}</h4>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    {t('redClothDesc')}
                  </p>
                  <div className="mt-2 text-[11px] text-rose-800 dark:text-rose-400 font-semibold">
                    {t('redClothWarning')}
                  </div>
                </div>
              </div>
            </div>

            {/* 4 大 90 秒快閃清潔序列 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-emerald-600" />
                  {t('flashCleaningTitle')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('flashCleaningDesc')}
                </p>
              </div>

              {/* 序列選擇按鈕 */}
              <div className="flex flex-wrap gap-2 mb-4">
                {data.cleaningSequences.map(seq => (
                  <button
                    key={seq.id}
                    onClick={() => setSelectedSeqId(seq.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedSeqId === seq.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    ⏱️ {seq.title}
                  </button>
                ))}
              </div>

              {/* 選定清潔序列詳情卡 */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedCleaningSeq.title}
                    </h4>
                    <span className="text-xs text-emerald-600 font-semibold">
                      {t('targetDurationLabel', { n: selectedCleaningSeq.target_duration_seconds })} | {t('triggerTimingLabel')}{selectedCleaningSeq.trigger_timing}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-xs">
                    90s Flash Clean
                  </span>
                </div>

                {/* 步驟時間條列 */}
                <div className="space-y-2 mb-4">
                  {selectedCleaningSeq.steps.map((st, i) => (
                    <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                      <span className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                        {st.step_number}
                      </span>
                      <div className="grow">
                        <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
                          <span>{st.action}</span>
                          <span className="text-emerald-600 font-mono">{t('secondsLabel', { n: st.duration_seconds })}</span>
                        </div>
                        <p className="text-slate-500 mt-0.5">{st.tool_needed}</p>
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">{t('keyPointLabel')}{st.quality_checkpoint}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-lg bg-emerald-100/60 dark:bg-emerald-950/40 text-xs text-emerald-900 dark:text-emerald-200 font-medium">
                  <strong>{t('successCriteriaLabel')}</strong> {selectedCleaningSeq.success_criteria}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 🤝 服務行為與教練引導 (Behaviors & Coaching) */}
        {activeTab === 'coaching' && (
          <div className="space-y-6">
            {/* 3秒問候與30秒重做機制 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <HeartHandshake className="h-5 w-5 text-emerald-600" />
                  {t('serviceBehaviorsTitle')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('serviceBehaviorsDesc')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {data.serviceBehaviors.map((sb, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {sb.scenario}
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                        {sb.code}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-medium text-emerald-700 dark:text-emerald-400 mb-2">
                      {t('standardScriptLabel', { text: sb.standard_dialogue })}
                    </div>

                    <div className="space-y-1 text-slate-600 dark:text-slate-300">
                      <div><strong>{t('bodyLanguageLabel')}</strong>{sb.body_language}</div>
                      <div><strong>{t('psychologicalImpactLabel')}</strong>{sb.psychological_impact}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 引導式教練五步法 (5-Step Coaching Method) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-600" />
                  {t('fiveStepCoachingTitle')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('fiveStepCoachingDesc')}
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {data.coachingMethods.map((cm, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px]">
                          {cm.step_order}
                        </span>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{cm.name}</h4>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 pl-7">{cm.instruction}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 font-medium text-emerald-700 dark:text-emerald-400 pl-7 sm:pl-3 max-w-sm shrink-0">
                      {t('exampleLabel')}{cm.example_script}
                    </div>
                  </div>
                ))}
              </div>

              {/* 夥伴與店長職能雷達 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-4 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-emerald-600" />
                    {t('baristaCompetenciesTitle')}
                  </h4>
                  <div className="space-y-2">
                    {data.employeeCompetencies.map((comp, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{comp.title} ({comp.category})</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{comp.observable_behavior}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <Award className="h-4 w-4 text-purple-600" />
                    {t('managerCompetenciesTitle')}
                  </h4>
                  <div className="space-y-2">
                    {data.managerCompetencies.map((comp, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{comp.title} ({comp.category})</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{comp.observable_behavior}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: 📷 現場視覺 AI 診斷 (Vision AI "看現場") */}
        {activeTab === 'vision' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Camera className="h-5 w-5 text-emerald-600" />
                  {t('visionAiTitle')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('visionAiDesc')}
                </p>
              </div>

              {/* 場景選擇與照片上傳區 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('sceneTypeLabel')}
                  </label>
                  <select
                    value={visionScene}
                    onChange={e => setVisionScene(e.target.value as any)}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 mb-3"
                  >
                    <option value="bar_station">{t('sceneBarStation')}</option>
                    <option value="refrigerator">{t('sceneRefrigerator')}</option>
                    <option value="sink_drain">{t('sceneSinkDrain')}</option>
                    <option value="cashier_pickup">{t('sceneCashierPickup')}</option>
                  </select>

                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('uploadSceneLabel')}
                  </label>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center hover:border-emerald-500 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id="vision-file-input"
                    />
                    <label htmlFor="vision-file-input" className="cursor-pointer flex flex-col items-center gap-1.5">
                      <Upload className="h-6 w-6 text-slate-400" />
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {customImageBase64 ? t('imageLoadedHint') : t('clickToUploadHint')}
                      </span>
                      <span className="text-[11px] text-slate-400">{t('supportedFormatsHint')}</span>
                    </label>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-xs flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                      <Eye className="h-4 w-4 text-emerald-600" />
                      {t('visionFocusTitle')}
                    </h4>
                    <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                      <li>• <strong>{t('focus5sLabel')}</strong>{t('focus5sDesc')}</li>
                      <li>• <strong>{t('focusClothLabel')}</strong>{t('focusClothDesc')}</li>
                      <li>• <strong>{t('focusNozzleLabel')}</strong>{t('focusNozzleDesc')}</li>
                      <li>• <strong>{t('focusExpiryLabel')}</strong>{t('focusExpiryDesc')}</li>
                    </ul>
                  </div>

                  <Button
                    onClick={handleRunVision}
                    disabled={visionLoading}
                    className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 rounded-xl cursor-pointer"
                  >
                    {visionLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('visionScanning')}
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4" />
                        {t('runVisionAudit')}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* 視覺診斷成果 */}
              {visionResult && (
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800 animate-fadeIn">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">{t('score5sLabel')}</span>
                      <strong className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {visionResult.score_5s.total} / 100
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">{t('hygieneComplianceLabel')}</span>
                      <strong className="text-2xl font-black text-blue-600 dark:text-blue-400">
                        {visionResult.hygiene_compliance.score}%
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">{t('ergonomicRiskLabel')}</span>
                      <strong className={`text-lg font-black ${
                        visionResult.ergonomic_risk === 'high' ? 'text-rose-600' : visionResult.ergonomic_risk === 'medium' ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {visionResult.ergonomic_risk === 'high' ? t('riskHigh') : visionResult.ergonomic_risk === 'medium' ? t('riskMedium') : t('riskLow')}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">{t('defectsFoundLabel')}</span>
                      <strong className="text-2xl font-black text-purple-600 dark:text-purple-400">
                        {t('itemsCount', { n: visionResult.defects.length })}
                      </strong>
                    </div>
                  </div>

                  {/* 缺失項卡片 */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {t('defectLocationTitle')}
                    </h4>
                    {visionResult.defects.map((df, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                              df.severity === 'high' ? 'bg-rose-600 text-white' : df.severity === 'medium' ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-800'
                            }`}>
                              {df.location}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{df.issue}</span>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-400 font-medium shrink-0">
                          {t('improvementSuggestionLabel')}{df.corrective_action}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 即刻教練引導 Tip */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-900 to-teal-900 text-white text-xs">
                    <span className="font-bold text-emerald-300 block mb-1">{t('supervisorCoachingTipLabel')}</span>
                    <p className="text-slate-200 leading-relaxed">{visionResult.immediate_coaching_tip}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: 📢 門市專屬行銷 & Zalo 運營 (Local Marketing & Zalo) */}
        {activeTab === 'marketing' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-emerald-600" />
                  {t('marketingTitle')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('marketingDesc')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {data.zaloAccounts.map((acc, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {t('dedicatedAccountLabel', { code: acc.store_code })}
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                        {acc.status}
                      </span>
                    </div>

                    <div className="text-slate-700 dark:text-slate-300">
                      <div><strong>{t('oaNameLabel')}</strong>{acc.oa_name}</div>
                      <div><strong>{t('followerCountLabel')}</strong>{t('localFollowersCount', { n: acc.follower_count.toLocaleString() })}</div>
                      <div><strong>{t('autoBroadcastLabel')}</strong>{acc.auto_broadcast_rules}</div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">{t('qrJoinHint')}</span>
                      <Button size="sm" variant="outline" className="text-xs h-7 cursor-pointer">
                        {t('sendTestBroadcast')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: 🏛️ 企業經營哲學與底層知識 (Principles & Knowledge) */}
        {activeTab === 'principles' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-600" />
                  {t('principlesTitle')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('principlesDesc')}
                </p>
              </div>

              <div className="space-y-3">
                {data.companyPrinciples.map((cp, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        0{cp.order_seq}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {cp.core_value}
                      </h4>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 pl-8 leading-relaxed font-medium">
                      {cp.philosophy_statement}
                    </p>
                    <div className="mt-2 pl-8 text-[11px] text-emerald-700 dark:text-emerald-400">
                      <strong>{t('operationalStandardLabel')}</strong>{cp.operational_standard}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <h4 className="font-bold text-purple-200 text-sm flex items-center gap-1.5">
                    <FlaskConical className="h-4 w-4" />
                    {t('rdCollaborationTitle')}
                  </h4>
                  <Link href="/rd-lab">
                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-7 gap-1 cursor-pointer">
                      {t('openRdLab')}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {t('rdCollaborationDesc')}
                </p>
              </div>
            </div>

            {/* 公司正式規章、紅線與員工守則 (Corporate Regulations & Compliance) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-rose-600" />
                      {t('regulationsTitle', { n: regulations.length })}
                    </h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold border border-rose-200">
                      {t('strictRedLineBadge')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('regulationsDesc')}
                  </p>
                </div>
              </div>

              {/* 傳遞新規章表單 */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 mb-5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-2">
                  {t('transmitRegFormTitle')}
                </span>
                <form onSubmit={handleTransmitRegulation} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {t('regNameLabel')}
                      </label>
                      <input
                        type="text"
                        required
                        value={regTitle}
                        onChange={e => setRegTitle(e.target.value)}
                        placeholder={t('regNamePlaceholder')}
                        className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {t('regCodeLabel')}
                      </label>
                      <input
                        type="text"
                        value={regCode}
                        onChange={e => setRegCode(e.target.value)}
                        placeholder="REG-DISC-07"
                        className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {t('regCategoryLabel')}
                      </label>
                      <select
                        value={regCategory}
                        onChange={e => setRegCategory(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
                      >
                        <option value="food_safety">{t('regCatFoodSafety')}</option>
                        <option value="employee_conduct">{t('regCatConduct')}</option>
                        <option value="store_safety">{t('regCatStoreSafety')}</option>
                        <option value="customer_crisis">{t('regCatCrisis')}</option>
                        <option value="confidentiality">{t('regCatConfidentiality')}</option>
                        <option value="labor_shift">{t('regCatLaborShift')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {t('redLineLevelLabel')}
                      </label>
                      <select
                        value={regLevel}
                        onChange={e => setRegLevel(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
                      >
                        <option value="strict">{t('levelStrict')}</option>
                        <option value="standard">{t('levelStandard')}</option>
                        <option value="guideline">{t('levelGuideline')}</option>
                      </select>
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {t('regClauseRequiredLabel')}
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={regClause}
                        onChange={e => setRegClause(e.target.value)}
                        placeholder={t('regClausePlaceholder')}
                        className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {t('regPenaltyLabel')}
                      </label>
                      <input
                        type="text"
                        value={regPenalty}
                        onChange={e => setRegPenalty(e.target.value)}
                        placeholder={t('regPenaltyPlaceholder')}
                        className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {t('regEnforcementLabel')}
                      </label>
                      <input
                        type="text"
                        value={regEnforcement}
                        onChange={e => setRegEnforcement(e.target.value)}
                        placeholder={t('regEnforcementPlaceholder')}
                        className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      {t('regSubmitHint')}
                    </span>
                    <Button
                      type="submit"
                      disabled={isSubmittingReg}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg gap-1.5 cursor-pointer"
                    >
                      {isSubmittingReg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      {t('transmitRegButton')}
                    </Button>
                  </div>
                </form>

                {regNotice && (
                  <div className="mt-2.5 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{regNotice}</span>
                  </div>
                )}
              </div>

              {/* 規章合規諮詢 AI (Compliance Assistant Q&A) */}
              <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 text-xs mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold">
                    {t('complianceAiBadge')}
                  </span>
                  <h4 className="font-bold text-white text-xs sm:text-sm">
                    {t('complianceAiTitle')}
                  </h4>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <input
                    type="text"
                    value={regQuery}
                    onChange={e => setRegQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAskCompliance()
                    }}
                    placeholder={t('complianceQueryPlaceholder')}
                    className="grow text-xs rounded-lg border border-slate-700 bg-slate-800 text-white px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-400"
                  />
                  <Button
                    onClick={handleAskCompliance}
                    disabled={isAskingReg}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-lg shrink-0 cursor-pointer"
                  >
                    {isAskingReg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    {t('consultRegulations')}
                  </Button>
                </div>

                {/* 快速提問標籤 */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400">
                  <span>{t('commonRegQueriesLabel')}</span>
                  <button
                    type="button"
                    onClick={() => setRegQuery('收銀員私自收取現金未打 POS 單，公司處分規定是什麼？')}
                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
                  >
                    {t('sampleQueryCashHandling')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegQuery('原料賞味期過了或是標籤塗改，依照公司紅線如何懲處？')}
                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
                  >
                    {t('sampleQueryExpiredMaterial')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegQuery('員工把公司配方表拍照傳到社群網路，公司法律責任為何？')}
                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
                  >
                    {t('sampleQueryRecipeLeak')}
                  </button>
                </div>

                {regAnswer && (
                  <div className="mt-3 p-3 rounded-lg bg-black/40 border border-rose-500/40 text-slate-200 space-y-1.5 leading-relaxed whitespace-pre-line">
                    <strong className="text-rose-400 block font-bold">{t('aiRegulationReplyLabel')}</strong>
                    <div>{regAnswer}</div>
                  </div>
                )}
              </div>

              {/* 規章清單 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('currentRegListTitle')}
                  </h4>
                  <div className="flex items-center gap-1 flex-wrap text-xs">
                    {['all', 'food_safety', 'employee_conduct', 'confidentiality', 'store_safety', 'customer_crisis'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setRegFilterCat(cat)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          regFilterCat === cat
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {cat === 'all' ? t('regFilterAll') : cat === 'food_safety' ? t('regFilterFoodSafety') : cat === 'employee_conduct' ? t('regFilterConduct') : cat === 'confidentiality' ? t('regFilterConfidentiality') : cat === 'store_safety' ? t('regFilterStoreSafety') : t('regFilterCrisis')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {regulations
                    .filter(r => regFilterCat === 'all' || r.category === regFilterCat)
                    .map(reg => (
                      <div
                        key={reg.id}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-[11px]">
                            {reg.code}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            reg.mandatory_level === 'strict'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {reg.mandatory_level === 'strict' ? t('strictRedLineTag') : t('standardRuleTag')}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                          {reg.title}
                        </h4>

                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                          {reg.clause_content}
                        </p>

                        <div className="p-2.5 rounded-lg bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-[11px] text-rose-900 dark:text-rose-200">
                          <strong>{t('violationPenaltyLabel')}</strong> {reg.violation_penalty}
                        </div>

                        {reg.manager_enforcement && (
                          <div className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-[11px] text-emerald-900 dark:text-emerald-200">
                            <strong>{t('managerCheckGuideLabel')}</strong> {reg.manager_enforcement}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: 📚 資料餵入與主動學習 (Data Learning & Knowledge Ingestion) */}
        {activeTab === 'learning' && (
          <div className="space-y-6 animate-fadeIn">
            {/* 知識餵入輸入面板 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-emerald-600" />
                    {t('learningCenterTitle')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('learningCenterDesc')}
                  </p>
                </div>
              </div>

              {/* 4 大快速範本一鍵帶入 */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 mb-4">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                  {t('quickTemplatesLabel')}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setLearnTitle('【總部SOP】打烊保溫茶桶深度除垢與密封環消毒指引')
                      setLearnType('sop_manual')
                      setLearnDimension('hygiene')
                      setLearnUrl('https://internal.feelingtea.com/sop/tea-urn-sanitation')
                      setLearnContent(`保溫茶桶出水龍頭在長期使用後，喉管內部容易附著單寧酸茶垢與微細水垢，若未每日拆卸浸泡，會導致出茶帶有陳年茶酸味。\n標準打烊流程：\n1. 每日打烊前以 70°C 溫水沖泡食用級檸檬酸粉 (比例 1:50)，注入茶桶浸泡 20 分鐘。\n2. 拆卸出水龍頭矽膠密封環，置於 75% 食品級酒精浸泡碗中，嚴禁使用粗糙菜瓜布刷洗以防刮傷漏水。\n3. 隔日開早以 85°C 煮沸純水徹底循環沖洗兩次後，方可注入新鮮基底茶。`)
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-300 dark:border-slate-600 transition-colors cursor-pointer"
                  >
                    {t('template1Label')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLearnTitle('【督導現場實證】尖峰外送雙軌叫號防催單與防漏做策略')
                      setLearnType('audit_report')
                      setLearnDimension('workflow')
                      setLearnUrl('https://internal.feelingtea.com/audit/rush-delivery-queue')
                      setLearnContent(`台南旗艦店在外送平台促銷期間，外送員常聚集於取餐台前催單，造成現場散客感受壓迫，且調茶師常因外送多杯重疊而跳單漏料。\n改善對策實證：\n1. 設立獨立「外送待取區」於取餐櫃檯右側 1.5 公尺處，劃定藍色等待標線，與現場散客取餐動線物理隔離。\n2. 實施「雙標籤貼單制」：一張貼杯身、一張貼外帶袋口，調茶師做完由機動手核對雙標籤無誤後裝袋打結，杜絕漏放吸管與誤拿。\n3. 平台接單設定前置製作緩衝時間由 8 分鐘彈性調整為 12 分鐘。`)
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-amber-50 hover:text-amber-700 border border-slate-300 dark:border-slate-600 transition-colors cursor-pointer"
                  >
                    {t('template2Label')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLearnTitle('【客訴應對案例】冰塊融化導致飲品口感變淡的換新與試飲挽回法')
                      setLearnType('complaint_case')
                      setLearnDimension('coaching')
                      setLearnUrl('')
                      setLearnContent(`顧客外帶一杯微冰四季春，在店內座位區待了 30 分鐘後向櫃台抱怨「茶喝起來很淡，像白開水一樣」。\n現場店長標準處置流程：\n1. 第一時間微笑接過飲料，同理顧客感受：「不好意思，四季春放久冰塊融化確實會把茶香沖淡！」\n2. 絕不爭辯「那是因為您放太久」，立即啟動 30 秒重調政策：「我立刻幫您用剛煮好的現泡茶湯，重做一杯微冰黃金比例！」\n3. 遞送新茶時雙手奉上，並贈送一張新品試飲卡：「這是我們今日現煮的高山四季春，趁冰度剛好時品嚐香氣最鮮美！」`)
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-700 border border-slate-300 dark:border-slate-600 transition-colors cursor-pointer"
                  >
                    {t('template3Label')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLearnTitle('【設備校準查核】蒸汽奶棒噴嘴與紅外線溫度槍每週校正指南')
                      setLearnType('supervisor_guide')
                      setLearnDimension('workstation')
                      setLearnUrl('')
                      setLearnContent(`熱飲奶泡綿密度與熱飲溫度是否精準 (標準 65°C)，直接影響鮮奶甜感與香氣。\n每週校準標準：\n1. 蒸奶棒使用專用通針清理四個氣孔，以牛奶除垢液浸泡 15 分鐘後排空蒸氣 3 次。\n2. 紅外線溫度槍與水銀標準溫度計同步測量 65°C 熱水，誤差超過 ±1.5°C 需更換電池或校正發射率。\n3. 測試打發 200ml 全脂鮮奶，細緻微氣泡綿密層厚度需達 1.5cm。`)
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-purple-50 hover:text-purple-700 border border-slate-300 dark:border-slate-600 transition-colors cursor-pointer"
                  >
                    {t('template4Label')}
                  </button>
                </div>
              </div>

              {/* 餵入表單 */}
              <form onSubmit={handleIngestMaterial} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('dataTitleRequiredLabel')}
                    </label>
                    <input
                      type="text"
                      required
                      value={learnTitle}
                      onChange={e => setLearnTitle(e.target.value)}
                      placeholder={t('dataTitlePlaceholder')}
                      className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('dataSourceTypeLabel')}
                    </label>
                    <select
                      value={learnType}
                      onChange={e => setLearnType(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200"
                    >
                      <option value="sop_manual">{t('sourceTypeSop')}</option>
                      <option value="audit_report">{t('sourceTypeAudit')}</option>
                      <option value="complaint_case">{t('sourceTypeComplaint')}</option>
                      <option value="supervisor_guide">{t('sourceTypeSupervisor')}</option>
                      <option value="external_benchmark">{t('sourceTypeBenchmark')}</option>
                      <option value="video_url">{t('sourceTypeVideo')}</option>
                      <option value="owner_memo">{t('sourceTypeOwnerMemo')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('mainDimensionLabel')}
                    </label>
                    <select
                      value={learnDimension}
                      onChange={e => setLearnDimension(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200"
                    >
                      <option value="sop">{t('dimSop')}</option>
                      <option value="workflow">{t('dimWorkflow')}</option>
                      <option value="workstation">{t('dimWorkstation')}</option>
                      <option value="movement">{t('dimMovement')}</option>
                      <option value="hygiene">{t('dimHygiene')}</option>
                      <option value="coaching">{t('dimCoaching')}</option>
                      <option value="problem_memory">{t('dimProblemMemory')}</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('refUrlLabel')}
                    </label>
                    <input
                      type="url"
                      value={learnUrl}
                      onChange={e => setLearnUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('applicableStoreLabel')}
                    </label>
                    <select
                      value={learnStoreCode}
                      onChange={e => setLearnStoreCode(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200"
                    >
                      <option value="ALL">{t('storeAllGlobal')}</option>
                      <option value="TNN-01">{t('storeTnn01')}</option>
                      <option value="TPE-02">{t('storeTpe02')}</option>
                      <option value="KHH-03">{t('storeKhh03')}</option>
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('rawContentLabel')}
                    </label>
                    <textarea
                      rows={5}
                      required
                      value={learnContent}
                      onChange={e => setLearnContent(e.target.value)}
                      placeholder={t('rawContentPlaceholder')}
                      className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <span>{t('aiExtractHint')}</span>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLearning}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-5 py-2 rounded-xl gap-2 shadow-md cursor-pointer"
                  >
                    {isLearning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('aiStructuringInProgress')}
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        {t('ingestAndLearnButton')}
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* 成功反饋訊息 */}
              {learnNotice && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{learnNotice}</span>
                </div>
              )}
            </div>

            {/* 最新學習成果卡片 (剛剛學會的知識) */}
            {lastLearnedMaterial && (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-white dark:from-slate-900 dark:via-emerald-950/20 dark:to-slate-900 border-2 border-emerald-500/50 shadow-sm animate-fadeIn">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-600 text-white flex items-center gap-1 shadow-xs">
                      <Sparkles className="h-3 w-3" />
                      {t('latestKnowledgeBadge')}
                    </span>
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      {t('evidenceLevelLabel', { level: lastLearnedMaterial.evidence_level ?? '' })}
                      {lastLearnedMaterial.evidence_level === 'A' ? t('evidenceLevelA') : lastLearnedMaterial.evidence_level === 'B' ? t('evidenceLevelB') : lastLearnedMaterial.evidence_level === 'C' ? t('evidenceLevelC') : t('evidenceLevelD')})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">{t('dimensionLabel')}{lastLearnedMaterial.dimension}</span>
                </div>

                <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                  {lastLearnedMaterial.title}
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  {lastLearnedMaterial.ai_summary}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-emerald-200 dark:border-emerald-900/40 text-xs">
                  <div className="bg-white/90 dark:bg-slate-800/90 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <strong className="text-emerald-800 dark:text-emerald-300 block mb-1">{t('keyTakeawaysLabel')}</strong>
                    <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                      {lastLearnedMaterial.key_takeaways?.map((kt, idx) => (
                        <li key={idx}>• {kt}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white/90 dark:bg-slate-800/90 p-3 rounded-xl border border-teal-200 dark:border-teal-800">
                    <strong className="text-teal-800 dark:text-teal-300 block mb-1">{t('actionableRulesLabel')}</strong>
                    <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                      {lastLearnedMaterial.actionable_rules?.map((r, idx) => (
                        <li key={idx}>✓ {r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 互動驗證：向已研讀學習的教練現場發問 */}
            <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 text-white rounded-2xl p-5 border border-emerald-700/50 shadow-md">
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-400 text-emerald-950 font-black">
                    {t('learningVerifyBadge')}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {t('learningVerifyTitle')}
                  </h3>
                </div>
                <p className="text-xs text-emerald-200 mt-0.5">
                  {t('learningVerifyDesc')}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <input
                  type="text"
                  value={coachQuery}
                  onChange={e => setCoachQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAskCoach()
                  }}
                  placeholder={t('coachQueryPlaceholder')}
                  className="grow text-xs rounded-xl border border-emerald-700/80 bg-slate-900/90 text-white px-3.5 py-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <Button
                  onClick={handleAskCoach}
                  disabled={isAskingCoach}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-5 rounded-xl gap-1.5 shrink-0 cursor-pointer"
                >
                  {isAskingCoach ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t('coachRetrievingMaterial')}
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      {t('testQuestionButton')}
                    </>
                  )}
                </Button>
              </div>

              {/* 快速提問標籤 */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-300">
                <span className="text-[11px] text-emerald-300 font-semibold">{t('recommendedQueriesLabel')}</span>
                <button
                  type="button"
                  onClick={() => setCoachQuery('打烊保溫茶桶如何深度除垢？矽膠密封環可以用菜瓜布刷嗎？')}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 cursor-pointer"
                >
                  {t('sampleCoachQueryTeaUrn')}
                </button>
                <button
                  type="button"
                  onClick={() => setCoachQuery('尖峰時段外送員一直在吧檯前催單，我們該如何劃分動線和貼單防漏？')}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 cursor-pointer"
                >
                  {t('sampleCoachQueryDelivery')}
                </button>
                <button
                  type="button"
                  onClick={() => setCoachQuery('客人說冰塊融化茶變淡了，店長要怎麼教新夥伴親切應對並重做？')}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 cursor-pointer"
                >
                  {t('sampleCoachQueryDilutedTea')}
                </button>
              </div>

              {/* 教練回答區 */}
              {coachAnswer && (
                <div className="mt-4 p-4 rounded-xl bg-black/40 border border-emerald-500/40 text-xs text-slate-200 space-y-2 animate-fadeIn leading-relaxed whitespace-pre-line">
                  <div className="flex items-center justify-between text-emerald-300 font-bold mb-1">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" />
                      {t('coachAnswerBasedOnLabel')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(coachAnswer, 'coach_ans')}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'coach_ans' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedKey === 'coach_ans' ? t('copiedLabel') : t('copyAnswerLabel')}
                    </button>
                  </div>
                  <div>{coachAnswer}</div>
                </div>
              )}
            </div>

            {/* 已研讀之營運知識庫 (Knowledge Material Repository) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-emerald-600" />
                    {t('knowledgeBaseTitle', { n: learningMaterials.length })}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('knowledgeBaseDesc')}
                  </p>
                </div>

                {/* 維度過濾 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={learnDimFilter}
                    onChange={e => setLearnDimFilter(e.target.value)}
                    className="text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-slate-800 dark:text-slate-200"
                  >
                    <option value="all">{t('filterAllDims')}</option>
                    <option value="sop">{t('filterDimSop')}</option>
                    <option value="workflow">{t('filterDimWorkflow')}</option>
                    <option value="hygiene">{t('filterDimHygiene')}</option>
                    <option value="coaching">{t('filterDimCoaching')}</option>
                    <option value="workstation">{t('filterDimWorkstation')}</option>
                  </select>

                  <input
                    type="text"
                    value={learnSearch}
                    onChange={e => setLearnSearch(e.target.value)}
                    placeholder={t('searchLearnedKeywordPlaceholder')}
                    className="text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-slate-800 dark:text-slate-200 w-40 sm:w-48"
                  />
                </div>
              </div>

              {/* 知識卡片清單 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {learningMaterials
                  .filter(m => {
                    const matchDim = learnDimFilter === 'all' || m.dimension === learnDimFilter
                    const matchSearch =
                      !learnSearch ||
                      m.title.toLowerCase().includes(learnSearch.toLowerCase()) ||
                      m.raw_content.toLowerCase().includes(learnSearch.toLowerCase()) ||
                      (m.ai_summary || '').toLowerCase().includes(learnSearch.toLowerCase())
                    return matchDim && matchSearch
                  })
                  .map(mat => (
                    <div
                      key={mat.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col justify-between text-xs space-y-2 hover:border-emerald-500/60 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {mat.dimension.toUpperCase()}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                            {t('evidenceLevelShort', { level: mat.evidence_level || 'B' })}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-2">
                          {mat.title}
                        </h4>

                        <p className="text-slate-600 dark:text-slate-300 mt-1 line-clamp-3 leading-relaxed">
                          {mat.ai_summary || mat.raw_content}
                        </p>

                        {mat.key_takeaways && mat.key_takeaways.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-1">
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                              {t('keyPointsColonLabel')}
                            </span>
                            {mat.key_takeaways.slice(0, 2).map((k, idx) => (
                              <div key={idx} className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1">
                                • {k}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{mat.author_role || t('operationsAdvisorFallback')}</span>
                        <span>{new Date(mat.created_at || '').toLocaleDateString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
