'use client'

import { useState } from 'react'
import {
  Scale, BookOpen, Clock, FileCheck, ArrowRight, ShieldCheck, AlertTriangle,
  ExternalLink, Search, Sparkles, Building2, CheckCircle2, ChevronRight,
  HelpCircle, AlertCircle, Plane, DollarSign, Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { LegalAnswer } from '@/lib/legal/types'
import type { ProcedurePlanResult } from '@/lib/legal/procedure-agent'
import { SEED_CROSS_BORDER_RULES } from '@/lib/legal/seeds'

export default function LegalAssistantPage() {
  const [activeTab, setActiveTab] = useState<'qa' | 'procedure' | 'import' | 'amendment'>('qa')

  // QA Tab State
  const [queryInput, setQueryInput] = useState('')
  const [loadingQuery, setLoadingQuery] = useState(false)
  const [answer, setAnswer] = useState<LegalAnswer | null>(null)

  // Procedure Tab State
  const [procIndustry, setProcIndustry] = useState('beverage')
  const [procEntity, setProcEntity] = useState('100_FOE')
  const [procProvince, setProcProvince] = useState('Hồ Chí Minh')
  const [procLoading, setProcLoading] = useState(false)
  const [procPlan, setProcPlan] = useState<ProcedurePlanResult | null>(null)

  // Amendment Tab State
  const [traceDocNum, setTraceDocNum] = useState('15/2018/NĐ-CP')
  const [traceArticle, setTraceArticle] = useState('Điều 4')
  const [traceLoading, setTraceLoading] = useState(false)
  const [traceResult, setTraceResult] = useState<any>(null)

  // Quick Prompt Handler
  const handleQuickPrompt = (text: string) => {
    setQueryInput(text)
    handleSearch(text)
  }

  // Submit Legal Query
  const handleSearch = async (overrideQuery?: string) => {
    const q = overrideQuery || queryInput
    if (!q.trim()) return

    setLoadingQuery(true)
    try {
      const res = await fetch('/api/legal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json()
      if (data.success) {
        setAnswer(data.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingQuery(false)
    }
  }

  // Generate Procedure Plan
  const handleGeneratePlan = async () => {
    setProcLoading(true)
    try {
      const res = await fetch('/api/legal/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: procIndustry,
          entity_type: procEntity,
          province: procProvince,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setProcPlan(data.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setProcLoading(false)
    }
  }

  // Trace Amendment
  const handleTrace = async () => {
    setTraceLoading(true)
    try {
      const res = await fetch(
        `/api/legal/trace-amendment?document_number=${encodeURIComponent(traceDocNum)}&article=${encodeURIComponent(traceArticle)}`
      )
      const data = await res.json()
      if (data.success) {
        setTraceResult(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setTraceLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 border border-amber-200 dark:border-amber-900/50 p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400">
                <Scale className="h-7 w-7" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                Vietnam Legal & Business AI Assistant
              </h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-3xl">
              專為跨國台商、外資企業、連鎖餐飲門市打造之越南法律公務文書與企業合規 AI。
              嚴格依據國家法律資料庫 (vbpl.vn)、政府公報 (vanban.chinhphu.vn) 與國家公共服務平台 (dichvucong.gov.vn) 之法定條款點與時態生效判定。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              🏛️ vbpl.vn 國家法律庫
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              📑 vanban.chinhphu.vn 政府法規庫
            </Badge>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              🏢 dichvucong.gov.vn 公共服務
            </Badge>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-amber-200/60 dark:border-amber-900/40">
          <button
            onClick={() => setActiveTab('qa')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'qa'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white/80 dark:bg-card hover:bg-amber-50 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            智能法律諮詢 (Q&A)
          </button>
          <button
            onClick={() => {
              setActiveTab('procedure')
              if (!procPlan) handleGeneratePlan()
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'procedure'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white/80 dark:bg-card hover:bg-amber-50 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Building2 className="h-4 w-4" />
            開門市・公司審批引導 (DAG)
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'import'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white/80 dark:bg-card hover:bg-amber-50 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Plane className="h-4 w-4" />
            各國進口原料與設備規定
          </button>
          <button
            onClick={() => {
              setActiveTab('amendment')
              if (!traceResult) handleTrace()
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'amendment'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white/80 dark:bg-card hover:bg-amber-50 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Clock className="h-4 w-4" />
            條文修法歷程溯源
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: 智能法律諮詢 (QA)                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'qa' && (
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Search className="h-5 w-5 text-amber-600" />
              輸入法律、稅務或行政申請問題（支援中文、英文、越南文）
            </h2>

            <div className="flex gap-2">
              <Input
                value={queryInput}
                onChange={e => setQueryInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="例如：外資在越南開一家手搖飲料店，需要辦什麼許可與文件？"
                className="flex-1 text-sm py-5"
              />
              <Button
                onClick={() => handleSearch()}
                disabled={loadingQuery}
                className="bg-amber-600 hover:bg-amber-700 text-white px-6"
              >
                {loadingQuery ? '法律檢索中...' : '進行法律檢索'}
              </Button>
            </div>

            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-2 pt-2 items-center text-xs text-gray-500">
              <span>常見法規問題快速查詢：</span>
              <button
                onClick={() => handleQuickPrompt('手搖飲料每杯含糖量超過多少需要課徵 10% 特別消費稅？何時生效？')}
                className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-card hover:bg-amber-50 dark:hover:bg-accent border text-gray-700 dark:text-gray-300"
              >
                🍬 含糖飲料特別消費稅門檻與生效日
              </button>
              <button
                onClick={() => handleQuickPrompt('外資在越南開手搖飲料門市，需要辦理哪些法定手續與許可？')}
                className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-card hover:bg-amber-50 dark:hover:bg-accent border text-gray-700 dark:text-gray-300"
              >
                🏬 外商開飲料店 IRC + ERC 辦理程序
              </button>
              <button
                onClick={() => handleQuickPrompt('在越南餐飲門市販售飲品，如何辦理食品安全自宣告 (Tự công bố) 與食安證書？')}
                className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-card hover:bg-amber-50 dark:hover:bg-accent border text-gray-700 dark:text-gray-300"
              >
                🥗 食品安全合格機構證書 (ATTP) 與自宣告
              </button>
              <button
                onClick={() => handleQuickPrompt('進口台灣珍珠粉圓、茶葉與飲料封口機到越南，有哪些關稅與檢驗規定？')}
                className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-card hover:bg-amber-50 dark:hover:bg-accent border text-gray-700 dark:text-gray-300"
              >
                🚢 台灣珍珠茶葉原料與設備進口稅則
              </button>
            </div>
          </Card>

          {/* Result Area */}
          {answer && (
            <Card className="p-6 sm:p-8 space-y-6 border-amber-200/70 shadow-sm">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">法律合規分析結果</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">法律信心等級：</span>
                  <Badge
                    className={
                      answer.confidence_level === 'HIGH'
                        ? 'bg-emerald-100 text-emerald-800'
                        : answer.confidence_level === 'MEDIUM'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }
                  >
                    {answer.confidence_level}
                  </Badge>
                </div>
              </div>

              {/* Conclusion */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">📋 核心法律結論</h4>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-card/80 border text-sm leading-relaxed whitespace-pre-line text-gray-800 dark:text-gray-200">
                  {answer.conclusion}
                </div>
              </div>

              {/* Temporal Notice */}
              {answer.temporal_status.notice && (
                <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-3">
                  <Clock className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">法律時效與生效判定（基準日：{answer.temporal_status.target_date}）：</span>
                    <p className="mt-1 text-xs sm:text-sm">{answer.temporal_status.notice}</p>
                  </div>
                </div>
              )}

              {/* Citations (條/款/點) */}
              {answer.legal_basis.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">⚖️ 具體法定依據（精確至條、款、點）</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {answer.legal_basis.map((c, idx) => (
                      <div key={idx} className="p-4 rounded-xl border bg-white dark:bg-card space-y-2 hover:border-amber-400 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                            {c.document_number}
                          </span>
                          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">
                            {c.status}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.document_title}</p>
                        <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-accent/50 p-2 rounded-lg font-mono">
                          {c.article} {c.clause ? `› ${c.clause}` : ''} {c.point ? `› ${c.point}` : ''}
                        </div>
                        <div className="pt-1 flex items-center justify-between text-xs text-gray-400">
                          <span>生效日: {c.effective_date}</span>
                          <a
                            href={c.official_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                          >
                            檢視官方真確來源 <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exceptions */}
              {answer.exceptions && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">⚠️ 法定例外或豁免情形</h4>
                  <p className="text-sm p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 text-amber-900 dark:text-amber-200">
                    {answer.exceptions}
                  </p>
                </div>
              )}

              {/* Practical Guidance */}
              {answer.practical_interpretation && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">💡 實務審批與執行重點</h4>
                  <p className="text-sm p-4 rounded-xl bg-gray-50 dark:bg-card border text-gray-700 dark:text-gray-300 leading-relaxed">
                    {answer.practical_interpretation}
                  </p>
                </div>
              )}

              {/* Procedures */}
              {answer.procedures && answer.procedures.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">🏢 對應之官方行政申請手續</h4>
                  <div className="space-y-2">
                    {answer.procedures.map((p, idx) => (
                      <div key={idx} className="p-4 rounded-xl border bg-white dark:bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{p.procedure_name}</p>
                          <p className="text-xs text-gray-500">受理機關：{p.authority}</p>
                          <div className="flex gap-4 text-xs text-gray-500 pt-1">
                            <span>⏱️ 審理時程：約 {p.processing_time_days} 工作天</span>
                            <span>💵 官方規費：{p.fee_vnd ? `${p.fee_vnd.toLocaleString()} VND` : '免規費'}</span>
                          </div>
                        </div>
                        {p.online_url && (
                          <a
                            href={p.online_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium shrink-0"
                          >
                            線上申辦入口 <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              {answer.unresolved_disclaimer && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{answer.unresolved_disclaimer}</p>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: 商業門市審批步驟引導 (DAG)                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'procedure' && (
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Building2 className="h-5 w-5 text-amber-600" />
              設定門市與企業設立條件（自動生成循序審批 DAG 路徑）
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">產業類別</label>
                <select
                  value={procIndustry}
                  onChange={e => setProcIndustry(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-card text-sm"
                >
                  <option value="beverage">手搖飲料 / 茶飲連鎖門市</option>
                  <option value="restaurant">一般餐飲 / 餐廳經營</option>
                  <option value="trading">進出口貿易 / 批發零售</option>
                  <option value="manufacturing">食品製造 / 加工廠</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">投資主體型態</label>
                <select
                  value={procEntity}
                  onChange={e => setProcEntity(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-card text-sm"
                >
                  <option value="100_FOE">100% 外資企業 (100% Foreign-Owned Enterprise)</option>
                  <option value="JOINT_VENTURE">越外合資公司 (Joint Venture)</option>
                  <option value="LOCAL_HOUSEHOLD">越南當地個人戶 (Hộ kinh doanh)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">預計落地省市</label>
                <select
                  value={procProvince}
                  onChange={e => setProcProvince(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-card text-sm"
                >
                  <option value="Hồ Chí Minh">胡志明市 (TP. Hồ Chí Minh)</option>
                  <option value="Hà Nội">河內市 (TP. Hà Nội)</option>
                  <option value="Đà Nẵng">峴港市 (TP. Đà Nẵng)</option>
                  <option value="Bình Dương">平陽省 (Bình Dương)</option>
                  <option value="Đồng Nai">同奈省 (Đồng Nai)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                onClick={handleGeneratePlan}
                disabled={procLoading}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {procLoading ? '計算審批路徑中...' : '重新生成審批循序 Checklist'}
              </Button>
            </div>
          </Card>

          {/* Procedure DAG Steps */}
          {procPlan && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-4 bg-amber-500/10 border-amber-200">
                  <span className="text-xs text-gray-500">預估整體法定審查期</span>
                  <p className="text-2xl font-bold text-amber-700 mt-1">
                    {procPlan.total_estimated_days} 工作日
                  </p>
                  <span className="text-[11px] text-gray-400">建議預留 1.5 ~ 2 個月籌備期</span>
                </Card>
                <Card className="p-4 bg-blue-500/10 border-blue-200">
                  <span className="text-xs text-gray-500">預估官方規費合計</span>
                  <p className="text-lg font-bold text-blue-700 mt-1">
                    {procPlan.total_official_fee_estimate}
                  </p>
                  <span className="text-[11px] text-gray-400">不含第三方體檢與公證認證費</span>
                </Card>
                <Card className="p-4 bg-emerald-500/10 border-emerald-200">
                  <span className="text-xs text-gray-500">循序審批總步驟數</span>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">
                    {procPlan.sequential_steps.length} 個步驟
                  </p>
                  <span className="text-[11px] text-gray-400">具備嚴格前後前置相依性</span>
                </Card>
              </div>

              {/* Steps List */}
              <div className="space-y-4">
                {procPlan.sequential_steps.map((step, idx) => (
                  <Card key={idx} className="p-6 border hover:border-amber-400 transition-all space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {step.step_number}
                        </span>
                        <div>
                          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{step.title}</h3>
                          <span className="text-xs text-gray-500 font-mono">法定依據：{step.legal_basis}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 shrink-0">
                        {step.processing_days} 個工作日
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-2">
                        <p><span className="font-semibold text-gray-700 dark:text-gray-300">受理審批機關：</span> {step.responsible_authority}</p>
                        <p><span className="font-semibold text-gray-700 dark:text-gray-300">主管中央部會：</span> {step.governing_ministry}</p>
                        <p><span className="font-semibold text-gray-700 dark:text-gray-300">官方規費標準：</span> {step.official_fee}</p>
                        <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200 text-rose-800">
                          <span className="font-semibold">前置依賴要求：</span> {step.prerequisites}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-300 block">法定應備文件清單 (Dossier)：</span>
                        <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                          {step.dossier_items.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-card border text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">實務重點提醒：</span> {step.practical_notes}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                        <span>官方表格代碼：</span>
                        {step.official_forms.map((f, i) => (
                          <Badge key={i} variant="outline">{f}</Badge>
                        ))}
                      </div>
                      {step.online_url && !step.online_url.includes('臨櫃') && (
                        <a
                          href={step.online_url.split(' ')[0]}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-amber-700 font-medium hover:underline inline-flex items-center gap-1"
                        >
                          官方線上入口 <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: 跨國原料與設備進口規定                                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Plane className="h-5 w-5 text-amber-600" />
                各國食品原料與餐飲設備進口越南管制稅則
              </h2>
              <Badge variant="outline">原產國：台灣 / 日本 → 目的國：越南</Badge>
            </div>
            <p className="text-xs text-gray-500">
              進口食品原料及餐飲設備，需符合越南海關總署與衛生部之雙重檢驗要求。食品原料抵港前必須於越南完成自主公告 (Tự công bố)。
            </p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SEED_CROSS_BORDER_RULES.map((rule, idx) => (
              <Card key={idx} className="p-5 border hover:border-amber-400 transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className={rule.category === 'FOOD' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}>
                      {rule.category === 'FOOD' ? '食品原料' : '餐飲設備'}
                    </Badge>
                    <span className="text-xs font-mono text-gray-500">HS: {rule.hs_code}</span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{rule.item_name_zh}</h3>

                  <div className="grid grid-cols-3 gap-2 py-2 text-center bg-gray-50 dark:bg-card rounded-lg border">
                    <div>
                      <span className="text-[10px] text-gray-400 block">進口關稅</span>
                      <span className="text-xs font-bold text-amber-700">{rule.tariff_rate_percentage}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">進口 VAT</span>
                      <span className="text-xs font-bold text-blue-700">{rule.vat_rate_percentage}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">特別消費稅</span>
                      <span className="text-xs font-bold text-gray-700">{rule.special_consumption_tax}%</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-gray-800 dark:text-gray-200 block">法定監管規定：</span>
                    <p className="leading-relaxed">{rule.regulatory_requirements}</p>
                  </div>
                </div>

                <div className="pt-3 border-t space-y-2 text-xs">
                  <span className="font-semibold text-gray-700 dark:text-gray-300 block">必要單證文件 (Certificates)：</span>
                  <div className="flex flex-wrap gap-1">
                    {rule.required_certificates.map((c, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] bg-white dark:bg-card">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 4: 條文修法歷程溯源                                        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'amendment' && (
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Clock className="h-5 w-5 text-amber-600" />
              法律條文修訂歷程與時態追蹤器
            </h2>
            <div className="flex flex-wrap gap-3">
              <Input
                value={traceDocNum}
                onChange={e => setTraceDocNum(e.target.value)}
                placeholder="法規文號 (如 15/2018/NĐ-CP)"
                className="w-48 text-sm"
              />
              <Input
                value={traceArticle}
                onChange={e => setTraceArticle(e.target.value)}
                placeholder="條號 (如 Điều 4)"
                className="w-36 text-sm"
              />
              <Button
                onClick={handleTrace}
                disabled={traceLoading}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {traceLoading ? '查詢歷程中...' : '查詢條文時間軸'}
              </Button>
            </div>
          </Card>

          {traceResult && (
            <Card className="p-6 space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {traceResult.document.title_vi} ({traceResult.document.number})
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">{traceResult.document.title_zh}</p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800">
                  {traceResult.temporal_evaluation.status}
                </Badge>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-sm text-blue-900">
                {traceResult.temporal_evaluation.notice_zh}
              </div>

              {/* Article Nodes Content */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  現行條文節點 ({traceResult.article})
                </h4>
                <div className="space-y-2">
                  {traceResult.nodes.map((node: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl border bg-white dark:bg-card space-y-2">
                      <span className="text-xs font-mono font-bold text-amber-700">{node.locator}</span>
                      <p className="text-sm text-gray-900 dark:text-gray-100 font-serif leading-relaxed">
                        {node.text_vi}
                      </p>
                      {node.text_zh && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 pt-1 border-t">
                          【中文意譯】：{node.text_zh}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  修法時間軸 (Amendment Timeline)
                </h4>
                <div className="p-4 rounded-xl border bg-gray-50 dark:bg-card space-y-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="font-bold text-gray-800 dark:text-gray-200">{traceResult.document.effective_date}</span>
                    <span className="text-gray-500">正式發布生效，建立全越產品自主公告 (Tự công bố) 體系</span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
