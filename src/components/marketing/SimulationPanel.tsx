'use client'

import { useState } from 'react'
import {
  Users, AlertTriangle, CheckCircle2, TrendingUp,
  ChevronDown, ChevronUp, Zap, RefreshCw, Loader2,
  ThumbsUp, Share2, MessageSquare, Eye, Flag,
} from 'lucide-react'
import type { SimulationResult } from '@/app/api/marketing/simulate/route'

export type { SimulationResult }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BEHAVIOR_CFG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  share:            { label: '轉發',   icon: Share2,        color: 'text-blue-500'   },
  like:             { label: '按讚',   icon: ThumbsUp,      color: 'text-green-500'  },
  comment_positive: { label: '正評',   icon: MessageSquare, color: 'text-green-600'  },
  ignore:           { label: '忽略',   icon: Eye,           color: 'text-gray-400'   },
  comment_negative: { label: '負評',   icon: MessageSquare, color: 'text-orange-500' },
  report:           { label: '舉報',   icon: Flag,          color: 'text-red-500'    },
}

const CRISIS_STYLE = {
  high:   { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700',   badge: 'bg-red-100 text-red-700',    label: '高' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', label: '中' },
  low:    { bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-700',  badge: 'bg-blue-100 text-blue-700',  label: '低' },
}

function scoreColor(s: number) {
  if (s > 30) return 'text-green-600'
  if (s < -30) return 'text-red-500'
  return 'text-amber-500'
}

function scoreBar(s: number) {
  if (s > 30) return 'bg-green-500'
  if (s < -30) return 'bg-red-500'
  return 'bg-amber-400'
}

// ─── PersonaCard ──────────────────────────────────────────────────────────────

function PersonaCard({ persona }: { persona: SimulationResult['personas'][0] }) {
  const [open, setOpen] = useState(false)
  const b = BEHAVIOR_CFG[persona.socialBehavior]
  const BIcon = b?.icon ?? MessageSquare

  return (
    <div className="border rounded-xl overflow-hidden bg-white">
      <div className={`h-1 w-full ${scoreBar(persona.sentimentScore)}`} />
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-gray-800">{persona.type}</span>
              {persona.coalition && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{persona.coalition}</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{persona.description}</p>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-xl font-bold ${scoreColor(persona.sentimentScore)}`}>
              {persona.sentimentScore > 0 ? '+' : ''}{persona.sentimentScore}
            </div>
            <div className="text-[10px] text-gray-400">情感分</div>
          </div>
        </div>

        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${scoreBar(persona.sentimentScore)}`}
            style={{ width: `${(persona.sentimentScore + 100) / 2}%` }}
          />
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">{persona.reaction}</p>

        <div className="flex items-center gap-1.5">
          <BIcon className={`h-3 w-3 ${b?.color ?? 'text-gray-400'}`} />
          <span className={`text-xs font-medium ${b?.color ?? 'text-gray-400'}`}>{b?.label ?? persona.socialBehavior}</span>
          <span className="text-xs text-gray-300 ml-auto">影響力 {persona.influenceScore}</span>
        </div>

        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {open ? '收起' : '展開詳情'}
        </button>

        {open && (
          <div className="space-y-2 pt-1 border-t">
            {persona.keyResonance.length > 0 && (
              <div>
                <p className="text-xs font-medium text-green-600 mb-1">✓ 引起共鳴</p>
                {persona.keyResonance.map((r, i) => (
                  <p key={i} className="text-xs text-gray-500 leading-relaxed">• {r}</p>
                ))}
              </div>
            )}
            {persona.keyObjections.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-500 mb-1">✗ 主要疑慮</p>
                {persona.keyObjections.map((o, i) => (
                  <p key={i} className="text-xs text-gray-500 leading-relaxed">• {o}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SimulationPanel ──────────────────────────────────────────────────────────

interface SimulationPanelProps {
  result: SimulationResult
  onRerun: (scenario: string) => Promise<void>
  isRunning?: boolean
}

export function SimulationPanel({ result, onRerun, isRunning = false }: SimulationPanelProps) {
  const [scenario, setScenario] = useState('')
  const [showPersonas, setShowPersonas] = useState(true)

  const sorted = [...result.personas].sort((a, b) => b.sentimentScore - a.sentimentScore)

  return (
    <div className="space-y-5">

      {/* ── Metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '整體情感分',  value: `${result.overallSentiment > 0 ? '+' : ''}${result.overallSentiment}`, color: scoreColor(result.overallSentiment), bg: 'bg-gray-50' },
          { label: '正向傳播',    value: `${result.predictedSpread.organic}%`,  color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
          { label: '負面口碑',    value: `${result.predictedSpread.negative}%`, color: 'text-red-500',   bg: 'bg-red-50 border-red-100'   },
          { label: '無顯著影響',  value: `${result.predictedSpread.neutral}%`,  color: 'text-gray-400',  bg: 'bg-gray-50'                  },
        ].map(m => (
          <div key={m.label} className={`p-3 rounded-xl border text-center ${m.bg}`}>
            <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
            <div className="text-[10px] text-gray-400 mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* ── Summary ── */}
      <div className="p-4 rounded-xl bg-gray-50 border">
        <p className="text-sm text-gray-700 leading-relaxed">{result.summary}</p>
      </div>

      {/* ── Coalitions ── */}
      {result.coalitions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-semibold text-gray-700">消費者陣營</span>
          </div>
          <div className="space-y-3">
            {result.coalitions.map((c, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${c.isSupporter ? 'bg-green-500' : 'bg-red-400'}`} />
                    <span className="text-sm font-medium text-gray-700">{c.name}</span>
                    <span className="text-xs text-gray-400">({c.memberIds.length} 族群)</span>
                  </div>
                  <span className={`text-sm font-bold ${c.isSupporter ? 'text-green-600' : 'text-red-500'}`}>
                    {c.percentage}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 pl-5 leading-relaxed">{c.stance}</p>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${c.isSupporter ? 'bg-green-500' : 'bg-red-400'}`}
                    style={{ width: `${c.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Crisis + Resonance ── */}
      <div className="grid sm:grid-cols-2 gap-4">
        {result.crisisRisks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-gray-700">公關危機風險</span>
            </div>
            <div className="space-y-2">
              {result.crisisRisks.map((r, i) => {
                const s = CRISIS_STYLE[r.severity]
                return (
                  <div key={i} className={`p-3 rounded-xl border ${s.bg} ${s.border}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${s.text}`}>{r.topic}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${s.badge}`}>{s.label}風險</span>
                    </div>
                    <p className={`text-xs ${s.text} opacity-80 leading-relaxed`}>{r.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {result.resonancePoints.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-semibold text-gray-700">高共鳴訊息點</span>
            </div>
            <div className="space-y-2">
              {result.resonancePoints.map((p, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-green-50 border border-green-100">
                  <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                    p.impact === 'high'   ? 'bg-green-200 text-green-800' :
                    p.impact === 'medium' ? 'bg-green-100 text-green-700' :
                                            'bg-gray-100 text-gray-500'
                  }`}>
                    {p.impact === 'high' ? '強' : p.impact === 'medium' ? '中' : '弱'}
                  </span>
                  <p className="text-xs text-green-800 leading-relaxed">{p.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Persona grid ── */}
      <div>
        <button
          onClick={() => setShowPersonas(o => !o)}
          className="flex items-center gap-2 w-full mb-3"
        >
          <Users className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-semibold text-gray-700">Persona 詳情（{result.personas.length}）</span>
          {showPersonas
            ? <ChevronUp className="h-4 w-4 text-gray-400 ml-auto" />
            : <ChevronDown className="h-4 w-4 text-gray-400 ml-auto" />
          }
        </button>
        {showPersonas && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sorted.map(p => <PersonaCard key={p.id} persona={p} />)}
          </div>
        )}
      </div>

      {/* ── AI Recommendation ── */}
      <div className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-800">AI 優化建議</span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{result.recommendation}</p>
      </div>

      {/* ── Scenario injection ── */}
      <div className="p-4 rounded-xl bg-gray-50 border space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-700">情境注入（上帝視角）</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">選填</span>
        </div>
        <p className="text-xs text-gray-400">注入新假設，觀察消費者立場如何改變</p>
        <textarea
          value={scenario}
          onChange={e => setScenario(e.target.value)}
          rows={2}
          placeholder="例：「競爭對手突然降價 30%」、「產品爆出品質問題」、「獲得知名藝人代言」…"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
        />
        <button
          onClick={() => onRerun(scenario)}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all bg-amber-500 hover:bg-amber-600"
        >
          {isRunning
            ? <><Loader2 className="h-4 w-4 animate-spin" />重新模擬中…</>
            : <><RefreshCw className="h-4 w-4" />重新模擬</>
          }
        </button>
      </div>
    </div>
  )
}
