'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
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
  Volume2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { STORE_COACH_KNOWLEDGE } from '@/lib/store-coach/knowledge-base'
import type { DiagnosisOutput, VisionAnalysisResult } from '@/lib/types/store-coach'

type TabType = 'diagnose' | 'workstations' | 'hygiene' | 'coaching' | 'vision' | 'marketing' | 'principles'

export default function StoreCoachPage() {
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

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Load store coach base data
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
  }, [])

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
        alert('診斷請求失敗，請稍後再試')
      }
    } catch (err) {
      console.error('Diagnosis error:', err)
      alert('診斷執行發生錯誤')
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
        alert('視覺分析請求失敗')
      }
    } catch (err) {
      console.error('Vision error:', err)
      alert('視覺分析發生錯誤')
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
                  Feeling Tea 門市營運教練 AI
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300/60">
                  現場問題共解大腦
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium border border-amber-300/60">
                  七大維度 × 十層診斷
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                店長・區督導・指導員・經理人專用：標準是底線，溫暖是靈魂，動線是效率，數據是真相。
              </p>
            </div>
          </div>

          {/* 跨模組捷徑按鈕 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/store">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Store className="h-3.5 w-3.5" />
                門市首頁
              </Button>
            </Link>
            <Link href="/rd-lab">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/50">
                <FlaskConical className="h-3.5 w-3.5" />
                研發大腦 RD-LAB
              </Button>
            </Link>
            <Link href="/store/bills">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Zap className="h-3.5 w-3.5" />
                水電瓦斯冰塊
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
                <span>一杯好茶，五步傳遞 — Feeling Tea 門市營運宣言</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                我們不用冰冷的話術對待顧客，也不用刻板的清單苛責夥伴。透過科學動線減少 60% 疲憊，透過溫暖引導喚醒 100% 匠心。
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('principles')}
            className="text-xs px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-emerald-100 font-semibold border border-white/20 transition-colors shrink-0 flex items-center gap-1 self-start md:self-auto cursor-pointer"
          >
            檢視五大心法
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
            <span>🔍 十層全景診斷</span>
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
            <span>🛠️ 工作站・動線與空間配置</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'workstations' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
            }`}>
              {data.workstations.length} 站
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
            <span>🧼 衛生標準與 90秒清潔</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'hygiene' ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
            }`}>
              4 大序列
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
            <span>🤝 服務行為與教練引導</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'coaching' ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
            }`}>
              5 步心法
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
            <span>📷 現場視覺 AI 診斷 (看現場)</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'vision' ? 'bg-white/25 text-white' : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
            }`}>
              5S + 工效
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
            <span>📢 門市專屬行銷 & Zalo</span>
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
            <span>🏛️ 企業哲學與雙AI架構</span>
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
                    門市異常通報與 10 層根因穿透診斷
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    不是單純檢查勾選，而是從「配方、流程、人員、設備、動線、顧客、行銷、排班、供應鏈、法規」穿透真實病灶。
                  </p>
                </div>
                {/* 快速填入經典情境 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-400 font-medium">常見情境範例：</span>
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
                    🍯 飲品太甜/糖量偏差
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
                    ⏳ 高峰出單塞車瓶頸
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
                    🤝 新人服務冷淡/心態緊繃
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    發生門市
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
                    涉及產品 / 項目
                  </label>
                  <input
                    type="text"
                    value={selectedProduct}
                    onChange={e => setSelectedProduct(e.target.value)}
                    placeholder="例如：翡翠檸檬綠、經典大吉嶺"
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    問題範疇
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200"
                  >
                    <option value="quality">產品品質與口感 (Quality)</option>
                    <option value="efficiency">效率動線與塞車 (Efficiency)</option>
                    <option value="service">服務溫度與應對 (Service)</option>
                    <option value="hygiene">清潔衛生與食安 (Hygiene)</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    異常事件標題
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
                    現場狀況詳細描述 (包含時段、顧客反應、夥伴現場動作)
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
                  <span>自動連結研發大腦配方 Brix 度數與歷次跨店問題記憶</span>
                </div>
                <Button
                  onClick={handleRunDiagnosis}
                  disabled={diagnosing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold px-5 text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  {diagnosing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在穿透 10 層全景因果鏈...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      啟動 10 層全景診斷與根因溯源
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
                          核心根因 (Root Cause)
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
                            研發標準配方聯動
                          </span>
                          <Link
                            href={diagnosisResult.related_rd_recipe.link || '/rd-lab'}
                            className="text-[11px] underline flex items-center gap-0.5 text-purple-600 hover:text-purple-800"
                          >
                            前往配方
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        </div>
                        <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                          <div>標準糖度：<strong className="text-purple-600 dark:text-purple-400">{diagnosisResult.related_rd_recipe.target_brix}</strong></div>
                          <div>標準糖量：<strong className="text-slate-800 dark:text-slate-200">{diagnosisResult.related_rd_recipe.standard_syrup}</strong></div>
                          <div>萃取水溫：<strong className="text-slate-800 dark:text-slate-200">{diagnosisResult.related_rd_recipe.brewing_temp}</strong></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 15分鐘即刻改善 vs 預防改善 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-900/50">
                    <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl p-3.5 border border-amber-200 dark:border-amber-900/60">
                      <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-2">
                        <Clock className="h-4 w-4" />
                        【現場即刻 15 分鐘改善行動】
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
                        【中長期系統性防呆與排班預防】
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
                      10 層因果穿透全景分析檢視
                    </h3>
                    <span className="text-xs text-slate-400">點擊任意層可展開/收合詳細發現與處方</span>
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
                                  ● 核心病灶
                                </span>
                              )}
                              {isSuspect && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">
                                  ▲ 疑似關聯
                                </span>
                              )}
                              {isNormal && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                                  ✓ 標準正常
                                </span>
                              )}
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                            </div>
                          </div>

                          {/* 展開之診斷與證據 */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs space-y-1.5 animate-fadeIn">
                              <div>
                                <span className="font-semibold text-slate-500 dark:text-slate-400">現場發現：</span>
                                <span className="text-slate-900 dark:text-slate-100 font-medium ml-1">{layer.finding}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-500 dark:text-slate-400">佐證指標：</span>
                                <span className="text-slate-700 dark:text-slate-300 ml-1">{layer.evidence}</span>
                              </div>
                              <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 mt-1">
                                <span className="font-bold text-emerald-700 dark:text-emerald-400">改善處方：</span>
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
                          教練對話 Playbook
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-white">
                          店長與夥伴現場 5 步驟啟發引導話術（非責備式）
                        </h3>
                      </div>
                      <p className="text-xs text-emerald-200 mt-0.5">
                        引導夥伴主動發現偏差、理解原因、達成行動共識，維護團隊心理安全感。
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        const d = diagnosisResult.coaching_dialogue
                        const fullText = `【店長教練對話引導腳本】\n1. 同理辛勞：${d.step_1_empathy}\n2. 客觀陳述：${d.step_2_factual_observation}\n3. 啟發提問：${d.step_3_guiding_question}\n4. 共同約定：${d.step_4_action_agreement}\n5. 賦能激勵：${d.step_5_empowerment}`
                        handleCopy(fullText, 'dialogue')
                      }}
                      className="bg-white/20 hover:bg-white/30 text-white text-xs gap-1.5 self-start sm:self-auto shrink-0 cursor-pointer"
                    >
                      {copiedKey === 'dialogue' ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedKey === 'dialogue' ? '已複製教練腳本' : '複製完整話術'}
                    </Button>
                  </div>

                  <div className="space-y-2.5">
                    <div className="bg-black/25 rounded-xl p-3 border border-white/10 text-xs">
                      <span className="font-bold text-emerald-300 block mb-0.5">① 同理辛勞 (Empathy & Appreciation)：</span>
                      <p className="text-slate-200 pl-3 border-l-2 border-emerald-400">{diagnosisResult.coaching_dialogue.step_1_empathy}</p>
                    </div>
                    <div className="bg-black/25 rounded-xl p-3 border border-white/10 text-xs">
                      <span className="font-bold text-teal-300 block mb-0.5">② 客觀陳述事實 (Factual Observation)：</span>
                      <p className="text-slate-200 pl-3 border-l-2 border-teal-400">{diagnosisResult.coaching_dialogue.step_2_factual_observation}</p>
                    </div>
                    <div className="bg-black/25 rounded-xl p-3 border border-white/10 text-xs">
                      <span className="font-bold text-amber-300 block mb-0.5">③ 啟發式提問 (Guiding Question)：</span>
                      <p className="text-slate-200 pl-3 border-l-2 border-amber-400">{diagnosisResult.coaching_dialogue.step_3_guiding_question}</p>
                    </div>
                    <div className="bg-black/25 rounded-xl p-3 border border-white/10 text-xs">
                      <span className="font-bold text-sky-300 block mb-0.5">④ 改善行動共識 (Action Agreement & Demo)：</span>
                      <p className="text-slate-200 pl-3 border-l-2 border-sky-400">{diagnosisResult.coaching_dialogue.step_4_action_agreement}</p>
                    </div>
                    <div className="bg-black/25 rounded-xl p-3 border border-white/10 text-xs">
                      <span className="font-bold text-purple-300 block mb-0.5">⑤ 賦能與激勵 (Empowerment & Trust)：</span>
                      <p className="text-slate-200 pl-3 border-l-2 border-purple-400">{diagnosisResult.coaching_dialogue.step_5_empowerment}</p>
                    </div>
                  </div>
                </div>

                {/* 企業歷次記憶庫比對 */}
                {diagnosisResult.similar_past_cases && diagnosisResult.similar_past_cases.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-xs">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      跨店知識記憶：歷史類似案例與驗證解決方案
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {diagnosisResult.similar_past_cases.map((cs, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{cs.problem_title}</div>
                          <div className="text-slate-500 mt-0.5">根因：{cs.root_cause}</div>
                          <div className="text-emerald-700 dark:text-emerald-400 font-semibold mt-1">成效：{cs.effectiveness_result}</div>
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
                  三大標準店型配置 (Layouts) 與黃金動線
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  流程決定動線，動線決定配置。消除 100% 交叉碰撞與逆向折返，創造最高出杯人效。
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
                        <span>尖峰時速：</span>
                        <strong className="text-emerald-600 dark:text-emerald-400">{layout.peak_capacity_cups_hr} 杯/小時</strong>
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
                    【{selectedLayout.name}】工作站排列順序與動線管制
                  </h4>
                  <span className="text-slate-500 font-medium">建議配置人數：{selectedLayout.staff_count_min}-{selectedLayout.staff_count_max} 人</span>
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
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">動線設計特點：</span>
                  <p className="text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">{selectedLayout.movement_characteristics}</p>
                </div>
              </div>
            </div>

            {/* 五大核心工作站與人體工學 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Coffee className="h-5 w-5 text-emerald-600" />
                  五大核心工作站 (Workstations) 與 45cm 圓弧人體工學
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  所有高頻使用的茶湯、糖漿、冰塊必須落在「手肘不離身體 45cm 直覺伸手範圍」內，避免無效彎腰與踏步。
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
                    <span className="font-bold text-slate-500 dark:text-slate-400 block mb-1">【工作站定位與職責】</span>
                    <p className="text-sm font-medium text-slate-900 dark:text-white leading-relaxed">
                      {selectedStation.purpose}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 block mb-1">【黃金人體工學標準 (Ergonomics)】</span>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                      {selectedStation.ergonomics_rule}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-slate-500 dark:text-slate-400 block mb-1">【站內核心設備與器具】</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedStation.equipment_list.map((eq, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                          {eq}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                    <span className="font-bold text-rose-800 dark:text-rose-300 block mb-1">【常見致命動線失誤 (Pitfalls)】</span>
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
                  Feeling Tea 三色抹布分色法則（絕對零容忍混用）
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  抹布混用是手搖飲門市交叉污染的最大來源。嚴格遵循三色專用與每日漂白浸泡。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border-2 border-blue-400 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-4 w-4 rounded-full bg-blue-600 shrink-0" />
                    <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200">藍色專用抹布 (出杯吧檯)</h4>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    專門擦拭「調茶吧檯檯面、出杯操作區、雪克杯外壁」。保持潔淨無油污。
                  </p>
                  <div className="mt-2 text-[11px] text-blue-800 dark:text-blue-400 font-semibold">
                    ✕ 嚴禁碰觸地面或水槽底
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border-2 border-amber-400 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-4 w-4 rounded-full bg-amber-500 shrink-0" />
                    <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">黃色專用抹布 (出茶嘴/蒸奶棒)</h4>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    專門擦拭「保溫茶桶出水龍頭、蒸奶管、果糖噴嘴」。必須在每次出茶後立即順手擦拭。
                  </p>
                  <div className="mt-2 text-[11px] text-amber-800 dark:text-amber-400 font-semibold">
                    ✕ 嚴禁擦拭垃圾桶周遭或桌面
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border-2 border-rose-400 dark:border-rose-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-4 w-4 rounded-full bg-rose-600 shrink-0" />
                    <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">紅色專用抹布 (水槽/地面)</h4>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    專門擦拭「中島水槽排水槽壁、吧檯腳踏區水漬、垃圾桶外圍」。
                  </p>
                  <div className="mt-2 text-[11px] text-rose-800 dark:text-rose-400 font-semibold">
                    ✕ 嚴禁上吧檯接觸任何調茶器具
                  </div>
                </div>
              </div>
            </div>

            {/* 4 大 90 秒快閃清潔序列 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-emerald-600" />
                  四大 90 秒快閃清潔標準 (90-Second Flash Cleaning Sequences)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  清潔不是等到打烊花兩小時痛苦清掃，而是在每次換茶、交接的「90 秒微節奏」中隨時歸零。
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
                      目標時長：{selectedCleaningSeq.target_duration_seconds} 秒 | 執行時機：{selectedCleaningSeq.trigger_timing}
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
                          <span className="text-emerald-600 font-mono">{st.duration_seconds} 秒</span>
                        </div>
                        <p className="text-slate-500 mt-0.5">{st.tool_needed}</p>
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">關鍵要點：{st.quality_checkpoint}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-lg bg-emerald-100/60 dark:bg-emerald-950/40 text-xs text-emerald-900 dark:text-emerald-200 font-medium">
                  <strong>檢驗標準：</strong> {selectedCleaningSeq.success_criteria}
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
                  Feeling Tea 顧客服務行為準則 (Service Behaviors)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  服務的溫度來自於被看見與被在乎。落實「進店3秒眼神問候」與「30秒無條件重調政策」。
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
                      標準語術：「{sb.standard_dialogue}」
                    </div>

                    <div className="space-y-1 text-slate-600 dark:text-slate-300">
                      <div><strong>肢體神態：</strong>{sb.body_language}</div>
                      <div><strong>心理效應：</strong>{sb.psychological_impact}</div>
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
                  門市指導員「五步引導式教練法」與夥伴職能矩陣
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  教練的最高境界是「讓夥伴自己講出答案」。從同理心出發，共創行動共識。
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
                      範例：{cm.example_script}
                    </div>
                  </div>
                ))}
              </div>

              {/* 夥伴與店長職能雷達 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-4 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-emerald-600" />
                    調茶師夥伴 6 大核心職能
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
                    門市店長 6 大領導職能
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
                  現場視覺 AI 診斷（看現場 Vision AI）
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  上傳門市吧檯、冷藏庫、排水槽或出杯檯現場照片，AI 自動辨識 5S 整理整頓、抹布分色合規性、出糖嘴乾涸滴漏與工效安全。
                </p>
              </div>

              {/* 場景選擇與照片上傳區 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    拍攝場景類別
                  </label>
                  <select
                    value={visionScene}
                    onChange={e => setVisionScene(e.target.value as any)}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 mb-3"
                  >
                    <option value="bar_station">吧檯調茶工作站 (Bar Station)</option>
                    <option value="refrigerator">原料冷藏冰箱/冷凍庫 (Refrigerator)</option>
                    <option value="sink_drain">中島洗滌槽與排水濾網 (Sink & Drain)</option>
                    <option value="cashier_pickup">點餐收銀與取餐台 (Cashier & Pickup)</option>
                  </select>

                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    上傳現場照片 (支援手機相機即拍)
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
                        {customImageBase64 ? '已成功載入現場照片 (點此可重新選擇)' : '點擊選擇檔案或拍照上傳'}
                      </span>
                      <span className="text-[11px] text-slate-400">支援 JPG, PNG, WEBP (亦可直接點擊下方執行標準範例稽核)</span>
                    </label>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-xs flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                      <Eye className="h-4 w-4 text-emerald-600" />
                      Vision AI 檢測焦點
                    </h4>
                    <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                      <li>• <strong>5S 整理整頓：</strong>非必要雜物是否上吧？物料是否在 45cm 圓弧內？</li>
                      <li>• <strong>抹布分色檢查：</strong>有無藍、黃、紅抹布混用違規情事？</li>
                      <li>• <strong>出糖嘴與茶桶：</strong>是否有乾涸結晶糖漬、出茶嘴積垢？</li>
                      <li>• <strong>冷藏效期管理：</strong>備料盒是否貼齊三聯標籤（品名/效期/人員）？</li>
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
                        AI 正在掃描影像與 5S 工效...
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4" />
                        執行現場視覺 AI 稽核
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
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">5S 總合得分</span>
                      <strong className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {visionResult.score_5s.total} / 100
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">食安衛生合規率</span>
                      <strong className="text-2xl font-black text-blue-600 dark:text-blue-400">
                        {visionResult.hygiene_compliance.score}%
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">工效受傷/疲勞風險</span>
                      <strong className={`text-lg font-black ${
                        visionResult.ergonomic_risk === 'high' ? 'text-rose-600' : visionResult.ergonomic_risk === 'medium' ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {visionResult.ergonomic_risk === 'high' ? '高風險' : visionResult.ergonomic_risk === 'medium' ? '中度警示' : '良好低風險'}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">檢測異常缺失點</span>
                      <strong className="text-2xl font-black text-purple-600 dark:text-purple-400">
                        {visionResult.defects.length} 項
                      </strong>
                    </div>
                  </div>

                  {/* 缺失項卡片 */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      現場影像缺失精準定位與改善處方
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
                          改善建議：{df.corrective_action}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 即刻教練引導 Tip */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-900 to-teal-900 text-white text-xs">
                    <span className="font-bold text-emerald-300 block mb-1">【督導現場教練對話指引】</span>
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
                  門市專屬行銷與 Zalo 官方帳號本地運營
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  每家門市都有自己的專屬 Zalo 官方帳號 (OA)，支援門市天氣即時推播、午後下午茶推播、熟客印花集點。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {data.zaloAccounts.map((acc, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {acc.store_code} 專屬帳號
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                        {acc.status}
                      </span>
                    </div>

                    <div className="text-slate-700 dark:text-slate-300">
                      <div><strong>OA 名稱：</strong>{acc.oa_name}</div>
                      <div><strong>關注粉絲數：</strong>{acc.follower_count.toLocaleString()} 位本地熟客</div>
                      <div><strong>自動化推播：</strong>{acc.auto_broadcast_rules}</div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">掃描 QR Code 即可一鍵加入該店熟客群</span>
                      <Button size="sm" variant="outline" className="text-xs h-7 cursor-pointer">
                        發送推播測試
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
                  Feeling Tea 五大經營哲學與企業底層信仰
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  所有標準、動線、配方、考核的源頭。當現場遇到未知情境時，以企業哲學為決策指南針。
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
                      <strong>門市落地行為：</strong>{cp.operational_standard}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <h4 className="font-bold text-purple-200 text-sm flex items-center gap-1.5">
                    <FlaskConical className="h-4 w-4" />
                    門市營運教練 AI × 研發數位大腦 RD-LAB 協同架構
                  </h4>
                  <Link href="/rd-lab">
                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-7 gap-1 cursor-pointer">
                      打開 RD-LAB
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  研發 AI 與門市教練 AI 共享同一套 Feeling Tea 原料庫、配方 Brix 度數與食安標準。
                  當門市現場發生甜度偏高時，門市教練會自動向研發大腦索取標準糖度；當研發推出新飲品時，門市教練自動在工作站配置中預測瓶頸並更新 90 秒快閃清潔標準。
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
