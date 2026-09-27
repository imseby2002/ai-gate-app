// AI 模組方案定義（AI 對話／智慧圓桌／法律合規／AI Agent／職場助手）。
// 唯一的方案規則來源：API 守門（lib/module-plans/entitlements.ts）、admin 方案管理頁都讀這裡。
// 純常數，client／server 皆可 import。點數計價不在這裡：方案只控制功能與每月上限，扣點照舊。

export type ModulePlan = 'free' | 'core' | 'pro' | 'max'
export const MODULE_PLANS: ModulePlan[] = ['free', 'core', 'pro', 'max']
export const MODULE_PLAN_LABEL: Record<ModulePlan, string> = { free: 'FREE', core: 'CORE', pro: 'PRO', max: 'MAX' }

export type PlanModuleId = 'chat' | 'roundtable' | 'legal' | 'agent' | 'resume'
export const PLAN_MODULES: { id: PlanModuleId; label: string }[] = [
  { id: 'chat', label: 'AI 對話' },
  { id: 'roundtable', label: '智慧圓桌' },
  { id: 'legal', label: '法律合規 AI' },
  { id: 'agent', label: 'AI Agent' },
  { id: 'resume', label: '職場助手' },
]
export function isPlanModule(id: string): id is PlanModuleId {
  return PLAN_MODULES.some(m => m.id === id)
}

// ── AI 對話 ───────────────────────────────────────────────
export interface ChatPlanFeatures {
  /** false = 只能用 lib/ai/chat-policy.ts 的免費／低價模型白名單 */
  allModels: boolean
  /** 每日可送出則數（個人帳號）；Infinity = 不限 */
  dailyMessageLimit: number
  imageGen: boolean
  videoGen: boolean
  ragAssistants: boolean
  /** 可建立的 RAG 助理數 */
  assistantLimit: number
}
export const CHAT_PLAN_FEATURES: Record<ModulePlan, ChatPlanFeatures> = {
  free: { allModels: false, dailyMessageLimit: 20,       imageGen: false, videoGen: false, ragAssistants: false, assistantLimit: 0 },
  core: { allModels: true,  dailyMessageLimit: 100,      imageGen: false, videoGen: false, ragAssistants: false, assistantLimit: 0 },
  pro:  { allModels: true,  dailyMessageLimit: 300,      imageGen: true,  videoGen: false, ragAssistants: true,  assistantLimit: 3 },
  max:  { allModels: true,  dailyMessageLimit: Infinity, imageGen: true,  videoGen: true,  ragAssistants: true,  assistantLimit: Infinity },
}

// ── 智慧圓桌 ─────────────────────────────────────────────
export type RoundtableVerbosity = 'concise_150' | 'standard_300' | 'detailed_500' | 'unlimited'
export interface RoundtablePlanFeatures {
  /** false = 領域固定 auto（自動判斷） */
  chooseDomain: boolean
  verbosity: RoundtableVerbosity[]
  /** 自訂席位與指定專家 */
  customSeats: boolean
  rebuttal: boolean
  /** false = 只能用 default 總結風格 */
  synthesisStyles: boolean
  customModerator: boolean
  /** 會議紀錄列表可查看的筆數；Infinity = 全部 */
  historyLimit: number
}
export const ROUNDTABLE_PLAN_FEATURES: Record<ModulePlan, RoundtablePlanFeatures> = {
  free: { chooseDomain: false, verbosity: ['concise_150', 'standard_300'], customSeats: false, rebuttal: false, synthesisStyles: false, customModerator: false, historyLimit: 20 },
  core: { chooseDomain: true,  verbosity: ['concise_150', 'standard_300', 'detailed_500'], customSeats: false, rebuttal: false, synthesisStyles: false, customModerator: false, historyLimit: 20 },
  pro:  { chooseDomain: true,  verbosity: ['concise_150', 'standard_300', 'detailed_500'], customSeats: true,  rebuttal: true,  synthesisStyles: true,  customModerator: false, historyLimit: 20 },
  max:  { chooseDomain: true,  verbosity: ['concise_150', 'standard_300', 'detailed_500', 'unlimited'], customSeats: true, rebuttal: true, synthesisStyles: true, customModerator: true, historyLimit: Infinity },
}

// ── 法律合規 AI ───────────────────────────────────────────
export interface LegalPlanFeatures {
  /** 法規問答每月次數；Infinity = 不限 */
  qaMonthlyLimit: number
  procedures: boolean
  /** 跨國原料與設備進口規定（法律頁「進口規定」分頁） */
  importRules: boolean
  amendmentTrace: boolean
  /** 可查詢的國家法規；'all' = 全部。目前法規資料只有越南（vn） */
  countries: string[] | 'all'
}
export const LEGAL_PLAN_FEATURES: Record<ModulePlan, LegalPlanFeatures> = {
  free: { qaMonthlyLimit: 10,       procedures: false, importRules: false, amendmentTrace: false, countries: ['vn'] },
  core: { qaMonthlyLimit: Infinity, procedures: true,  importRules: false, amendmentTrace: false, countries: ['vn'] },
  pro:  { qaMonthlyLimit: Infinity, procedures: true,  importRules: true,  amendmentTrace: true,  countries: ['vn'] },
  max:  { qaMonthlyLimit: Infinity, procedures: true,  importRules: true,  amendmentTrace: true,  countries: 'all' },
}

// ── AI Agent ─────────────────────────────────────────────
/** 研發程式角色（讀 repo、提出程式修改），限 MAX */
export const AGENT_CODE_ROLE_ID = 'rnd'
export interface AgentPlanFeatures {
  enabled: boolean
  /** 每月可使用的不同角色數；Infinity = 全部 */
  roleLimit: number
  /** 每月可建立的任務數；Infinity = 不限 */
  monthlyRunLimit: number
  /** 同時執行中（queued／running／等待核准）的任務數上限 */
  concurrentRuns: number
  codeAgent: boolean
}
export const AGENT_PLAN_FEATURES: Record<ModulePlan, AgentPlanFeatures> = {
  free: { enabled: false, roleLimit: 0,        monthlyRunLimit: 0,        concurrentRuns: 0, codeAgent: false },
  core: { enabled: true,  roleLimit: 1,        monthlyRunLimit: 20,       concurrentRuns: 1, codeAgent: false },
  pro:  { enabled: true,  roleLimit: Infinity, monthlyRunLimit: Infinity, concurrentRuns: 1, codeAgent: false },
  max:  { enabled: true,  roleLimit: Infinity, monthlyRunLimit: Infinity, concurrentRuns: 5, codeAgent: true },
}

// ── 職場助手 ─────────────────────────────────────────────
export type ResumeCategory = 'job-search' | 'workplace' | 'advanced' | 'thinking'
export const RESUME_CATEGORY_LABEL: Record<ResumeCategory, string> = {
  'job-search': '求職', workplace: '職場日常', advanced: '職場進階', thinking: '思維模型',
}
/** 工具 id → 分類（與 app/(standalone)/resume/page.tsx 的工具清單一致） */
export const RESUME_TOOL_CATEGORY: Record<string, ResumeCategory> = {
  'resume-optimize': 'job-search', 'cover-letter': 'job-search', 'interview-practice': 'job-search',
  'salary-negotiation': 'job-search', 'resume-clinic': 'job-search', 'career-advisor': 'job-search',
  'email-draft': 'workplace', 'report-writing': 'workplace', 'presentation-outline': 'workplace', 'meeting-minutes': 'workplace',
  'workplace-phrases': 'advanced', 'workplace-relationship': 'advanced', 'performance-review': 'advanced',
  'promotion-letter': 'advanced', 'quantify-work': 'advanced',
  'munger-mental-models': 'thinking', 'first-principles': 'thinking', 'value-investing': 'thinking',
  'antifragile-risk': 'thinking', 'naval-leverage': 'thinking',
}
export interface ResumePlanFeatures {
  categories: ResumeCategory[]
  /** 履歷優化、求職信每月各自的次數；Infinity = 不限 */
  optimizeMonthlyLimit: number
  coverLetterMonthlyLimit: number
  /** 求職信可用的模板數（依 sort_order 前 N 個）；Infinity = 全部 */
  templateLimit: number
}
export const RESUME_PLAN_FEATURES: Record<ModulePlan, ResumePlanFeatures> = {
  free: { categories: ['job-search'], optimizeMonthlyLimit: 1, coverLetterMonthlyLimit: 1, templateLimit: 3 },
  core: { categories: ['job-search', 'workplace'], optimizeMonthlyLimit: Infinity, coverLetterMonthlyLimit: Infinity, templateLimit: 3 },
  pro:  { categories: ['job-search', 'workplace', 'advanced'], optimizeMonthlyLimit: Infinity, coverLetterMonthlyLimit: Infinity, templateLimit: 3 },
  max:  { categories: ['job-search', 'workplace', 'advanced', 'thinking'], optimizeMonthlyLimit: Infinity, coverLetterMonthlyLimit: Infinity, templateLimit: Infinity },
}

export interface ModuleFeatureMap {
  chat: ChatPlanFeatures
  roundtable: RoundtablePlanFeatures
  legal: LegalPlanFeatures
  agent: AgentPlanFeatures
  resume: ResumePlanFeatures
}
export const MODULE_PLAN_FEATURES: { [K in PlanModuleId]: Record<ModulePlan, ModuleFeatureMap[K]> } = {
  chat: CHAT_PLAN_FEATURES,
  roundtable: ROUNDTABLE_PLAN_FEATURES,
  legal: LEGAL_PLAN_FEATURES,
  agent: AGENT_PLAN_FEATURES,
  resume: RESUME_PLAN_FEATURES,
}

/** admin 方案管理頁的方案摘要（每個模組每級一行） */
export const MODULE_PLAN_SUMMARY: Record<PlanModuleId, Record<ModulePlan, string>> = {
  chat: {
    free: '免費／低價模型，每日 20 則（公司成員 100 則）',
    core: '全部模型，每日 100 則',
    pro: '全部模型，每日 300 則＋畫圖＋RAG 助理（3 個）',
    max: '不限則數＋影片生成＋RAG 助理不限',
  },
  roundtable: {
    free: '預設席位、自動領域、字數 150／300',
    core: '可選領域、字數加開 500',
    pro: '自訂席位與專家、反方辯論、5 種總結風格',
    max: '自訂主持人、字數不限、會議紀錄全部保留',
  },
  legal: {
    free: '法規問答每月 10 次',
    core: '法規問答不限＋行政程序',
    pro: '＋跨國進口規定、修法追溯',
    max: '＋多國法規',
  },
  agent: {
    free: '不開放',
    core: '1 個角色、每月 20 次任務',
    pro: '全部角色、同時 1 個任務',
    max: '全部角色、同時 5 個任務、研發程式角色',
  },
  resume: {
    free: '求職類（履歷優化、求職信每月各 1 次）',
    core: '求職不限＋職場日常',
    pro: '＋職場進階',
    max: '＋思維模型、全部求職信模板',
  },
}

/** 方案升級提示用：回傳第一個符合條件的方案標籤（例如「PRO 以上」） */
export function minPlanLabel<K extends PlanModuleId>(module: K, test: (f: ModuleFeatureMap[K]) => boolean): string {
  const table = MODULE_PLAN_FEATURES[module] as Record<ModulePlan, ModuleFeatureMap[K]>
  const p = MODULE_PLANS.find(plan => test(table[plan]))
  return p ? `${MODULE_PLAN_LABEL[p]} 以上` : '更高方案'
}
