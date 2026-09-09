'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  ShieldAlert,
  Scale,
  Bot,
  Layers,
  Sparkles,
  ClipboardList,
  History,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Send,
  Sliders,
  ChevronRight,
  Database,
  Cpu,
  Eye,
  Camera,
  Coffee,
  Check,
  Flame,
  Clock,
  UserCheck,
  FileText,
  Boxes,
  Compass,
  MessageSquare,
  Sparkle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type {
  AuditRule,
  AuditRuleStatus,
  AuditRuleVersion,
  MaterialConsumptionRow,
  CopilotMode,
  AuditSuggestionCard,
  AuditKnowledgeLog,
  AuditPlatformOverview,
} from '@/lib/types/audit-platform'

type PlatformTab = 'material' | 'copilot' | 'rules' | 'composition' | 'modules' | 'logs'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  mode: CopilotMode
  timestamp: string
  suggestion?: AuditSuggestionCard
}

export default function AuditPlatformPage() {
  const [activeTab, setActiveTab] = useState<PlatformTab>('material')
  const [loading, setLoading] = useState(false)
  const [targetStore, setTargetStore] = useState('胡志明一號旗艦店 (HCM-01)')
  const [targetDate, setTargetDate] = useState('2026-09-08')

  // 推算引擎資料
  const [materialRows, setMaterialRows] = useState<MaterialConsumptionRow[]>([])
  const [totalRawLoss, setTotalRawLoss] = useState(0)
  const [totalAdjustedLoss, setTotalAdjustedLoss] = useState(0)
  const [appliedRulesSummary, setAppliedRulesSummary] = useState<any[]>([])

  // 規則庫資料
  const [rules, setRules] = useState<AuditRule[]>([])
  const [ruleVersions, setRuleVersions] = useState<AuditRuleVersion[]>([])
  const [ruleStatusFilter, setRuleStatusFilter] = useState<string>('all')
  const [selectedRuleForHistory, setSelectedRuleForHistory] = useState<AuditRule | null>(null)

  // Copilot 資料
  const [copilotMode, setCopilotMode] = useState<CopilotMode>('discuss')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: `您好！我是企業稽核智慧平台的「稽核副駕駛 (Audit Copilot)」。
我已為您加載【胡志明一號旗艦店】2026-09-08 的 IPOS 銷量與 IVT 實耗。

當前發現：經典阿薩姆紅茶茶湯實耗高出原始理論值 8.7% (+3.6L)，估計表觀金額差異 86,400 VND。
我已準備好與您一起探討：
1. 雙料加料（珍珠+椰果）造成的杯內物理排擠與滿杯補茶習慣
2. 5月份生效之 V2 新配方（220ml）切換影響
3. 現場出杯與濾茶桶殘留損耗

您可以切換上方「討論 / 導引 / 建議 / 答案」模式，隨時開始對話！`,
      mode: 'discuss',
      timestamp: '2026-09-09 23:00',
      suggestion: {
        issue_title: '阿薩姆紅茶茶湯耗用偏差 (+8.7%) 根因剖析',
        possible_causes: [
          {
            title: '雙料加料體積排擠與滿杯補茶習慣',
            probability: 68,
            description: '珍珠奶茶 + 2 toppings 時，杯內物理排擠造成員工習慣多補 18ml 茶湯以達滿杯。',
          },
          {
            title: '配方版本切換 (V1 ➔ V2)',
            probability: 20,
            description: '2026/05 起配方升級，基底茶標準用量由 200ml 調高至 220ml。',
          },
          {
            title: '茶桶底部餘茶殘留損耗',
            probability: 12,
            description: '每日更換 4-6 桶茶湯，桶底殘留及濾茶布吸附損耗約 0.4L。',
          },
        ],
        ai_confidence: 86,
        evidence: [
          { source: 'IPOS', detail: '珍珠奶茶售出 100 杯，加料多達 110 份（雙料佔比 20%）' },
          { source: 'IVT', detail: '實耗 44.8L vs 原始規定 41.2L，表觀差異 +3.6L' },
          { source: 'Recipe', detail: '採用 2026/05 生效之 V2 標準配方 (220ml/杯)' },
          { source: 'Past 6 Months', detail: '同商圈 5 家門市中，加料率高者均呈現 6-9% 茶湯同向正偏差' },
        ],
        actionable_proposals: [
          '套用 RULE-00038 (+18ml) 修正後，誤差率降至 0.7%，轉為正常綠燈',
          '向門市宣導雪克杯 450ml 防溢刻度標準操作流程',
          '由稽核主管將該修正係數升級為正式 Hard Rule 全門市強制套用',
        ],
        candidate_rule: {
          code: 'RULE-00038',
          target_product: '珍珠奶茶 500ml',
          condition: '2 toppings (加2種加料)',
          adjustment_type: 'tea_adjustment',
          adjustment_value: '+18ml 紅茶基底',
          numerical_delta: 18,
          unit: 'ml',
          proposed_status: 'approved',
        },
      },
    },
  ])
  const [inputMsg, setInputMsg] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [currentSuggestion, setCurrentSuggestion] = useState<AuditSuggestionCard | null>(chatMessages[0].suggestion || null)

  // 稽核日誌與模組概況
  const [logs, setLogs] = useState<AuditKnowledgeLog[]>([])
  const [overview, setOverview] = useState<AuditPlatformOverview | null>(null)
  const [jetsonInfo, setJetsonInfo] = useState<any>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)

  // 初始載入
  useEffect(() => {
    fetchCalculation()
    fetchRules()
    fetchLogs()
    fetchOverview()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const fetchCalculation = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/audit/platform/calculate?store=${encodeURIComponent(targetStore)}&date=${targetDate}`)
      const data = await res.json()
      if (data.success) {
        setMaterialRows(data.rows || [])
        setTotalRawLoss(data.totalRawLoss || 0)
        setTotalAdjustedLoss(data.totalAdjustedLoss || 0)
        setAppliedRulesSummary(data.appliedRulesSummary || [])
      }
    } catch (e) {
      console.error('Failed to load calculation:', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/audit/platform/rules')
      const data = await res.json()
      if (data.success) {
        setRules(data.rules || [])
        setRuleVersions(data.versions || [])
      }
    } catch (e) {
      console.error('Failed to load rules:', e)
    }
  }

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/audit/platform/logs')
      const data = await res.json()
      if (data.success) {
        setLogs(data.logs || [])
      }
    } catch (e) {
      console.error('Failed to load logs:', e)
    }
  }

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/audit/platform/modules')
      const data = await res.json()
      if (data.success) {
        setOverview(data.overview)
        setJetsonInfo(data.jetson_integration)
      }
    } catch (e) {
      console.error('Failed to load overview:', e)
    }
  }

  // 升級或建立規則
  const handlePromoteRule = async (ruleCode: string, newStatus: AuditRuleStatus, note: string) => {
    try {
      const res = await fetch('/api/audit/platform/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule_code: ruleCode,
          promote_to: newStatus,
          change_note: note,
        }),
      })
      const data = await res.json()
      if (data.success) {
        alert(data.message)
        fetchRules()
        fetchCalculation()
      }
    } catch (e) {
      console.error('Failed to promote rule:', e)
    }
  }

  // 發送 Copilot 對話
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputMsg
    if (!textToSend.trim() || sendingMsg) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      mode: copilotMode,
      timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
    }

    setChatMessages(prev => [...prev, userMsg])
    setInputMsg('')
    setSendingMsg(true)

    try {
      const res = await fetch('/api/audit/platform/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          mode: copilotMode,
          history: chatMessages.map(m => ({ role: m.role, content: m.content })),
          contextData: {
            targetStore,
            targetDate,
            materialRows: materialRows.slice(0, 5),
            totalRawLoss,
            totalAdjustedLoss,
            activeRulesCount: rules.length,
          },
        }),
      })
      const data = await res.json()
      if (data.success) {
        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          mode: copilotMode,
          timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
          suggestion: data.suggestion_card,
        }
        setChatMessages(prev => [...prev, assistantMsg])
        if (data.suggestion_card) {
          setCurrentSuggestion(data.suggestion_card)
        }
      }
    } catch (e) {
      console.error('Copilot send error:', e)
    } finally {
      setSendingMsg(false)
    }
  }

  // 篩選規則
  const filteredRules = rules.filter(r => {
    if (ruleStatusFilter === 'all') return true
    return r.status === ruleStatusFilter
  })

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* 頂部三位一體智慧中樞狀態條 */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              COMPANY KNOWLEDGE CORE 共享企業知識底層連動中
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/rd-lab"
              className="px-2.5 py-1 rounded-md bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 transition-colors flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>R&D AI 研發中樞 (配方 V1/V2)</span>
            </Link>
            <span className="text-slate-600">↔</span>
            <div className="px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 font-semibold">
              <Scale className="w-3.5 h-3.5 text-indigo-400" />
              <span>AUDIT AI 稽核智慧平台 (本中樞)</span>
            </div>
            <span className="text-slate-600">↔</span>
            <Link
              href="/store-coach"
              className="px-2.5 py-1 rounded-md bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 transition-colors flex items-center gap-1.5"
            >
              <Coffee className="w-3.5 h-3.5 text-amber-400" />
              <span>STORE AI 門市教練 (現場執行)</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* 標題橫幅 */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-2xl border border-indigo-500/20 shadow-xl">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Scale className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
                  AI Audit Intelligence Platform
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-normal">
                    企業稽核智慧平台
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  四來源交叉推算 (IPOS × IVT × 出納定價 × R&D版本配方) ➔ 商品組合修正模型 ➔ 人機協同規則進化 ➔ Audit Copilot
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCalculation}
              disabled={loading}
              className="bg-slate-900/60 border-slate-700 hover:bg-slate-800 text-slate-200 gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              重新計算推算引擎
            </Button>
            <Link href="/audit">
              <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white text-xs">
                返回傳統四來源表單
              </Button>
            </Link>
          </div>
        </div>

        {/* 門市與日期維度選擇區 */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">稽核門市：</span>
              <span className="font-semibold text-indigo-300 bg-indigo-950/60 px-3 py-1 rounded-md border border-indigo-500/30">
                {targetStore}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">分析基準日：</span>
              <span className="font-mono text-slate-200 bg-slate-800 px-3 py-1 rounded-md border border-slate-700">
                {targetDate}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">有效配方版本：</span>
              <span className="font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-0.5 rounded border border-emerald-500/30 text-xs">
                V2 (2026/05 生效)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="text-right">
              <div className="text-slate-400">原始表觀損失</div>
              <div className="text-rose-400 font-bold font-mono text-sm">
                {totalRawLoss.toLocaleString()} VND
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600" />
            <div className="text-right">
              <div className="text-slate-400">組合規則修正後損失</div>
              <div className="text-emerald-400 font-bold font-mono text-sm">
                {totalAdjustedLoss.toLocaleString()} VND
              </div>
            </div>
          </div>
        </div>

        {/* 自適應分頁標籤導覽 (無向右拖拉，flex-wrap gap-2) */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('material')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'material'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>📊 原料耗用推算引擎</span>
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">Phase 1</span>
          </button>

          <button
            onClick={() => setActiveTab('copilot')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'copilot'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>🤖 Audit Copilot (稽核副駕駛)</span>
            <span className="text-xs px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-200">4 模式</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'rules'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>⚖️ 人機協同規則庫 (Rule Engine)</span>
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">{rules.length} 條</span>
          </button>

          <button
            onClick={() => setActiveTab('composition')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'composition'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>🧬 商品加料組合排擠模型</span>
          </button>

          <button
            onClick={() => setActiveTab('modules')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'modules'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>🛡️ 六大稽核模組看板</span>
            <span className="text-xs px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Jetson 連動</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span>📜 稽核日誌與知識圖譜</span>
          </button>
        </div>

        {/* ── TAB 1: 原料耗用推算引擎 (Recipe Engine & Consumption Analysis) ── */}
        {activeTab === 'material' && (
          <div className="space-y-6">
            {/* 珍珠奶茶加料案例教學說明條 */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs sm:text-sm flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <span className="font-semibold text-amber-300">【原料消耗推算引擎核心思維】</span>
                <p>
                  不能直接以「100杯 × 配方 = 理論奶茶量」。今日 IPOS 銷售紀錄中，珍珠奶茶共 100 杯（珍珠 80 份、椰果 30 份）。
                  其中「無加料」與「加 2 種加料 (2 toppings)」出杯時的基底茶與奶精實際理論耗用完全不同！
                  系統已啟用 Product Composition Model 與已核准之 <span className="font-mono text-white underline">RULE-00038 (+18ml)</span>，
                  將原本看似異常的 +8.7% 偏差收斂至 <span className="text-emerald-400 font-bold">+0.7% 工藝公差</span>！
                </p>
              </div>
            </div>

            {/* 推算結果表格 */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-semibold text-white">原物料合理性推算比對表 (Consumption Variance)</h3>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> 正常 (±4%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block"></span> 輕微偏差 (4-8%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span> 高風險 (8-15%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> 嚴重損失 (&gt;15%)
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-mono">
                    <tr>
                      <th className="py-3 px-4">原料名稱 / 代碼</th>
                      <th className="py-3 px-4">規格</th>
                      <th className="py-3 px-4">純配方標準</th>
                      <th className="py-3 px-4 text-indigo-300">組合修正理論值</th>
                      <th className="py-3 px-4 text-cyan-300">IVT 當月實耗</th>
                      <th className="py-3 px-4">實用與修正差額</th>
                      <th className="py-3 px-4">誤差率 %</th>
                      <th className="py-3 px-4 text-right">金額損失 (VND)</th>
                      <th className="py-3 px-4">套用規則</th>
                      <th className="py-3 px-4 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {materialRows.map(row => {
                      const isHigh = row.anomaly_level === 'high_risk' || row.anomaly_level === 'critical'
                      return (
                        <tr key={row.material_code} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-sans font-medium text-slate-200">
                            <div>{row.material_name}</div>
                            <span className="text-xs text-slate-500 font-mono">{row.material_code}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-400">{row.unit}</td>
                          <td className="py-3 px-4 text-slate-400">{row.raw_theoretical_qty}</td>
                          <td className="py-3 px-4 text-indigo-300 font-bold bg-indigo-950/20">
                            {row.composition_adjusted_qty}
                          </td>
                          <td className="py-3 px-4 text-cyan-300 font-bold bg-cyan-950/20">
                            {row.actual_usage_qty}
                          </td>
                          <td className={`py-3 px-4 font-bold ${row.diff_qty > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {row.diff_qty > 0 ? `+${row.diff_qty}` : row.diff_qty} {row.unit}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                row.anomaly_level === 'critical'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : row.anomaly_level === 'high_risk'
                                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                  : row.anomaly_level === 'low_risk'
                                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {row.diff_pct !== null ? `${row.diff_pct > 0 ? '+' : ''}${row.diff_pct}%` : '—'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-200">
                            {row.money_loss > 0 ? `${row.money_loss.toLocaleString()}` : '0'}
                          </td>
                          <td className="py-3 px-4 text-xs font-sans">
                            {row.applied_rules && row.applied_rules.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {row.applied_rules.map(r => (
                                  <span key={r} className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                                    {r}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-600">無修正</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActiveTab('copilot')
                                handleSendMessage(`請針對【${row.material_name}】耗用偏差 (${row.diff_pct}%) 與金額損失 (${row.money_loss} VND) 進行深入探討。`)
                              }}
                              className="text-xs h-7 bg-slate-800/80 hover:bg-indigo-600 hover:text-white text-indigo-300 border-indigo-500/30 gap-1"
                            >
                              <Bot className="w-3.5 h-3.5" />
                              深入分析
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: AUDIT COPILOT (稽核副駕駛 - 4 模式與左對話右建議) ── */}
        {activeTab === 'copilot' && (
          <div className="space-y-4">
            {/* 模式切換按鈕組 (討論 / 導引 / 建議 / 答案) */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Copilot 互動模式：</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setCopilotMode('discuss')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      copilotMode === 'discuss'
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    💬 討論模式 (探討本質・不急著給答案)
                  </button>

                  <button
                    onClick={() => setCopilotMode('guide')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      copilotMode === 'guide'
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    🧭 導引模式 (結構化推進・三步檢查)
                  </button>

                  <button
                    onClick={() => setCopilotMode('suggest')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      copilotMode === 'suggest'
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    💡 建議模式 (左探討・右側產出正式建議卡)
                  </button>

                  <button
                    onClick={() => setCopilotMode('answer')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      copilotMode === 'answer'
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    🎯 答案模式 (直接給定論・證據鏈精算)
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-400">
                當前模式特色：
                <span className="text-indigo-300 font-medium ml-1">
                  {copilotMode === 'discuss' && '啟發式提問，帶著稽核員共同釐清利弊真相'}
                  {copilotMode === 'guide' && '第一步核對、第二步查證、第三步安全規範'}
                  {copilotMode === 'suggest' && '對話分析並同步在右側生成建議卡片'}
                  {copilotMode === 'answer' && '確鑿數據判定，輸出精準計算與證據'}
                </span>
              </div>
            </div>

            {/* 雙欄主架構：左側對話 (2/3) + 右側建議看板 (1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* 左側對話區 (2/3) */}
              <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 flex flex-col h-[650px]">
                <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-indigo-400" />
                    <span className="font-semibold text-sm text-white">對話協同作業區</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-500/30">
                    Human-in-the-loop Active
                  </span>
                </div>

                {/* 對話訊息捲動區 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-xl p-4 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800/80 text-slate-200 border border-slate-700/80'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        <div className="mt-2 text-[11px] opacity-60 text-right flex items-center justify-end gap-2">
                          <span>{msg.mode}</span>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {sendingMsg && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
                        <Bot className="w-4 h-4 animate-spin" />
                      </div>
                      <div className="bg-slate-800/80 p-3 rounded-xl text-xs text-slate-400 flex items-center gap-2">
                        <span>AI 正在整合 IPOS、IVT 與配方庫計算中...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* 快速提問標籤 */}
                <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-950/40 flex flex-wrap gap-2 text-xs">
                  <span className="text-slate-500 self-center">快速情境：</span>
                  <button
                    onClick={() => handleSendMessage('為什麼 A 店紅茶使用量比理論高 8.7%？')}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    紅茶超耗 8.7% 診斷
                  </button>
                  <button
                    onClick={() => handleSendMessage('珍珠奶茶加 2 個 topping 時，基底茶增加多少合理？')}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    雙料基底茶補量假說
                  </button>
                  <button
                    onClick={() => handleSendMessage('這個計算方式以後全部門市都這樣算，請建立為正式規則。')}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 transition-colors"
                  >
                    建立為正式 Approved 規則
                  </button>
                </div>

                {/* 輸入框 */}
                <div className="p-3 border-t border-slate-800 flex gap-2">
                  <Input
                    placeholder="輸入您的疑問，或與 AI 討論現場抽查發現..."
                    value={inputMsg}
                    onChange={e => setInputMsg(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    className="bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-500"
                  />
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={sendingMsg || !inputMsg.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    發送
                  </Button>
                </div>
              </div>

              {/* 右側結構化 AI 建議看板 (1/3) */}
              <div className="bg-slate-900 rounded-xl border border-indigo-500/30 p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <h4 className="font-semibold text-white text-sm">AI 稽核建議看板</h4>
                    </div>
                    {currentSuggestion && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                        AI 信心：{currentSuggestion.ai_confidence}%
                      </span>
                    )}
                  </div>

                  {currentSuggestion ? (
                    <div className="space-y-4 text-xs">
                      <div>
                        <div className="text-slate-400 font-medium mb-1">鎖定問題：</div>
                        <div className="text-sm font-semibold text-white bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                          {currentSuggestion.issue_title}
                        </div>
                      </div>

                      {/* 可能原因 */}
                      <div className="space-y-2">
                        <div className="text-slate-400 font-medium">可能原因推論：</div>
                        {currentSuggestion.possible_causes.map((c, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                            <div className="flex items-center justify-between text-slate-200 font-medium">
                              <span>{idx + 1}. {c.title}</span>
                              <span className="text-indigo-400 font-mono font-semibold">{c.probability}%</span>
                            </div>
                            <p className="text-slate-400 leading-relaxed">{c.description}</p>
                          </div>
                        ))}
                      </div>

                      {/* 依據資料源 */}
                      <div className="space-y-1.5">
                        <div className="text-slate-400 font-medium">依據數據來源：</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {currentSuggestion.evidence.map((ev, i) => (
                            <div key={i} className="p-2 rounded bg-slate-800/50 border border-slate-700/50">
                              <span className="font-semibold text-indigo-300 font-mono">[{ev.source}]</span>
                              <p className="text-slate-300 mt-0.5 line-clamp-2">{ev.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 候選規則建議 */}
                      {currentSuggestion.candidate_rule && (
                        <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-indigo-300">建議建立或升級之規則：</span>
                            <span className="font-mono text-emerald-400 font-bold">
                              {currentSuggestion.candidate_rule.code}
                            </span>
                          </div>
                          <div className="space-y-1 text-slate-300 font-mono">
                            <div>適用：{currentSuggestion.candidate_rule.target_product}</div>
                            <div>條件：{currentSuggestion.candidate_rule.condition}</div>
                            <div>調校：{currentSuggestion.candidate_rule.adjustment_value}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500">
                      尚未產生建議卡，請發送提問開始分析
                    </div>
                  )}
                </div>

                {/* 動作按鈕：[採用建議] [繼續分析] [建立規則] [忽略] */}
                {currentSuggestion && (
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (currentSuggestion.candidate_rule) {
                            handlePromoteRule(
                              currentSuggestion.candidate_rule.code,
                              'approved',
                              '稽核員於 Copilot 討論後正式採用此修正係數'
                            )
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        採用建議
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (currentSuggestion.candidate_rule) {
                            handlePromoteRule(
                              currentSuggestion.candidate_rule.code,
                              'hard_rule',
                              '稽核主管審核通過，直接列為最高等級 Hard Rule'
                            )
                          }
                        }}
                        className="bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border-indigo-500/40 text-xs gap-1"
                      >
                        <Flame className="w-3.5 h-3.5 text-rose-400" />
                        升級 Hard Rule
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendMessage('請針對此項建議進行更深一層的交叉檢驗與同儕店對比。')}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs"
                      >
                        繼續分析
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCurrentSuggestion(null)}
                        className="text-slate-500 hover:text-slate-400 text-xs"
                      >
                        忽略
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: 人機協同規則庫 (Rule Engine & Version Control) ── */}
        {activeTab === 'rules' && (
          <div className="space-y-6">
            {/* 4 等級統計卡 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                onClick={() => setRuleStatusFilter('hypothesis')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  ruleStatusFilter === 'hypothesis'
                    ? 'bg-slate-800/90 border-indigo-500 shadow-md'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>① AI Hypothesis</span>
                  <HelpCircle className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-xl font-bold text-white">
                  {rules.filter(r => r.status === 'hypothesis').length} 條
                </div>
                <p className="text-[11px] text-slate-500 mt-1">AI 自行推測，不可直接作為懲處標準</p>
              </div>

              <div
                onClick={() => setRuleStatusFilter('suggested')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  ruleStatusFilter === 'suggested'
                    ? 'bg-slate-800/90 border-yellow-500 shadow-md'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>② Suggested Rule</span>
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                </div>
                <div className="text-xl font-bold text-white">
                  {rules.filter(r => r.status === 'suggested').length} 條
                </div>
                <p className="text-[11px] text-slate-500 mt-1">AI 主動建議建立，等待稽核人員確認</p>
              </div>

              <div
                onClick={() => setRuleStatusFilter('approved')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  ruleStatusFilter === 'approved'
                    ? 'bg-slate-800/90 border-emerald-500 shadow-md'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>③ Approved Rule</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-bold text-white">
                  {rules.filter(r => r.status === 'approved').length} 條
                </div>
                <p className="text-[11px] text-slate-500 mt-1">稽核主管核准，納入正式數理推算</p>
              </div>

              <div
                onClick={() => setRuleStatusFilter('hard_rule')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  ruleStatusFilter === 'hard_rule'
                    ? 'bg-slate-800/90 border-rose-500 shadow-md'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>④ Hard Rule</span>
                  <Flame className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-xl font-bold text-white">
                  {rules.filter(r => r.status === 'hard_rule').length} 條
                </div>
                <p className="text-[11px] text-slate-500 mt-1">最高等級，直接作為正式稽核硬性判定指標</p>
              </div>
            </div>

            {/* 篩選標籤 */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => setRuleStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    ruleStatusFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  全部 ({rules.length})
                </button>
                <button
                  onClick={() => setRuleStatusFilter('hard_rule')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    ruleStatusFilter === 'hard_rule' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-rose-300'
                  }`}
                >
                  Hard Rule
                </button>
                <button
                  onClick={() => setRuleStatusFilter('approved')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    ruleStatusFilter === 'approved' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-300'
                  }`}
                >
                  Approved Rule
                </button>
                <button
                  onClick={() => setRuleStatusFilter('suggested')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    ruleStatusFilter === 'suggested' ? 'bg-yellow-600 text-white' : 'bg-slate-800 text-yellow-300'
                  }`}
                >
                  Suggested
                </button>
                <button
                  onClick={() => setRuleStatusFilter('hypothesis')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    ruleStatusFilter === 'hypothesis' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-cyan-300'
                  }`}
                >
                  Hypothesis
                </button>
              </div>

              <div className="text-xs text-slate-400">
                點選規則卡可查看「Rule Change History (歷史版本軌跡)」
              </div>
            </div>

            {/* 規則卡片列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRules.map(rule => (
                <div
                  key={rule.id}
                  onClick={() => setSelectedRuleForHistory(rule)}
                  className="bg-slate-900 p-5 rounded-xl border border-slate-800 hover:border-indigo-500/60 transition-all cursor-pointer space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-400">{rule.rule_code}</span>
                      <span className="text-xs text-slate-400 font-mono">({rule.version})</span>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        rule.status === 'hard_rule'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : rule.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : rule.status === 'suggested'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {rule.status.toUpperCase()}
                    </span>
                  </div>

                  <h4 className="font-semibold text-white text-sm">{rule.title}</h4>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-lg font-mono">
                    <div>
                      <span className="text-slate-500">適用商品：</span>
                      <span className="text-slate-200">{rule.target_product}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">條件：</span>
                      <span className="text-slate-200">{rule.condition_desc}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">調校參數：</span>
                      <span className="text-amber-400 font-bold">{rule.adjustment_value}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">生效日：</span>
                      <span className="text-slate-300">{rule.effective_from}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {rule.hypothesis_reason}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                    <span className="text-slate-500">
                      審核：{rule.approved_by || '等待稽核人員確認'}
                    </span>

                    {/* 升級操作按鈕 */}
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      {rule.status === 'hypothesis' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePromoteRule(rule.rule_code, 'suggested', '升級為建議規則')}
                          className="text-[11px] h-6 px-2 bg-yellow-950/40 text-yellow-300 border-yellow-500/30"
                        >
                          轉為 Suggested
                        </Button>
                      )}
                      {rule.status === 'suggested' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePromoteRule(rule.rule_code, 'approved', '稽核主管正式核准')}
                          className="text-[11px] h-6 px-2 bg-emerald-950/40 text-emerald-300 border-emerald-500/30"
                        >
                          核准 Approved
                        </Button>
                      )}
                      {rule.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePromoteRule(rule.rule_code, 'hard_rule', '升級為硬性標準')}
                          className="text-[11px] h-6 px-2 bg-rose-950/40 text-rose-300 border-rose-500/30"
                        >
                          升為 Hard Rule
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 版本歷程對話彈窗 (Rule Version Control History) */}
            {selectedRuleForHistory && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2 font-mono">
                        {selectedRuleForHistory.rule_code}
                        <span className="text-xs font-normal text-slate-400 font-sans">版本變更軌跡</span>
                      </h3>
                      <p className="text-xs text-slate-400">{selectedRuleForHistory.title}</p>
                    </div>
                    <button
                      onClick={() => setSelectedRuleForHistory(null)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {ruleVersions
                      .filter(v => v.rule_code === selectedRuleForHistory.rule_code)
                      .map((ver, idx) => (
                        <div key={ver.id || idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs font-mono">
                          <div className="flex items-center justify-between text-indigo-300 font-bold">
                            <span>版本：{ver.version}</span>
                            <span className="text-amber-400">{ver.adjustment_value}</span>
                          </div>
                          <div className="text-slate-400">
                            生效區間：{ver.effective_from} ~ {ver.effective_to || '持續有效'}
                          </div>
                          <div className="text-slate-300 font-sans">{ver.change_note}</div>
                          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-900">
                            審核人：{ver.approved_by}
                          </div>
                        </div>
                      ))}
                    {ruleVersions.filter(v => v.rule_code === selectedRuleForHistory.rule_code).length === 0 && (
                      <div className="text-center py-6 text-slate-500 text-xs font-sans">
                        目前為初版初始建立紀錄，尚未有後續修訂歷史。
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      onClick={() => setSelectedRuleForHistory(null)}
                      className="bg-slate-800 hover:bg-slate-700 text-white text-xs"
                    >
                      關閉歷程
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: 商品加料組合排擠模型 (Composition Model) ── */}
        {activeTab === 'composition' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-xs sm:text-sm leading-relaxed space-y-2">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                Product Composition Model (商品組合耗用排擠原理)
              </h4>
              <p>
                傳統計算僅有單一標準配方：100 杯珍珠奶茶 = 22L 茶湯。
                然而顧客點單包含不同組合：0 topping、1 topping、2 toppings、3 toppings。
                當加料超過 2 種時，杯內液體空間被料體排擠（約排擠 40-50ml），但現場調茶員雪克搖勻後，往往會補茶或補鮮奶至杯緣防漏，
                因此「銷售組合」必須經過此模型的補償修正，才能得出真正客觀的「理論耗用量」。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="text-xs text-indigo-400 font-semibold font-mono">0 TOPPING (純基底)</div>
                <div className="text-lg font-bold text-white">標準無加料飲品</div>
                <ul className="text-xs text-slate-400 space-y-1.5 font-mono">
                  <li>• 茶湯用量：220 ml (標準)</li>
                  <li>• 奶精/鮮奶：38g (標準)</li>
                  <li>• 冰量空間：正常充填 (200g)</li>
                  <li>• 組合修正值：0 ml</li>
                </ul>
              </div>

              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="text-xs text-indigo-400 font-semibold font-mono">1 TOPPING (單料加料)</div>
                <div className="text-lg font-bold text-white">標準珍珠奶茶</div>
                <ul className="text-xs text-slate-400 space-y-1.5 font-mono">
                  <li>• 珍珠粉圓：1 份 (約 50g)</li>
                  <li>• 體積排擠：約 30ml 冰塊位移</li>
                  <li>• 茶湯標準：220 ml</li>
                  <li>• 組合修正值：0 ml (配方已吸收)</li>
                </ul>
              </div>

              <div className="p-5 rounded-xl bg-slate-900 border border-indigo-500/40 space-y-3 bg-indigo-950/20">
                <div className="text-xs text-emerald-400 font-semibold font-mono">2 TOPPINGS (雙料加料) ⭐</div>
                <div className="text-lg font-bold text-white">珍珠 + 椰果雙料組合</div>
                <ul className="text-xs text-slate-300 space-y-1.5 font-mono">
                  <li>• 加料總重：約 90g</li>
                  <li>• 物理排擠：強烈排擠雪克空間</li>
                  <li>• 出杯補償：平均補茶 <span className="text-emerald-400 font-bold">+18 ml</span></li>
                  <li>• 套用規則：<span className="text-indigo-300 font-bold">RULE-00038</span> (Hard Rule)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: 六大稽核模組總覽 (Six Engines Hub) ── */}
        {activeTab === 'modules' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* ① 原物料合理性 */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-indigo-400" />
                    <h4 className="font-semibold text-white">1. 原物料合理性</h4>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">Phase 1 運作中</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  結合 IPOS 銷量、IVT 進銷存、出納定價與 R&D 版本配方，透過數理推算引擎精算真實現場所需耗用。
                </p>
                <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 font-mono">
                  異常品項：2 項 ｜ 修正後損耗：0 VND
                </div>
              </div>

              {/* ② 環境衛生與擺設 */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-cyan-400" />
                    <h4 className="font-semibold text-white">2. 環境・衛生・擺設</h4>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">CV 影像審計</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  電腦視覺物件偵測 + 門市動線距離規範。主動預警「清潔抹布距離食品區小於 60cm」等交叉污染風險。
                </p>
                <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 font-mono">
                  目前 5S 評分：87 分 ｜ 交叉污染風險：1 項
                </div>
              </div>

              {/* ③ 服務態度與客觀行為 */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-amber-400" />
                    <h4 className="font-semibold text-white">3. 服務態度・行為</h4>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">客觀指標</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  摒棄「員工愛不愛笑」主觀偏見，聚焦「客人進門 5 秒眼神招呼率」與「30 秒無條件免費重調」標準落實。
                </p>
                <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 font-mono">
                  5秒迎賓合規率：94.2% ｜ 觀察樣本：120 次
                </div>
              </div>

              {/* ④ 食品品質 */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-5 h-5 text-purple-400" />
                    <h4 className="font-semibold text-white">4. 食品品質 (AI + 授權)</h4>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">雙重確認</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  AI 輔助分析珍珠色澤、稠度與外觀，並由授權巡檢人員勾選「正常 / 異常 / 需申報」，AI 是助手而非最終裁判。
                </p>
                <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 font-mono">
                  珍珠外觀：標準琥珀色 ｜ 待確認抽驗：0 項
                </div>
              </div>

              {/* ⑤ 原料安全管控 */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-400" />
                    <h4 className="font-semibold text-white">5. 原料安全管控</h4>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">高壓紅線</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  交叉比對 IVT 作廢物料與當日領料。若原料已登記作廢卻仍在門市出杯，AI 立即觸發 Material Safety Alert！
                </p>
                <div className="pt-2 border-t border-slate-800 text-xs text-emerald-400 font-mono font-bold">
                  作廢物料非法使用：0 違規
                </div>
              </div>

              {/* ⑥ 缺補料預警 */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-400" />
                    <h4 className="font-semibold text-white">6. 缺補料智能預警</h4>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-mono">4 色警示燈</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  依據銷量速度、交貨前置天數與現有庫存，預測缺料剩餘天數，在門市斷料前主動警示叫貨。
                </p>
                <div className="pt-2 border-t border-slate-800 text-xs text-amber-300 font-mono">
                  🟡 黑糖珍珠粉圓預計 1.4 天後不足
                </div>
              </div>
            </div>

            {/* Jetson Edge AI 預留硬體架構卡 */}
            <div className="p-5 rounded-xl bg-slate-900 border border-cyan-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                  <h4 className="font-semibold text-white">Phase 5: NVIDIA Jetson 門市邊緣計算整合架構</h4>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-mono">
                  Edge AI Ready
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                針對未來各門市部署之 NVIDIA Jetson Orin Nano 設備，系統已完成特徵向量上傳與事件通報管道預留。
                邊緣端本地運行姿態識別與工作站擺放偵測，嚴格遵循員工隱私保護政策（僅傳輸事件中繼資料，不保存未去識別化影像）。
              </p>
            </div>
          </div>
        )}

        {/* ── TAB 6: 稽核日誌與知識圖譜 (Knowledge Logs) ── */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-400" />
                  <h4 className="font-semibold text-white">Audit Knowledge Log (稽核決策與知識日誌)</h4>
                </div>
                <span className="text-xs text-slate-400">不只存聊天紀錄，而是留下企業決策資產</span>
              </div>

              <div className="space-y-3">
                {logs.map(log => (
                  <div key={log.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-400">{log.date}</span>
                        <span className="font-bold text-white text-sm">{log.issue_title}</span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-semibold ${
                          log.status === 'upgraded_to_hard_rule'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : log.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                        }`}
                      >
                        {log.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-400 font-mono">
                      <div>稽核人員：{log.auditor_name}</div>
                      <div>門市：{log.store}</div>
                      <div>對話探討次數：{log.chat_count} 次</div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                      <span className="font-semibold text-indigo-300">發現與依據：</span>
                      <p className="text-slate-300 leading-relaxed">{log.findings}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                      <span className="font-semibold text-emerald-300">採用方案與關聯規則：</span>
                      <p className="text-slate-300 leading-relaxed">
                        {log.solution_adopted}
                        {log.related_rule_code && (
                          <span className="ml-2 font-mono text-indigo-400 font-bold underline">
                            ({log.related_rule_code})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
