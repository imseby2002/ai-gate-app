/**
 * 多模型圓桌研議 (AI 員工會議)
 *
 * 老闆下指令 → 數個「員工」(不同大模型) 分輪研議 → 整合者彙整報告交付老闆。
 *
 * 流程：
 *   Round 1 獨立發言：每位員工各自針對老闆指令給觀點 (只看指令，互不影響)
 *   Round 2 互評補強：每位員工讀完所有人的發言 → 反駁 / 補強 (暴露盲點)
 *   Round 3 收斂報告：整合者統一成共識報告 + 標註分歧，交付老闆
 *
 * 模型走 Vercel AI Gateway 的 "provider/model" 字串；
 * 若未設定 AI_GATEWAY_API_KEY，退回專案既有的 direct provider 金鑰。
 */
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import type { LanguageModel } from 'ai'

// ── 參與者 ──────────────────────────────────────────────────────────────────

export interface Seat {
  /** 員工代號，顯示用 (例：員工A) */
  name: string
  /** Gateway 模型字串，例：anthropic/claude-sonnet-4-6 */
  model: string
  /** 該員工的專長定位 (注入 system prompt) */
  role: string
}

/** 預設員工陣容 — 跨廠商不同視角 */
export const DEFAULT_SEATS: Seat[] = [
  { name: '員工A', model: 'anthropic/claude-sonnet-4-6', role: '主分析師，負責提出完整論點與可行方案' },
  { name: '員工B', model: 'openai/gpt-5',                role: '魔鬼代言人，負責挑錯、提出反方論點與風險' },
  { name: '員工C', model: 'google/gemini-2.5-pro',      role: '事實查證員，負責補充資料、數據與被忽略的面向' },
]

/** 整合者 (主持人) — 收斂全場成最終報告 */
export const DEFAULT_MODERATOR: Seat = {
  name: '整合者',
  model: 'anthropic/claude-opus-4-8',
  role: '會議主持人，負責彙整所有員工發言成一份交付老闆的完整報告',
}

// ── 模型解析 (Gateway 優先，否則 direct) ─────────────────────────────────────

function resolveModel(id: string): LanguageModel | string {
  // 設了 Gateway 金鑰就直接交給 AI SDK 內建的 gateway (字串形式)
  if (process.env.AI_GATEWAY_API_KEY) return id

  // 沒有 Gateway → 退回專案既有 direct provider
  const slash = id.indexOf('/')
  const provider = slash === -1 ? '' : id.slice(0, slash)
  const model = slash === -1 ? id : id.slice(slash + 1)

  if (provider === 'anthropic') {
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })(model)
  }
  if (provider === 'openai') {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY! }).chat(model)
  }
  if (provider === 'google') {
    return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })(model)
  }
  // 未知 → 原樣交給 gateway，讓上層錯誤處理
  return id
}

// ── 事件 (供 SSE 即時串流) ───────────────────────────────────────────────────

export type RoundtableEvent =
  | { type: 'phase'; phase: 'discuss' | 'rebut' | 'synthesize'; label: string }
  | { type: 'seat-start'; round: number; name: string; model: string }
  | { type: 'delta'; round: number; name: string; content: string }
  | { type: 'seat-end'; round: number; name: string }
  | { type: 'report'; content: string }
  | { type: 'error'; name: string; error: string }

interface Statement {
  name: string
  role: string
  content: string
}

// ── 單一發言 (串流逐字回拋) ──────────────────────────────────────────────────

async function speak(
  seat: Seat,
  systemPrompt: string,
  userPrompt: string,
  round: number,
  emit: (e: RoundtableEvent) => void,
  maxTokens = 2048,
): Promise<string> {
  emit({ type: 'seat-start', round, name: seat.name, model: seat.model })
  let full = ''
  try {
    const result = await streamText({
      model: resolveModel(seat.model) as LanguageModel,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: maxTokens,
      abortSignal: AbortSignal.timeout(60000),
    })
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        full += part.text
        emit({ type: 'delta', round, name: seat.name, content: part.text })
      } else if (part.type === 'error') {
        throw part.error
      }
    }
  } catch (err) {
    emit({ type: 'error', name: seat.name, error: String(err) })
  }
  emit({ type: 'seat-end', round, name: seat.name })
  return full
}

function formatStatements(statements: Statement[]): string {
  return statements
    .map(s => `### ${s.name} (${s.role})\n${s.content || '(未發言)'}`)
    .join('\n\n')
}

// ── 主流程 ────────────────────────────────────────────────────────────────

export interface RoundtableConfig {
  bossInstruction: string
  seats?: Seat[]
  moderator?: Seat
  /** 是否進行第 2 輪互評 (預設 true) */
  rebuttal?: boolean
}

export async function runRoundtable(
  config: RoundtableConfig,
  emit: (e: RoundtableEvent) => void,
): Promise<string> {
  const seats = config.seats?.length ? config.seats : DEFAULT_SEATS
  const moderator = config.moderator ?? DEFAULT_MODERATOR
  const boss = config.bossInstruction.trim()

  // ── Round 1：獨立發言 ───────────────────────────────────────────────────
  emit({ type: 'phase', phase: 'discuss', label: '第一輪 · 獨立研議' })
  const round1: Statement[] = []
  for (const seat of seats) {
    const system =
      `你是一場高層會議的與會員工，定位：${seat.role}。\n` +
      `請針對老闆的指令，提出你專業、具體、有依據的觀點。獨立思考，不需客套。`
    const content = await speak(seat, system, `老闆的指令：\n${boss}`, 1, emit)
    round1.push({ name: seat.name, role: seat.role, content })
  }

  // ── Round 2：互評補強 ───────────────────────────────────────────────────
  let round2: Statement[] = round1
  if (config.rebuttal !== false) {
    emit({ type: 'phase', phase: 'rebut', label: '第二輪 · 互評補強' })
    round2 = []
    const transcript = formatStatements(round1)
    for (const seat of seats) {
      const system =
        `你是會議員工，定位：${seat.role}。\n` +
        `以下是全體第一輪的發言。請指出他人論點的問題、補強自己的觀點、` +
        `並針對分歧表態。只談新增與修正，不要重複第一輪。`
      const userPrompt =
        `老闆的指令：\n${boss}\n\n第一輪全體發言：\n${transcript}`
      const content = await speak(seat, system, userPrompt, 2, emit)
      round2.push({ name: seat.name, role: seat.role, content })
    }
  }

  // ── Round 3：整合者收斂報告 ─────────────────────────────────────────────
  emit({ type: 'phase', phase: 'synthesize', label: '第三輪 · 彙整報告' })
  const moderatorSystem =
    `你是會議主持人，${moderator.role}。\n` +
    `請把全體員工的研議彙整成一份交付老闆的完整報告，使用以下結構：\n` +
    `1. 結論摘要 (老闆 30 秒看完)\n` +
    `2. 各員工關鍵觀點\n` +
    `3. 分歧點與取捨\n` +
    `4. 推薦方案與理由\n` +
    `5. 風險與待確認事項\n` +
    `用繁體中文，條理清晰、可直接決策。`
  const allRounds =
    `老闆的指令：\n${boss}\n\n` +
    `【第一輪 獨立發言】\n${formatStatements(round1)}\n\n` +
    (config.rebuttal !== false ? `【第二輪 互評補強】\n${formatStatements(round2)}\n` : '')

  const report = await speak(moderator, moderatorSystem, allRounds, 3, emit, 4096)
  emit({ type: 'report', content: report })
  return report
}
