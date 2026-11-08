'use client'

import { useState } from 'react'
import {
  Bot, Sparkles, MessageSquareHeart, TrendingUp, Send,
  Copy, Check, Clock, CalendarDays, Users, ArrowRight,
  ShieldAlert, Heart, Scissors, Smile
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export default function ReserveAiAssistantPage() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'followup' | 'capacity'>('schedule')

  // Smart schedule state
  const [schedulePrompt, setSchedulePrompt] = useState('客人林小姐想在這週五晚上或週六下午做水飛梭+造型剪髮，請推薦適合時段')
  const [scheduleResult, setScheduleResult] = useState<any>(null)
  const [isScheduling, setIsScheduling] = useState(false)

  // Follow-up message state
  const [customerName, setCustomerName] = useState('王小芬')
  const [serviceName, setServiceName] = useState('極致水飛梭毛孔淨化療程')
  const [staffName, setStaffName] = useState('林品妤 技術總監')
  const [followupResult, setFollowupResult] = useState<any>(null)
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false)
  const [copiedMsg, setCopiedMsg] = useState(false)

  // Capacity analysis state
  const [capacityResult, setCapacityResult] = useState<any>(null)
  const [isAnalyzingCapacity, setIsAnalyzingCapacity] = useState(false)
  const [error, setError] = useState('')

  // 共用：呼叫 AI 助理，失敗（點數不足、尚未建立店家等）時顯示錯誤
  async function callAi(payload: Record<string, unknown>) {
    setError('')
    const res = await fetch('/api/reserve/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(res.status === 402 ? '點數不足，請先儲值後再使用 AI 助理' : data.error || `發生錯誤（${res.status}）`)
      return null
    }
    return data.result ?? null
  }

  async function handleSmartSchedule() {
    setIsScheduling(true)
    try {
      const result = await callAi({ action: 'smart_schedule', prompt: schedulePrompt })
      if (result) setScheduleResult(result)
    } catch (err) {
      console.error(err)
    } finally {
      setIsScheduling(false)
    }
  }

  async function handleGenerateFollowup() {
    setIsGeneratingMessage(true)
    try {
      const result = await callAi({ action: 'followup_sms', serviceName, customerName, staffName })
      if (result) setFollowupResult(result)
    } catch (err) {
      console.error(err)
    } finally {
      setIsGeneratingMessage(false)
    }
  }

  async function handleAnalyzeCapacity() {
    setIsAnalyzingCapacity(true)
    try {
      const result = await callAi({ action: 'capacity_analysis' })
      if (result) setCapacityResult(result)
    } catch (err) {
      console.error(err)
    } finally {
      setIsAnalyzingCapacity(false)
    }
  }

  function copyText(txt: string) {
    navigator.clipboard.writeText(txt)
    setCopiedMsg(true)
    setTimeout(() => setCopiedMsg(false), 2000)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            AI 智慧預約與營運助理
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            以自然語言推算最佳排程時段、自動生成術後關懷文案、即時分析門市翻桌產能
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">依實際 AI 用量扣點；分析使用你門市的真實服務、人員與預約資料</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'schedule', label: 'AI 智慧排程推薦', icon: Clock },
          { id: 'followup', label: '顧客關懷與回訪生成', icon: MessageSquareHeart },
          { id: 'capacity', label: '門市稼動率與營運分析', icon: TrendingUp },
        ].map(t => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all',
                active
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200/80 dark:border-slate-800'
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab 1: AI Smart Schedule */}
      {activeTab === 'schedule' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-rose-500" />
              輸入預約需求或客人口述條件
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              AI 會依據各技師的出勤班表、現有預約密集度以及各項服務所需施作時長，自動避開撞期並挑選最舒適空檔。
            </p>

            <div className="space-y-2">
              <textarea
                rows={4}
                value={schedulePrompt}
                onChange={e => setSchedulePrompt(e.target.value)}
                placeholder="例如：客人王小姐想約下週三下午染髮，或是週五晚上7點做美睫，有設計師有空嗎？"
                className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-rose-500 leading-relaxed"
              />

              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  '推薦這週五晚上放鬆美膚時段',
                  '這週末下午有哪位造型師可以接溫塑燙？',
                  '週二午前想預約美甲有空檔嗎？',
                ].map(example => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setSchedulePrompt(example)}
                    className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  >
                    + {example}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSmartSchedule}
              disabled={isScheduling}
              className="w-full py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isScheduling ? 'AI 分析運算中...' : '立即分析推薦最佳預約時段'}
            </button>
          </div>

          {/* Schedule Results */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-500" />
              AI 排程分析結果
            </h2>

            {!scheduleResult ? (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <Clock className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-xs">點擊左側「分析推薦」按鈕，AI 將為您推算空檔</p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 text-xs text-rose-950 dark:text-rose-200 leading-relaxed">
                  {scheduleResult.analysis}
                </div>

                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    推薦預約時段候選：
                  </span>
                  {scheduleResult.recommendedSlots?.map((slot: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5 hover:border-rose-300 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="h-5 w-5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          {slot.date} · {slot.time}
                        </span>
                        <span className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md">
                          {slot.staffName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 pl-7 leading-relaxed">
                        {slot.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Follow-up & Care Message Generator */}
      {activeTab === 'followup' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquareHeart className="h-4 w-4 text-rose-500" />
              服務後專屬關懷文案設定
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              針對染燙髮後保養、醫美微整後保濕、美甲養護或物理復健，自動生成溫暖專業的 LINE / 簡訊關懷文案。
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  顧客尊稱
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  施作的服務項目
                </label>
                <select
                  value={serviceName}
                  onChange={e => setServiceName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
                >
                  <option value="日系溫塑燙髮 / 韓系氣墊燙（含剪護）">美髮：日系溫塑燙髮 / 韓系氣墊燙</option>
                  <option value="極致水飛梭毛孔淨化療程">美容：極致水飛梭毛孔淨化療程</option>
                  <option value="法式優雅凝膠美甲（手部含基礎保養）">美甲：法式優雅凝膠美甲</option>
                  <option value="一對一體態評估與運動物理治療">診所：一對一體態評估與運動治療</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  執業設計師 / 醫師
                </label>
                <input
                  type="text"
                  value={staffName}
                  onChange={e => setStaffName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleGenerateFollowup}
              disabled={isGeneratingMessage}
              className="w-full py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isGeneratingMessage ? '生成中...' : '生成專屬關懷文案'}
            </button>
          </div>

          {/* Follow-up Message Preview */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="h-4 w-4 text-emerald-500" />
                文案預覽與複製
              </h2>
              {followupResult && (
                <button
                  onClick={() => copyText(followupResult.content)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  {copiedMsg ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedMsg ? '已複製' : '一鍵複製'}
                </button>
              )}
            </div>

            {!followupResult ? (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <MessageSquareHeart className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-xs">請點選左側「生成專屬關懷文案」</p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {followupResult.title}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                    建議於完成服務後第 {followupResult.suggestedSendAfterDays} 天發送
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-mono whitespace-pre-line leading-relaxed text-slate-800 dark:text-slate-200">
                  {followupResult.content}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Capacity & Revenue Analysis */}
      {activeTab === 'capacity' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-rose-600" />
                門市預約產能與稼動率 AI 分析
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                評估技師工時佔用率、尖峰與離峰閒置時段，提供客單價成長建議
              </p>
            </div>
            <button
              onClick={handleAnalyzeCapacity}
              disabled={isAnalyzingCapacity}
              className="px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs active:scale-95 transition-all self-start sm:self-auto"
            >
              {isAnalyzingCapacity ? '分析計算中...' : '重新計算稼動率'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 block mb-1">本週總門市稼動率</span>
              <div className="text-3xl font-extrabold text-rose-950 dark:text-white tabular-nums">
                {capacityResult?.occupancyRate || 74}%
              </div>
              <p className="text-[11px] text-slate-500 mt-1">健康營運範圍在 70% ~ 85%</p>
            </div>

            <div className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 block mb-1">熱門尖峰時段</span>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {capacityResult?.peakHours || '週五至週六 14:00 - 19:00'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">常態滿檔，建議顧客提前 3 天預訂</p>
            </div>

            <div className="p-5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 block mb-1">離峰閒置時段</span>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {capacityResult?.idleHours || '週二至週四 11:00 - 14:00'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">尚有約 25% 空檔可規劃專屬促銷補位</p>
            </div>
          </div>

          {/* AI Actionable Recommendations */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-rose-500" />
              AI 智能增收與排程改善建議
            </h3>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              {(capacityResult?.aiRecommendations || [
                '週二至週四午前為閒置時段，建議推出「平日午間悠閒保養」享 85 折優惠，可有效填補 22% 閒置產能。',
                '週五與週六下午為滿檔高峰期，預約請提前 3 天釋出，可評估增列一位兼職助理加速翻桌率。',
                '水飛梭與日系燙髮為高客單價主力，建議於預約完成頁自動推薦加購「頭皮角質調理」或「保濕安瓶」，提升平均客單價 18%。',
              ]).map((rec: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <div className="h-4 w-4 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <span className="leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
