'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Wrench, ShieldCheck, Zap, AlertTriangle, Send, Loader2,
  CheckCircle2, RotateCcw, FileText, ChevronRight, HelpCircle,
  Laptop, Factory, CupSoda, Cpu, Sparkles, Check, ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type {
  RepairMode,
  EquipmentCategory,
  DiagnosticStep,
  RepairTicketDraft,
  EquipmentModelInfo,
  RepairKnowledgeChunk,
  RepairCaseFeedback,
} from '@/lib/types/repair-ai'
import { INITIAL_EQUIPMENT_MODELS } from '@/lib/repair-ai/knowledge-base'

interface MessageItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  mode: RepairMode
  timestamp: string
  safety_alert?: string
  diagnostic_steps?: DiagnosticStep[]
  ticket_draft?: RepairTicketDraft
  matched_chunks?: RepairKnowledgeChunk[]
  matched_cases?: RepairCaseFeedback[]
  ai_model?: string
}

interface Props {
  initialMode?: RepairMode
  onSwitchToOrders?: (prefill?: any) => void
}

export default function RepairAIAssistantTab({
  initialMode = 'store',
  onSwitchToOrders,
}: Props) {
  const [mode, setMode] = useState<RepairMode>(initialMode)
  const [selectedCategory, setSelectedCategory] = useState<EquipmentCategory>('bar')
  const [selectedModel, setSelectedModel] = useState<string>('eq-yifang-et99s')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        initialMode === 'store'
          ? `您好！我是 **門市設備快速排除 AI** 🤖\n\n專為門市現場打造：**不拆機、防呆安全、3步驟排查**。請在下方點選設備或直接輸入異常現象（如「封口機 E01」、「果糖機出糖變少」、「出單機卡紙」），我將第一時間引導您快速解決！`
          : `您好，工程技師！我是 **專業機電與工務維修 AI** ⚡\n\n具備**原廠電路圖、阻值(Ω)電壓(V)量測標準、凸輪微動極限判定**與**零件料號資料庫**。請選擇機型或輸入故障碼，讓我們進行深入排查。`,
      mode: initialMode,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [testedSteps, setTestedSteps] = useState<Record<string, boolean>>({})
  const [submittingTicket, setSubmittingTicket] = useState(false)
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // 切換模式時可更新歡迎詞或預設
  const handleModeChange = (newMode: RepairMode) => {
    setMode(newMode)
    setMessages(prev => [
      ...prev,
      {
        id: `mode-switch-${Date.now()}`,
        role: 'assistant',
        content:
          newMode === 'store'
            ? `🔄 已切換為 **【門市快速排除模式】**：強調現場防呆安全（免拆機、不碰強電），若 3 步驟無法解決將自動提供「一鍵報修」轉派工。`
            : `🔄 已切換為 **【專業技師工程模式】**：提供三用電表測量數值 (Ω/V)、電路圖接線針腳、原廠零件料號與真實修復案例。`,
        mode: newMode,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ])
  }

  const currentModelObj = INITIAL_EQUIPMENT_MODELS.find(m => m.id === selectedModel)

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input
    if (!textToSend.trim() || loading) return

    const userMsg: MessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      mode,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages(prev => [...prev, userMsg])
    if (!customText) setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/repair/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          mode,
          equipment_model: currentModelObj ? currentModelObj.model_name : '',
          category: selectedCategory,
          history: messages.slice(-4).map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        const assistantMsg: MessageItem = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          mode,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          safety_alert: data.safety_alert,
          diagnostic_steps: data.diagnostic_steps,
          ticket_draft: data.ticket_draft,
          matched_chunks: data.matched_chunks,
          matched_cases: data.matched_cases,
          ai_model: data.ai_model,
        }
        setMessages(prev => [...prev, assistantMsg])
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: `抱歉，系統排查時發生問題：${data.error || '請稍候再試'}`,
            mode,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ])
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `連線異常，請檢查網路連線。`,
          mode,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  // 一鍵送出報修單 (門市模式排查未果)
  const handleDirectSubmitTicket = async (draft: RepairTicketDraft) => {
    setSubmittingTicket(true)
    try {
      const payload = {
        title: `[AI排查轉報修] ${draft.equipment_name} ${draft.error_code ? `(${draft.error_code})` : ''}`,
        store: draft.store || 'FEELING TEA 門市',
        equipment_name: draft.equipment_name,
        description: `${draft.symptom_summary}\n\n已嘗試免拆機排查：\n${draft.steps_already_tried.map(s => `- ${s}`).join('\n')}\n\n建議攜帶料件：\n${draft.suggested_parts_for_tech.map(p => `- ${p}`).join('\n')}`,
        priority: draft.urgency || 'high',
      }

      const res = await fetch('/api/repair/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.ok && data.id) {
        setTicketSuccess(data.id)
        if (onSwitchToOrders) {
          setTimeout(() => {
            onSwitchToOrders({ orderId: data.id })
          }, 1200)
        }
      } else {
        alert(data.error || '報修單建立失敗')
      }
    } catch (e: any) {
      alert('送出失敗，請手動前往報修單分頁登記')
    } finally {
      setSubmittingTicket(false)
    }
  }

  const QUICK_PROMPTS: Record<EquipmentCategory, { label: string; text: string; code?: string }[]> = {
    bar: [
      { label: 'E01 發熱板不熱', text: '益芳封口機顯示 E01，完全沒有溫度', code: 'E01' },
      { label: 'E04 膠膜不停/電眼異常', text: '封口機 E04，膠膜一直狂轉不停止', code: 'E04' },
      { label: '果糖機出糖不準', text: '果糖機全糖出糖量明顯變少，而且出口有結晶滴糖' },
      { label: '封口機卡杯下壓超時', text: '封口機下壓後卡住上不來，發出逼逼叫聲' },
    ],
    it_pos: [
      { label: '錢箱無法自動彈開', text: 'POS 結帳後收銀錢箱不會彈開，出單機是好的' },
      { label: '出單機卡紙紅燈閃爍', text: 'Epson 出單機紅燈一直閃，按進紙鍵沒反應，切刀卡住' },
      { label: 'POS 觸控螢幕亂跳', text: 'POS 觸控螢幕點右上角會跳到左邊，邊框好像有水氣' },
      { label: '出單機網路斷線', text: '吧台出單機完全印不出飲料單，網線有插著' },
    ],
    factory: [
      { label: '炒糖機變頻過載跳脫', text: 'SC-150L 炒糖機攪拌到一半突然停機，面板顯示 VFD-OC' },
      { label: '大煮茶鍋溫控感測漂移', text: '煮茶鍋 PT100 溫度感測器顯示 98度但水根本沒滾' },
      { label: '減速機傳動異音', text: '自動炒糖機減速箱運轉時有喀喀金屬撞擊異音' },
    ],
  }

  return (
    <div className="space-y-4">
      {/* 1. 雙模式分流切換頂欄 */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold flex items-center gap-1.5">
                <Sparkles className="h-5 w-5 text-amber-500" />
                維修 AI 智慧中樞
              </span>
              <Badge variant="outline" className="text-xs bg-primary/5">
                SOP 故障樹・RAG 手冊檢索・閉環學習
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === 'store'
                ? '【門市模式】嚴格守護現場安全，免拆機 3 步排查，未果自動無縫產出報修單'
                : '【技師模式】深入電路量測 (Ω/V)、原廠料號建議、凸輪微動檢驗與修復經驗回饋'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl self-start sm:self-auto">
            <button
              onClick={() => handleModeChange('store')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'store'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              門市快速排除模式
            </button>
            <button
              onClick={() => handleModeChange('technician')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'technician'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              專業技師工程模式
            </button>
          </div>
        </div>

        {/* 安全提示橫幅 */}
        <div
          className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 font-medium ${
            mode === 'store'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
              : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20'
          }`}
        >
          {mode === 'store' ? (
            <>
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                門市安全原則：<strong>嚴禁拆卸任何機殼外殼或手碰加熱模具（160°C以上）</strong>。依 AI 指引進行電源、清潔與紙膜檢查。
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              <span>
                機電作業原則：三用電表量測阻值<strong>務必完全切斷總電源</strong>；帶電量測 24VDC/220VAC 需佩戴絕緣裝備。
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. 設備類別與型號快速選擇卡片 */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-muted-foreground">設備類別：</span>
            {(
              [
                ['bar', '吧檯設備', CupSoda],
                ['it_pos', 'POS與資訊軟硬體', Laptop],
                ['factory', '中央工廠設備', Factory],
              ] as const
            ).map(([cat, label, Icon]) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat)
                  const firstInCat = INITIAL_EQUIPMENT_MODELS.find(m => m.category === cat)
                  if (firstInCat) setSelectedModel(firstInCat.id)
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-muted-foreground">目標設備：</span>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="h-7 text-xs rounded-md border bg-background px-2 py-0.5"
            >
              {INITIAL_EQUIPMENT_MODELS.filter(m => m.category === selectedCategory).map(m => (
                <option key={m.id} value={m.id}>
                  {m.brand} - {m.model_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 快捷常見故障點擊 */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/40">
          <span className="text-xs text-muted-foreground flex items-center gap-1 font-semibold">
            <HelpCircle className="h-3 w-3" />
            快速提問：
          </span>
          {QUICK_PROMPTS[selectedCategory].map(item => (
            <button
              key={item.label}
              onClick={() => handleSend(item.text)}
              className="px-2.5 py-1 rounded-full text-xs bg-muted/80 hover:bg-primary/10 hover:text-primary transition-all border border-border/40 font-medium"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 對話排查區 */}
      <div className="rounded-2xl border bg-card shadow-sm flex flex-col h-[560px]">
        {/* 對話記錄 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div
                  className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-white ${
                    msg.mode === 'store' ? 'bg-emerald-600' : 'bg-indigo-600'
                  }`}
                >
                  <Wrench className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 space-y-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-none ml-auto'
                    : 'bg-muted/40 border border-border/60 rounded-tl-none'
                }`}
              >
                {/* 角色與時間標記 */}
                <div className="flex items-center justify-between text-[11px] opacity-75 gap-3">
                  <span className="font-semibold">
                    {msg.role === 'user'
                      ? '門市人員 / 技師'
                      : msg.mode === 'store'
                      ? '門市快速排除 AI'
                      : '專業技師工程 AI'}
                    {msg.ai_model && ` (${msg.ai_model})`}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* 訊息本文 */}
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>

                {/* 安全警示標籤 */}
                {msg.safety_alert && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>{msg.safety_alert}</span>
                  </div>
                )}

                {/* 結構化排查步驟卡片 (Diagnostic Steps) */}
                {msg.diagnostic_steps && msg.diagnostic_steps.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        步驟式排查清單 ({msg.diagnostic_steps.length} 步)：
                      </span>
                      <span className="text-[11px] text-muted-foreground">點擊勾選已測試</span>
                    </div>

                    <div className="space-y-2">
                      {msg.diagnostic_steps.map(step => {
                        const stepKey = `${msg.id}-step-${step.step_number}`
                        const isDone = !!testedSteps[stepKey]

                        return (
                          <div
                            key={step.step_number}
                            onClick={() =>
                              setTestedSteps(prev => ({ ...prev, [stepKey]: !prev[stepKey] }))
                            }
                            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                              isDone
                                ? 'bg-emerald-500/10 border-emerald-500/40 opacity-75'
                                : 'bg-background hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div
                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                                  isDone
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'border-muted-foreground/40'
                                }`}
                              >
                                {isDone && <Check className="h-3 w-3" />}
                              </div>
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-foreground">
                                    第 {step.step_number} 步：{step.title}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {step.check_type === 'multimeter_ohms'
                                      ? '⚡ 電阻測量'
                                      : step.check_type === 'voltage'
                                      ? '🔌 電壓量測'
                                      : step.check_type === 'cleaning'
                                      ? '🧽 清潔維護'
                                      : step.check_type === 'consumable'
                                      ? '📦 耗材/線路'
                                      : '🔄 重啟確認'}
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground">{step.instruction}</p>
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  ✓ 正常預期：{step.expected_normal}
                                </div>
                                <div className="text-[11px] text-amber-600 dark:text-amber-400">
                                  ✗ 若無改善：{step.if_failed_action}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 門市排查未果 ➔ 一鍵生成報修單卡片 */}
                {msg.ticket_draft && mode === 'store' && (
                  <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-orange-700 dark:text-orange-300 flex items-center gap-1.5">
                        <Wrench className="h-4 w-4" />
                        AI 已自動彙整報修工單草稿
                      </span>
                      <Badge className="bg-red-500 text-white text-[10px]">
                        優先級：{msg.ticket_draft.urgency === 'urgent' ? '緊急' : '高'}
                      </Badge>
                    </div>

                    <div className="text-xs space-y-1 bg-background/60 p-2.5 rounded-lg border border-orange-500/20">
                      <div>
                        <strong>申報設備：</strong> {msg.ticket_draft.equipment_name}
                      </div>
                      <div>
                        <strong>故障代碼：</strong> {msg.ticket_draft.error_code || '現場異常'}
                      </div>
                      <div>
                        <strong>狀況概述：</strong> {msg.ticket_draft.symptom_summary}
                      </div>
                      <div>
                        <strong>已排查項目：</strong>
                        <ul className="list-disc list-inside text-muted-foreground">
                          {msg.ticket_draft.steps_already_tried.map((st, i) => (
                            <li key={i}>{st}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {ticketSuccess ? (
                      <div className="p-2 bg-emerald-500/20 text-emerald-700 rounded-lg text-xs font-bold text-center">
                        ✓ 報修工單已成功建立！正在跳轉至工單列表...
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        disabled={submittingTicket}
                        onClick={() => handleDirectSubmitTicket(msg.ticket_draft!)}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs gap-1.5 font-bold"
                      >
                        {submittingTicket ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        🚀 一鍵送出報修工單（指派工務技師到府）
                      </Button>
                    )}
                  </div>
                )}

                {/* 參考原廠手冊與真實案例來源標註 */}
                {((msg.matched_chunks && msg.matched_chunks.length > 0) ||
                  (msg.matched_cases && msg.matched_cases.length > 0)) && (
                  <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground space-y-1">
                    <span className="font-semibold flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      RAG 知識檢索依據：
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {msg.matched_chunks?.map(c => (
                        <span
                          key={c.id}
                          className="px-2 py-0.5 rounded bg-muted text-foreground/80 border border-border/40"
                        >
                          {c.title.slice(0, 24)}...
                        </span>
                      ))}
                      {msg.matched_cases?.map(cs => (
                        <span
                          key={cs.id}
                          className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 border border-indigo-500/20"
                        >
                          技師實戰: {cs.equipment_model} ({cs.actual_root_cause.slice(0, 15)})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
              <div className="bg-muted/40 border border-border/60 rounded-2xl rounded-tl-none p-3 text-xs text-muted-foreground flex items-center gap-2">
                正在檢索原廠故障代碼庫、電路接線圖與機電狀態機...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 輸入工具列 */}
        <div className="p-3 border-t bg-card/80 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={
              mode === 'store'
                ? '描述門市故障或代碼（例：封口機 E01、果糖機出糖不準、出單機缺紙）...'
                : '輸入機電現象或測量點（例：量測發熱管阻值、24V 脈衝未輸出、E02 凸輪微動開關）...'
            }
            className="flex-1 h-9 rounded-xl border bg-background px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button
            size="sm"
            disabled={loading || !input.trim()}
            onClick={() => handleSend()}
            className="h-9 px-4 rounded-xl text-xs gap-1.5 font-bold"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            排查
          </Button>
        </div>
      </div>
    </div>
  )
}
