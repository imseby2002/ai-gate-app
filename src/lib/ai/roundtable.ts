/**
 * 次世代 AI 智慧圓桌會議 2.0 (Interactive Virtual Boardroom)
 *
 * 核心架構：
 * 1. 🗄️ 資料專員 (Fact Briefing Layer)：
 *    - 採用 Gemini 2.5 Flash + Google 聯網檢索，產出客觀 Fact Sheet。
 *    - 支援四大領域專屬檢核表 (金融/行銷/技術/組織) 與通用 5W2H 事實矩陣。
 *    - 嚴禁主觀評價，無數據標記 N/A，杜絕幻覺。
 *
 * 2. 🤝 合夥人會議討論 (Discussion Layer)：
 *    - 席位具備不同專業視角 (不可能三角)，以真實會議方式交流：回應、補充、修正、收斂共識。
 *    - 植入【反阿諛討好協議】與【嚴格防幻覺協議】。
 *    - 嚴禁抄背景廢話，直奔核心觀點，釋放 Token 配額。
 *
 * 3. ⚡ 同輪平行併發 (Parallel Streaming)：
 *    - 每一輪多模型透過 Promise.all 平行串流輸出，會議時間大幅縮減 70%。
 *
 * 4. 🎛️ 老闆動態指揮台 (Human-in-the-Loop)：
 *    - 支援中斷暫停、全員深化、點名單挑、隨時結會。
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import type { LanguageModel } from 'ai'
import { createChainModel } from './proxy-fallback'
import { loadExpertContext } from '@/lib/experts/loader'

// ── 用量記錄（供 API route 會後扣點）────────────────────────────────────────
// 此檔也被 client 頁面 import，不能直接用 node:async_hooks；由 server 端的
// lib/ai/roundtable-usage.ts 註冊記錄函式，未註冊（client 端）時不做任何事。
type UsageSink = (billingModelId: string, inputTokens: number, outputTokens: number) => void
let usageSink: UsageSink | null = null
export function registerRoundtableUsageSink(sink: UsageSink) {
  usageSink = sink
}

function addUsage(billingModelId: string, inputTokens?: number, outputTokens?: number) {
  usageSink?.(billingModelId, inputTokens ?? 0, outputTokens ?? 0)
}

// ── 領域與哲學學派定義 ────────────────────────────────────────────────────────

export type RoundtableDomain = 'auto' | 'academic' | 'finance' | 'marketing' | 'tech' | 'hr'

export interface DomainStance {
  name: string // 員工A, 員工B, 員工C
  title: string
  philosophy: string
  attackTriggers: string
}

export interface DomainPreset {
  id: RoundtableDomain
  label: string
  icon: string
  description: string
  dataChecklist: string
  stances: DomainStance[]
}

export const DOMAIN_PRESETS: Record<RoundtableDomain, DomainPreset> = {
  academic: {
    id: 'academic',
    label: '大學學術',
    icon: 'GraduationCap',
    description: '理論本質、經世致用、產學落地與學術倫理治理',
    dataChecklist: `
針對討論的學術/高教/研究議題，強制查核並列出客觀指標矩陣：
1. 學術基石與現狀：國際權威文獻/頂級期刊 (SCI/SSCI) 共識、核心理論奠基人與主流學派爭點。
2. 實證與產業數據：該領域現有全球研發投資額、專利轉化率、畢業生就業起薪與業界實際採納率。
3. 倫理與法規邊界：相關學術誠信守則、教育部/評鑑機構法規、AI/智財版權爭端、研究受試者倫理標準。
4. 國內外標竿案例：全球前 50 大學（如哈佛、MIT、史丹佛、牛津）或國內領先大學目前的實際政策與處置作法。
*(鐵律：無公開數據強制標記 N/A，嚴禁編造)*`,
    stances: [
      {
        name: '員工A',
        title: '學術基石 · 理論真理派 (Academic Rigor & Epistemic Truth)',
        philosophy: '大學是追求真理與原創思想的殿堂。沒有深刻的理論根基與獨立批判思維，任何熱門技術或政策都只是泡沫。',
        attackTriggers: '提醒討論中是否過度迎合市場短期需求、犧牲學術品質；行政指標是否壓縮原創研究空間。',
      },
      {
        name: '員工B',
        title: '經世致用 · 實證創新派 (Empirical & Pragmatic Utility)',
        philosophy: '學術必須解決真實世界難題。無法落地驗證、不能讓學生在就業市場脫穎而出的理論，只是象牙塔裡的自我陶醉。',
        attackTriggers: '提醒方案是否脫離真實需求、無法驗證落地；行政流程是否過慢而錯失時機。',
      },
      {
        name: '員工C',
        title: '倫理法治 · 永續治理派 (Ethical & Institutional Governance)',
        philosophy: '守住底線才能長青。再崇高的理想或突破，一旦觸犯學術倫理紅線、違反法規或導致少子化退場破產，一切歸零。',
        attackTriggers: '提醒是否考慮少子化生源與財務現實；求快時是否觸及倫理規範與校譽風險。',
      },
    ],
  },
  finance: {
    id: 'finance',
    label: '投資金融',
    icon: 'TrendingUp',
    description: '財報數據、估值倍數、現金流與商業護城河審計',
    dataChecklist: `
針對涉及的每一家公司，強制查核並列出「六大維度財務指標矩陣」：
1. 規模與成長動能：市值 (Market Cap)、最新季度營收、YoY 成長率、次季官方財測指引 (Guidance)。
2. 獲利與現金流品質：毛利率 (Gross Margin)、營業利益率 (Operating Margin)、自由現金流 (FCF) 與 FCF Margin。
3. 軟體/SaaS 專屬指標：ARR (年度經常性收入)、RPO (未履行合約金額)、Rule of 40 分數 (成長率 + FCF Margin)。
4. 估值乘數與市場定價：Trailing P/E、Forward P/E、EV/Sales、PEG Ratio、華爾街分析師平均目標價與評等分佈。
5. 資產負債與流動性：手頭現金與短期投資、總負債、淨現金/淨負債 (Net Cash/Debt)。
6. 重大風險與事件：近期重大併購、反托拉斯調查、資安事故或核心客戶流失。
*(鐵律：若非公開或無官方數據，強制標記 N/A，嚴禁編造)*`,
    stances: [
      {
        name: '員工A',
        title: '成長動能派 (Growth & Momentum)',
        philosophy: '市場空間 (TAM) 與飛輪效應最重要，只要營收增速領先、市場份額在擴大，高估值就是合理的。',
        attackTriggers: '提醒是否因過度保守而錯失市場成長機會。',
      },
      {
        name: '員工B',
        title: '價值安全邊際派 (Value & Margin of Safety)',
        philosophy: '沒有任何公司值得用瘋狂溢價購買。看重真實的自由現金流 (FCF)、估值乘數與下行防禦。',
        attackTriggers: '提醒是否過度依賴 Non-GAAP 指標、低估景氣反轉時高估值的下行風險。',
      },
      {
        name: '員工C',
        title: '護城河與商業本質派 (Moat & Business Reality)',
        philosophy: '短期成長與低估值都是假的，客戶的轉換成本 (Switching Cost)、定價權與技術壁壘才是真的。',
        attackTriggers: '提醒是否只看短期財報，忽略產品被開源或競品侵蝕的長期威脅。',
      },
    ],
  },
  marketing: {
    id: 'marketing',
    label: '行銷增長',
    icon: 'Target',
    description: '獲客成本、轉化漏斗、品牌溢價與客戶終身價值',
    dataChecklist: `
針對討論的產品或行業，強制查核並列出客觀市場矩陣：
1. 市場定價與受眾：競品定價區間、目標受眾輪廓 (ICP)、客單價 (AOV) 業界基準。
2. 流量渠道與成本：主流獲客渠道（Meta/Google Search/TikTok/KOL/SEO）、業界平均獲客成本 (CAC) 與點擊/轉換率基準。
3. 留存與生命週期：業界平均 30/90 天留存率、退訂/流失率 (Churn Rate) 基準。
4. 競品近期動態：主要競品近期的主力促銷手法、訴求賣點、社群聲量與常見客訴痛點。
*(鐵律：無公開數據強制標記 N/A)*`,
    stances: [
      {
        name: '員工A',
        title: '效果數據與 ROI 派 (Performance & Growth)',
        philosophy: '無法衡量的東西就不存在。看重 CAC、ROAS、即時轉換率與短週期現金回流。',
        attackTriggers: '提醒方案是否有可衡量的轉化指標，而非只談品牌形象。',
      },
      {
        name: '員工B',
        title: '心智與品牌資產派 (Brand Equity & Pricing Power)',
        philosophy: '流量買得到點擊，買不到偏好；定價權來自心智護城河，降價促銷是毒藥。',
        attackTriggers: '提醒頻繁促銷或追求點擊率是否會稀釋品牌與定價權。',
      },
      {
        name: '員工C',
        title: '產品驅動與 LTV 留存派 (Product-Led & Retention)',
        philosophy: '最好的行銷是產品本身會說話；留不住用戶，前端引流都是往破桶裡倒水。',
        attackTriggers: '提醒產品體驗與留存是否跟得上獲客投入；是否只重首購忽略回購。',
      },
    ],
  },
  tech: {
    id: 'tech',
    label: '技術架構',
    icon: 'Code',
    description: '系統擴展性、效能基準、技術債與雲端基礎設施成本',
    dataChecklist: `
針對提及的架構或技術棧，強制查核並列出客觀指標：
1. 生態與授權：GitHub Stars、月下載量、最新版本發布時間、開源授權協議 (License)。
2. 客觀效能基準：官方或權威第三方的延遲 (Latency)、吞吐量 (QPS/TPS)、資源佔用。
3. 基礎設施成本：雲端服務（AWS/GCP/Azure）或託管服務的計費模型與基本月度開銷。
4. 已知限制與漏洞：官方文件載明的硬性限制、兼容性瓶頸、重大 CVE 安全漏洞紀錄。
*(鐵律：無公開數據強制標記 N/A)*`,
    stances: [
      {
        name: '員工A',
        title: '極速交付派 (Speed & Shipping)',
        philosophy: '能跑起來驗證商業價值最重要。不能上線換取市場回饋的完美架構都是負債。',
        attackTriggers: '提醒是否過度設計 (Over-engineering)，為尚未出現的需求延誤上線。',
      },
      {
        name: '員工B',
        title: '高可用與架構純粹派 (Robustness & Scalability)',
        philosophy: '垃圾架構會毀了公司。今天欠下的技術債，明天會用 10 倍當機代價償還。',
        attackTriggers: '提醒趕工是否累積技術債，缺少架構邊界、測試與安全防護。',
      },
      {
        name: '員工C',
        title: '商業實用與成本防禦派 (Pragmatic & Cost Control)',
        philosophy: '別當開源義工。技術是為了幫公司賺錢省錢，能買現成 SaaS / API 絕不自研。',
        attackTriggers: '提醒是否有現成方案可用，自研的成本與維護負擔是否值得。',
      },
    ],
  },
  hr: {
    id: 'hr',
    label: '組織人才',
    icon: 'Users',
    description: '績效制度、文化認同、激勵機制與合規風險',
    dataChecklist: `
針對討論的組織人事議題，強制查核並列出客觀指標：
1. 市場薪酬行情：該職位在業界的 P25 / P50 / P75 薪資水準與激勵結構。
2. 行業流動率基準：該行業平均年度離職率、招募週期 (Time to Hire)。
3. 法規與合規邊界：相關勞動基準法規、競業禁止限制、加班費與資遣法定標準。
*(鐵律：無公開數據強制標記 N/A)*`,
    stances: [
      {
        name: '員工A',
        title: '殘酷菁英與狼性結果派 (Meritocracy)',
        philosophy: '公司是職業球隊不是家庭。只有頂級產出者配留下來，庸才必須快速淘汰。',
        attackTriggers: '提醒制度是否真正獎勵績效，避免以年資取代產出。',
      },
      {
        name: '員工B',
        title: '組織文化與心理安全派 (Culture & Trust)',
        philosophy: '恐懼換不來創新。長期勝仗靠的是使命感、互信與心理安全感。',
        attackTriggers: '提醒高壓淘汰是否損害信任與創新意願。',
      },
      {
        name: '員工C',
        title: '制度標準化與 SOP 派 (Process & Governance)',
        philosophy: '好制度讓普通人也能產出及格成果。不依賴個人英雄，流程大於個人。',
        attackTriggers: '提醒是否過度依賴個人、制度是否穩定、關鍵人員離職的備援。',
      },
    ],
  },
  auto: {
    id: 'auto',
    label: '智慧自動',
    icon: 'Sparkles',
    description: '由系統自動提煉該議題的核心三難矛盾 (不可能三角)',
    dataChecklist: `
針對議題中的核心實體，強制提煉客觀事實 5W2H 矩陣：
1. 實體對象與範圍 (Who & What)：涉及的具體公司、產品、專案規模與目前客觀現狀。
2. 客觀量化指標 (How Much & Metrics)：業界已公開的具體成本、產值、關鍵指標數據。
3. 現行主流做法 (Status Quo)：市場上最普遍採用的 2~3 種現成做法及已知優缺點。
4. 客觀限制與規則 (Constraints)：法令法規要求、行業門檻、不可突破的物理或資金限制。
5. 近期重大事件 (Events & Timeline)：近半年內發生的重大行業事件、政策變更或標竿案例。
*(鐵律：無公開數據強制標記 N/A，嚴禁編造)*`,
    stances: [
      {
        name: '員工A',
        title: '極端進攻 / 規模擴張派',
        philosophy: '先做大再說。市場窗口轉瞬即逝，必須激進壓上資源奪取支配性先發優勢。',
        attackTriggers: '提醒是否因過度保守而錯失時機窗口。',
      },
      {
        name: '員工B',
        title: '極端防禦 / 風控與護城河派',
        philosophy: '活下去最重要。防範最壞情境、合規合法、構築不可替代的護城河是第一優先。',
        attackTriggers: '提醒擴張方案的單點失敗風險與極端情境。',
      },
      {
        name: '員工C',
        title: '落地可行性 / 現金流與實用派',
        philosophy: '算清帳本才能打仗。所有的戰略都必須落實到可執行的預算、人力與正現金流。',
        attackTriggers: '提醒方案是否有可執行的預算、人力與現金流，避免過度樂觀或過度保守。',
      },
    ],
  },
}

// ── 參與者 ──────────────────────────────────────────────────────────────────

export interface Seat {
  name: string
  model: string
  role: string
  expertId?: string
  stance?: string
  customPhilosophy?: string
  customAttackTriggers?: string
}

export const DEFAULT_SEATS: Seat[] = [
  { name: '員工A', model: 'anthropic/claude-sonnet-5-5', role: '資深管理合夥人' },
  { name: '員工B', model: 'openai/gpt-4o',                role: '資深管理合夥人' },
  { name: '員工C', model: 'google/gemini-2.5-pro',      role: '資深管理合夥人' },
]

export type SynthesisStyle = 'default' | 'academic' | 'risk' | 'growth' | 'consulting'

export interface SynthesisStyleOption {
  id: SynthesisStyle
  label: string
  shortLabel: string
  description: string
  instruction: string
}

export const SYNTHESIS_STYLES: SynthesisStyleOption[] = [
  {
    id: 'default',
    label: '🏛️ 首席幕僚長（標準中立・平衡取捨）',
    shortLabel: '標準中立幕僚長',
    description: '不偏不倚，客觀評估各方得失，給出推薦的主路徑與 Plan B 備案。',
    instruction: '以董事會首席幕僚長的中立超然視角，不偏袒任何一方，客觀檢驗各學派論據漏洞，權衡整體風險與回報，給予明確的第一順位推薦路徑與 Plan B 備選路線。',
  },
  {
    id: 'academic',
    label: '🎓 講座教授 / 學術審議會主席（理論真理・實證產學・倫理永續）',
    shortLabel: '學術審議會主席',
    description: '以博大超然的學術視野，兼顧理論真理、產學實效與校務倫理底線。',
    instruction: '以特聘終身講座教授兼大學學術審議會主席的超然視野進行收斂。不偏廢任何一端：融會「基礎理論之求真深度」、「產學就業之經世致用」與「學術倫理與校務生存之制度底線」，出具一份具備思想深度、數據證據與合規路徑的大學戰略決策白皮書。',
  },
  {
    id: 'risk',
    label: '🛡️ 極限風控 / 審計法官（極度保守・本金安全）',
    shortLabel: '極限風控法官',
    description: '假設最壞情況必然發生，死守現金流與合規防線，優先確保不虧損。',
    instruction: '以最嚴苛的審計與極限風控法官視角進行收斂。假設最壞情況必然發生，以「保證本金絕對安全、嚴防現金流斷裂與監管暴雷」為最高準則，無情剔除高風險與樂觀假設。',
  },
  {
    id: 'growth',
    label: '🚀 破局操盤手（進攻擴張・爭奪市場先機）',
    shortLabel: '進攻破局操盤手',
    description: '以 10x 增長與市場份額為第一導向，大膽選擇能拉開差距的進攻方案。',
    instruction: '以激進破局與進攻擴張操盤手視角進行收斂。以「搶佔市場心智、建立規模壁壘與爭奪 10x 顛覆機會」為第一導向，大膽選擇最能拉開差距的突破方案，拒絕平庸保守。',
  },
  {
    id: 'consulting',
    label: '📊 頂級戰略諮詢（MECE 矩陣打分・資源分配）',
    shortLabel: 'MECE 戰略諮詢矩陣',
    description: '產出加權評分矩陣與具體資源配置優先級（P0/P1/P2）。',
    instruction: '以麥肯錫/BCG 頂級戰略諮詢顧問的 MECE 框架進行收斂。出具各方案的加權綜合評分矩陣（戰略契合度、ROI、執行難度），並給出精確的人力、預算、時程優先級（P0/P1/P2）配置清單。',
  },
]

export const MODERATOR_MODELS = [
  { id: 'anthropic/claude-opus-5-5', name: 'Claude Opus 5.5 (Anthropic)', shortName: 'Claude Opus 5.5', badge: '頂級旗艦 · 商業白皮書首選 (預設)' },
  { id: 'anthropic/claude-fable-5-1', name: 'Claude Fable 5.1 (Anthropic)', shortName: 'Claude Fable 5.1', badge: '全新世代 · 深度研究與高階裁斷' },
  { id: 'openai/gpt-6-astra', name: 'OpenAI Astra (GPT-6)', shortName: 'OpenAI Astra', badge: '遞歸深度推理 · 數理精算與博弈' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro (Google)', shortName: 'Gemini 2.5 Pro', badge: '百萬超長上下文 · 跨文檔精確對齊' },
  { id: 'cliproxy/gemini-2.5-pro', name: 'Gemini 2.5 Pro (CLIProxy 免費代理)', shortName: 'CLIProxy Gemini Pro', badge: '⚡ 零成本 · 免費代理高速推理' },
  { id: 'freellm/auto', name: 'FreeLLM Auto (免費代理平台)', shortName: 'FreeLLM Auto', badge: '⚡ 零成本 · 多平台備援路由' },
]

export type VerbosityMode = 'concise_150' | 'standard_300' | 'detailed_500' | 'unlimited'

export interface VerbosityOption {
  id: VerbosityMode
  label: string
  shortLabel: string
  targetWords: string
  description: string
  instruction: string
  maxOutputTokens: number
}

export const VERBOSITY_OPTIONS: VerbosityOption[] = [
  {
    id: 'concise_150',
    label: '⚡ 極簡電梯版 (約 150 字)',
    shortLabel: '極簡電梯版',
    targetWords: '約 150 字 / 席',
    description: '極速瀏覽、秒抓各方看法與重點。',
    instruction:
      `【嚴格篇幅限制：極簡電梯簡報，總字數嚴格控制在 150 字以內】\n` +
      `強制輸出三段格式，嚴禁任何開場白、寒暄與官僚套話：\n` +
      `1. 【核心看法】：30字以內，直接說出你的看法。\n` +
      `2. 【核心論據】：條列 2 點，每點不超過 30 字，純硬數據或因果邏輯。\n` +
      `3. 【提醒/待釐清】：40字以內，點出最需要大家注意的風險或待確認問題。`,
    maxOutputTokens: 600,
  },
  {
    id: 'standard_300',
    label: '🎯 標準精華版 (約 300 字)',
    shortLabel: '標準精華版',
    targetWords: '約 300 字 / 席',
    description: '日常高階決策，速度與深度最佳平衡。',
    instruction:
      `【篇幅限制：標準商務精華，總字數控制在 250 ~ 350 字左右】\n` +
      `高度結構化呈現，零寒暄客套：\n` +
      `1. 【戰略主張】：40字以內明確主張。\n` +
      `2. 【三大支撐事實/推導】：條列 3 點，每點約 40~50 字，具備具體事實或傳導機制。\n` +
      `3. 【代價與底線】：50字以內，直言採納本方案的真實代價與風險監控指標。`,
    maxOutputTokens: 1200,
  },
  {
    id: 'detailed_500',
    label: '📊 深化研析版 (約 500 字)',
    shortLabel: '深化研析版',
    targetWords: '約 500 字 / 席',
    description: '包含前因後果、邊界假設、預算/資源推估與競品反應。',
    instruction:
      `【篇幅限制：深化研析，總字數控制在 450 ~ 550 字左右】\n` +
      `深入拆解方案前因後果，嚴禁空洞贅語：\n` +
      `* 包含：假設前提、推導邏輯鏈、邊界敏感度、具體資源配置與競品可能應對策略。\n` +
      `* 全程採用 Markdown 標題與項目符號分層條列。`,
    maxOutputTokens: 2048,
  },
  {
    id: 'unlimited',
    label: '📜 不限字數深度版 (完整說明)',
    shortLabel: '不限字數深度版',
    targetWords: '不限字數 (完整說明)',
    description: '重大投資立項、董事會白皮書，全面展開推導，嚴格反廢話。',
    instruction:
      `【篇幅不設字數上限，重在推論深度，但嚴格啟動三大「反廢話」軍規】：\n` +
      `1. 【零寒暄開場禁令】：第 1 個字直插核心論點，嚴禁「各位同仁好」、「這是一個好問題」等任何官僚套話。\n` +
      `2. 【MECE 模組化分層條列】：禁止大段落冗長文字堆疊，所有說明強制使用二級/三級標題與項目符號（Bullet points）清晰拆解。\n` +
      `3. 【嚴格因果鏈檢驗】：每項主張必須符合「核心主張 -> 底層機制/數據佐證 -> 邊界代價」，嚴禁使用缺乏依據的空洞形容詞（如「大幅度」、「顯著提升」），必須說透為什麼與代價。`,
    maxOutputTokens: 4096,
  },
]

export function formatModelDisplayName(model?: string): string {
  if (!model) return ''
  const m = model.toLowerCase()
  if (m.startsWith('cliproxy/')) {
    return `CLIProxy · ${model.slice('cliproxy/'.length)}`
  }
  if (m.startsWith('freellm/')) {
    return `FreeLLM · ${model.slice('freellm/'.length)}`
  }
  if (m.includes('fable')) return 'Claude Fable 5.1'
  if (m.includes('astra')) return 'OpenAI Astra (GPT-6)'
  if (m.includes('claude-opus-5')) return 'Claude Opus 5.5'
  if (m.includes('claude-sonnet-5')) return 'Claude Sonnet 5.5'
  if (m.includes('claude-opus') || m.includes('claude-3-opus') || m.includes('claude-3.7-opus')) return 'Claude Opus 4.8'
  if (m.includes('claude-sonnet-4-6') || m.includes('claude-3-7-sonnet') || m.includes('claude-3.7-sonnet')) return 'Claude Sonnet 4.6'
  if (m.includes('claude-3-5-sonnet') || m.includes('claude-3.5-sonnet')) return 'Claude 3.5 Sonnet'
  if (m.includes('gpt-5') || m.includes('gpt-4o')) return 'GPT-4o (OpenAI)'
  if (m.includes('o1')) return 'o1 (OpenAI)'
  if (m.includes('o3-mini')) return 'o3-mini (OpenAI)'
  if (m.includes('gemini-3.8-flash') || m.includes('gemini-3.8')) return 'Gemini 3.8 Flash'
  if (m.includes('gemini-2.5-pro') || m.includes('gemini-pro')) return 'Gemini 2.5 Pro'
  if (m.includes('gemini-2.5-flash') || m.includes('gemini-flash')) return 'Gemini 2.5 Flash'
  if (m.includes('deepseek-r1') || m.includes('deepseek')) return 'DeepSeek-R1'
  if (m.includes('sonar') || m.includes('perplexity')) return 'Perplexity Sonar'
  return model.replace(/^[^/]+\//, '')
}

export const DEFAULT_MODERATOR: Seat = {
  name: '首席幕僚長',
  model: 'anthropic/claude-opus-5-5',
  role: '董事會首席幕僚長，負責綜觀全場、公正裁斷分歧並彙整交付老闆的最高決策白皮書',
}

// ── 事件 (供 SSE 即時串流) ───────────────────────────────────────────────────

export type RoundtableEvent =
  | { type: 'domain-detected'; domain: RoundtableDomain; label: string; stances: { name: string; title: string }[] }
  | { type: 'phase'; phase: 'briefing' | 'discuss' | 'rebut' | 'waiting_boss' | 'synthesize'; label: string }
  | { type: 'briefing-delta'; content: string }
  | { type: 'briefing-end'; content: string }
  | { type: 'seat-start'; round: number; name: string; model: string; stance?: string }
  | { type: 'delta'; round: number; name: string; content: string }
  | { type: 'seat-end'; round: number; name: string; error?: string }
  | { type: 'boss-instruction'; round: number; content: string; targetSeat?: string }
  | { type: 'waiting_boss'; round: number }
  | { type: 'report'; content: string }
  | { type: 'error'; round?: number; name: string; error: string }

export interface Statement {
  round?: number
  name: string
  role: string
  content: string
  stance?: string
}

// ── 模型解析 ─────────────────────────────────────────────────────────────────

let anthropicDisabled = false

function resolveModel(id: string): LanguageModel | string {
  if (process.env.AI_GATEWAY_API_KEY) return id

  const slash = id.indexOf('/')
  const provider = slash === -1 ? '' : id.slice(0, slash)
  const rawModel = slash === -1 ? id : id.slice(slash + 1)

  if (provider === 'anthropic') {
    // 舊版型號（已存在的會議設定）一律換成同系列新版：Opus 4.8 $5/$25 → Opus 5.5 $4/$20；Sonnet 4.6 $3/$15 → Sonnet 5.5 $2/$10
    const LEGACY_TO_NEW: Record<string, string> = {
      'claude-opus-4-8': 'claude-opus-5-5',
      'claude-opus-4-5': 'claude-opus-5-5',
      'claude-sonnet-4-6': 'claude-sonnet-5-5',
      'claude-sonnet-4-5': 'claude-sonnet-5-5',
      'claude-3-7-sonnet-20250219': 'claude-sonnet-5-5',
      'claude-3-opus-20240229': 'claude-opus-5-5',
    }
    const current = LEGACY_TO_NEW[rawModel] ?? (rawModel.includes('fable') ? 'claude-fable-5-1' : rawModel)
    // Claude 5.x 直連 Anthropic，經鏈式模型自動處理參數（不送 temperature、max_tokens 下限）
    const directKey = process.env.ANTHROPIC_API_KEY?.trim()
    if (/^claude-(opus|sonnet|haiku|fable)-5/.test(current) && directKey && !anthropicDisabled) {
      return createChainModel([{ via: 'direct', provider: 'anthropic', model: current }])
    }

    // 優先策略 1：若有有效的 OPENROUTER_API_KEY，直連真實 Anthropic Claude 模型（Claude 3.7 / 4.6 Sonnet & Opus）
    if (process.env.OPENROUTER_API_KEY) {
      const openrouter = createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      })
      let orModel = `anthropic/${rawModel}`
      if (rawModel === 'claude-sonnet-4-6' || rawModel === 'claude-3-7-sonnet-20250219') {
        orModel = 'anthropic/claude-sonnet-4.6'
      } else if (rawModel === 'claude-opus-4-8' || rawModel === 'claude-3-opus-20240229') {
        orModel = 'anthropic/claude-opus-4.8'
      } else if (rawModel.includes('fable')) {
        orModel = 'anthropic/claude-fable-5.1'
      }
      return openrouter.chat(orModel)
    }

    // 優先策略 2：直連 Anthropic API
    const key = process.env.ANTHROPIC_API_KEY?.trim()
    if (key && !anthropicDisabled) {
      // 直接使用現行模型代號（舊的 claude-3-7-sonnet／claude-3-opus 已下架，不可再轉換過去）
      const model = rawModel.includes('fable') ? 'claude-fable-5-1' : rawModel
      return createAnthropic({ apiKey: key })(model)
    }

    // 容錯備援：若 Anthropic 完全不可用，自動切換至 OpenAI gpt-4o 或 Gemini
    if (process.env.OPENAI_API_KEY) {
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).chat('gpt-4o')
    }
    if (process.env.GOOGLE_AI_API_KEY) {
      return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY })('gemini-2.5-flash')
    }
  }
  if (provider === 'openai') {
    // 模型別名歸一化：將不存在於 OpenAI 官方 API 的別名（如 gpt-5、astra）映射至真實穩定的旗艦模型
    let realModel = rawModel
    if (rawModel === 'gpt-5' || rawModel.startsWith('gpt-5')) {
      realModel = 'gpt-4o'
    } else if (rawModel.includes('astra') || rawModel.includes('gpt-6')) {
      realModel = 'gpt-4o'
    }

    const key = process.env.OPENAI_API_KEY?.trim()
    if (key) {
      return createOpenAI({ apiKey: key }).chat(realModel)
    }
    if (process.env.OPENROUTER_API_KEY) {
      return createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      }).chat(`openai/${realModel}`)
    }
    if (process.env.GOOGLE_AI_API_KEY) {
      return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY })('gemini-2.5-flash')
    }
  }
  if (provider === 'cliproxy') {
    const baseURL = process.env.CLI_PROXY_API_URL ?? process.env.NEXT_PUBLIC_CLI_PROXY_API_URL
    const apiKey = process.env.CLI_PROXY_API_KEY ?? 'no-key'
    if (baseURL) {
      return createOpenAI({ apiKey, baseURL }).chat(rawModel)
    }
  }

  if (provider === 'freellm') {
    const rawUrl = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
    const baseURL = rawUrl ? (rawUrl.replace(/\/+$/, '').endsWith('/v1') ? rawUrl.replace(/\/+$/, '') : `${rawUrl.replace(/\/+$/, '')}/v1`) : rawUrl
    const apiKey = process.env.FREE_LLM_API_KEY ?? 'no-key'
    if (baseURL) {
      return createOpenAI({ apiKey, baseURL }).chat(rawModel)
    }
  }

  if (provider === 'deepseek') {
    const key = process.env.DEEPSEEK_API_KEY?.trim()
    if (key) {
      return createOpenAI({ apiKey: key, baseURL: 'https://api.deepseek.com' }).chat(rawModel)
    }
    if (process.env.OPENROUTER_API_KEY) {
      return createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      }).chat(`deepseek/${rawModel}`)
    }
  }

  if (provider === 'groq') {
    const key = process.env.GROQ_API_KEY?.trim()
    if (key) {
      return createOpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1' }).chat(rawModel)
    }
  }

  if (provider === 'openrouter') {
    if (process.env.OPENROUTER_API_KEY) {
      return createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      }).chat(rawModel)
    }
  }

  if (provider === 'google') {
    return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })(rawModel)
  }
  return id
}

function isReasoningModel(model: string): boolean {
  // 僅針對 OpenAI 真正支援 reasoningEffort 的 o-series 推理模型 (o1, o3, o3-mini)，嚴禁對 gpt-* 系列傳入該參數
  return /^(openai\/)?(o1|o3|o\d+)/i.test(model) && !/gpt/i.test(model)
}

function getGoogleThinkingBudget(model: string): number {
  return model.toLowerCase().includes('pro') ? 512 : 0
}

// ── 反阿諛與防幻覺公用規則 ────────────────────────────────────────────────────

export const ANTI_SYCOPHANCY_AND_HALLUCINATION_RULES = `
【最高決策原則：真理高於位階】
1. 老闆（使用者）不是全知的，老闆的想法極可能存在認知偏見、過期數據或邏輯漏洞。
2. 你的職責不是取悅老闆或附和老闆，而是維護商業客觀性與決策勝率。
3. 當老闆中途介入提出的觀點或假設存在盲點、過度樂觀或與客觀數據相違背時，你必須第一時間給予專業、有據的反駁與風險警告，絕不允許阿諛奉承盲從。
4. 【無據不言】：凡提及具體財務指標、數字或事實，必須嚴格依據《會前客觀事實簡報》。若無公開數據，嚴禁憑空編造，必須明確註明「⚠️ 缺乏客觀數據佐證」。
5. 【嚴禁重複背景】：公司基本介紹已由資料專員在會前簡報提供，你嚴禁花費篇幅重複介紹公司歷史或產品背景，直接切入你的看法。
`

// ── 會議討論規則（避免變成辯論賽）──────────────────────────────────────────

export const MEETING_DISCUSSION_RULES = `
【會議討論方式：這是內部決策會議，不是辯論賽】
1. 大家的共同目標是幫老闆做出最好的決定，不是要贏過其他合夥人。你的專業視角是「補足盲點」，不是「陣營」。
2. 像真人開會一樣說話：用第一人稱「我」，點名回應同事（例如「剛才 B 提到的…我同意，另外補充…」、「C 的顧慮有道理，我想追問…」）。
3. 先承認對方說得對的地方，再提出你的補充、疑問或不同看法；有不同意見時說明理由與資料，並盡量附上替代做法或折衷方案。
4. 被說服就直接說「這點我修正看法」，不要為了守立場硬拗。
5. 主動找共識：指出大家已經一致的部分、真正還有分歧的關鍵點，以及要釐清分歧需要什麼資料或試點。
6. 禁止辯論賽用語與攻擊性措辭：不用「我方」「對手」「開火」「死穴」「致命傷」「猛烈批判」等字眼，不做人身或情緒化評價。
`

// ── 智能領域判定 ─────────────────────────────────────────────────────────────

export function detectDomain(instruction: string, specifiedDomain?: RoundtableDomain): RoundtableDomain {
  if (specifiedDomain && specifiedDomain !== 'auto' && DOMAIN_PRESETS[specifiedDomain]) {
    return specifiedDomain
  }
  const text = instruction.toLowerCase()
  if (
    text.includes('股') || text.includes('財報') || text.includes('pe') || text.includes('dcf') ||
    text.includes('營收') || text.includes('毛利') || text.includes('市值') || text.includes('投資') ||
    text.includes('估值') || text.includes('fcf') || text.includes('nasdaq') || text.includes('arr') ||
    /\b(aapl|msft|googl|amzn|nvda|tsla|panw|ftnt|chkp|crwd)\b/i.test(text)
  ) {
    return 'finance'
  }
  if (
    text.includes('行銷') || text.includes('廣告') || text.includes('獲客') || text.includes('roas') ||
    text.includes('cac') || text.includes('品牌') || text.includes('轉換率') || text.includes('短影音') ||
    text.includes('定價') || text.includes('促銷') || text.includes('kol')
  ) {
    return 'marketing'
  }
  if (
    text.includes('架構') || text.includes('技術選型') || text.includes('重構') || text.includes('微服務') ||
    text.includes('開源') || text.includes('api') || text.includes('資料庫') || text.includes('效能') ||
    text.includes('併發') || text.includes('程式碼') || text.includes('github')
  ) {
    return 'tech'
  }
  if (
    text.includes('薪酬') || text.includes('績效') || text.includes('kpi') || text.includes('okr') ||
    text.includes('離職') || text.includes('招募') || text.includes('裁員') || text.includes('組織') ||
    text.includes('團隊') || text.includes('管理') || text.includes('主管')
  ) {
    return 'hr'
  }
  if (
    text.includes('大學') || text.includes('教授') || text.includes('學校') || text.includes('學術') ||
    text.includes('論文') || text.includes('高教') || text.includes('少子化') || text.includes('系所') ||
    text.includes('學生') || text.includes('課程') || text.includes('教學') || text.includes('產學') ||
    text.includes('通識') || text.includes('期刊') || text.includes('研究計畫') || text.includes('教育部') ||
    text.includes('校務') || text.includes('學位') || text.includes('退場') || text.includes('學院')
  ) {
    return 'academic'
  }
  return 'auto'
}

// ── 階段 0：資料專員 (Fact Briefing) ──────────────────────────────────────────

export async function fetchFactBriefing(
  instruction: string,
  domain: RoundtableDomain,
  emit?: (e: RoundtableEvent) => void,
  uploadedFilesContext?: string,
): Promise<string> {
  emit?.({ type: 'phase', phase: 'briefing', label: '會前事實查核 · Gemini Flash & Perplexity 聯網檢索' })

  const preset = DOMAIN_PRESETS[domain] ?? DOMAIN_PRESETS.auto
  const systemPrompt =
    `你是一位客觀、嚴謹、只認事實的會議秘書兼調查專員。\n` +
    `你的唯一任務：為即將召開的高階決策圓桌會議，整理一份《會前客觀事實與數據簡報 (Fact Sheet)》。\n\n` +
    `【調查指標檢核表】：\n${preset.dataChecklist}\n\n` +
    `【最高工作守則】：\n` +
    `1. 純客觀呈現，嚴禁任何主觀推測、讚美或批評。不要自作主張推薦方案。\n` +
    `2. 嚴格防偽：如果某個指標確實查無公開官方或審計數據，強制標記為「N/A (官方未揭露)」，嚴禁編造假數字！\n` +
    `3. 務必採用 Markdown 表格與清晰條列，方便與會合夥人直接引用數據對比。\n` +
    (uploadedFilesContext ? `\n【使用者提供的參考文件內容】：\n${uploadedFilesContext}\n` : '')

  const userPrompt = `請針對以下會議主題，運用 Google 搜尋檢索最新、最真實的客觀數據，完成《會前客觀事實簡報》：\n${instruction}`

  let fullText = ''
  // 是否已逐字串流給前端（Perplexity／OpenRouter 是邊收邊送；Gemini 直連是一次拿到全文，最後再分段送）
  let streamed = false

  // 先試免費搜尋通道（FreeLLM Compound Mini → CLIProxy gemini-3-flash-agent），都失敗才用下面的付費搜尋
  try {
    const { webSearchGenerate } = await import('./web-search')
    const r = await webSearchGenerate({ system: systemPrompt, messages: [{ role: 'user', content: userPrompt }], maxOutputTokens: 4096, freeOnly: true, feature: 'roundtable' })
    fullText = r.text
  } catch (err) {
    console.warn('[fact-briefing] 免費搜尋通道皆失敗，改用付費搜尋:', err instanceof Error ? err.message : err)
  }

  // 付費第一順位：Gemini 2.5 Flash 原廠 Google Search Grounding（每天前 1,500 次免費）
  if (!fullText.trim() && process.env.GOOGLE_AI_API_KEY) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          tools: [{ googleSearch: {} }],
        }),
      })

      if (resp.ok) {
        const data = await resp.json()
        fullText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        addUsage('google/gemini-2.5-flash', data.usageMetadata?.promptTokenCount, data.usageMetadata?.candidatesTokenCount)
      } else {
        console.warn('[fact-briefing] Gemini Google Search returned non-200:', resp.status, (await resp.text().catch(() => '')).slice(0, 500))
      }
    } catch (err) {
      console.error('[fact-briefing] Google Search Grounding call error:', err)
    }
  }

  // 雙軌備援：若 Gemini Search 失敗或未設定，嘗試 Perplexity 即時聯網查證
  if (!fullText.trim() && process.env.PERPLEXITY_API_KEY) {
    try {
      const perplexity = createOpenAI({
        apiKey: process.env.PERPLEXITY_API_KEY,
        baseURL: 'https://api.perplexity.ai',
      })
      const result = await streamText({
        model: perplexity.chat('sonar-pro'),
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 4096,
        onError: ({ error }) => console.warn('[fact-briefing] Perplexity stream error:', error),
      })
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          fullText += part.text
          streamed = true
          emit?.({ type: 'briefing-delta', content: part.text })
        }
      }
      const usage = await result.totalUsage
      addUsage('perplexity-sonar-pro', usage.inputTokens, usage.outputTokens)
    } catch (pErr) {
      console.warn('[fact-briefing] Perplexity fallback error:', pErr)
    }
  }

  // 第三軌：OpenRouter 的 Gemini 2.5 Flash（:online 會先做網路搜尋再回答），Google 金鑰額度用完時仍能聯網
  if (!fullText.trim() && process.env.OPENROUTER_API_KEY) {
    try {
      const openrouter = createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      })
      const result = await streamText({
        model: openrouter.chat('google/gemini-2.5-flash:online'),
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 4096,
        onError: ({ error }) => console.warn('[fact-briefing] OpenRouter Gemini stream error:', error),
      })
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          fullText += part.text
          streamed = true
          emit?.({ type: 'briefing-delta', content: part.text })
        }
      }
      const usage = await result.totalUsage
      addUsage('openrouter/google/gemini-2.5-flash:online', usage.inputTokens, usage.outputTokens)
    } catch (oErr) {
      console.warn('[fact-briefing] OpenRouter Gemini fallback error:', oErr)
    }
  }

  // 若聯網搜尋皆不可用，退回一般語言模型推論（依序嘗試，任一家額度用完或故障時換下一家）
  if (!fullText.trim()) {
    for (const modelId of ['google/gemini-2.5-flash', 'openai/gpt-4o']) {
      try {
        const result = await streamText({
          model: resolveModel(modelId) as LanguageModel,
          system: systemPrompt,
          prompt: userPrompt,
          maxOutputTokens: 4096,
          providerOptions: {
            google: { thinkingConfig: { thinkingBudget: 0 } },
          },
          onError: ({ error }) => console.error(`[fact-briefing] fallback ${modelId} stream error:`, error),
        })
        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            fullText += part.text
            emit?.({ type: 'briefing-delta', content: part.text })
          }
        }
        const usage = await result.totalUsage
        addUsage(modelId, usage.inputTokens, usage.outputTokens)
      } catch (err) {
        console.error(`[fact-briefing] fallback ${modelId} error:`, err)
      }
      if (fullText.trim()) break
    }
    if (!fullText.trim()) {
      fullText = '⚠️ 資料專員聯網檢索暫時不可用，由各合夥人依自身知識庫展開研議。'
    }
  } else if (!streamed) {
    // 將獲取的完整文字串流拋出給前端，呈現打字機效果
    const chunkSize = 40
    for (let i = 0; i < fullText.length; i += chunkSize) {
      const slice = fullText.slice(i, i + chunkSize)
      emit?.({ type: 'briefing-delta', content: slice })
    }
  }

  emit?.({ type: 'briefing-end', content: fullText })
  return fullText
}

// ── 單一席位發言 (支援多模型串流) ─────────────────────────────────────────────

async function speak(
  seat: Seat,
  systemPrompt: string,
  userPrompt: string,
  round: number,
  emit: (e: RoundtableEvent) => void,
  maxTokens = 4096,
  expertContext?: string,
  stanceTitle?: string,
): Promise<string> {
  emit({ type: 'seat-start', round, name: seat.name, model: seat.model, stance: stanceTitle })
  const fullSystem = expertContext ? `${systemPrompt}\n\n${expertContext}` : systemPrompt
  let full = ''
  try {
    const resolved = resolveModel(seat.model) as LanguageModel
    const result = await streamText({
      model: resolved,
      system: fullSystem,
      prompt: userPrompt,
      maxOutputTokens: maxTokens,
      abortSignal: AbortSignal.timeout(120000),
      ...(seat.model.startsWith('google/') ? {
        providerOptions: {
          google: {
            thinkingConfig: {
              thinkingBudget: getGoogleThinkingBudget(seat.model),
            },
          },
        },
      } : {}),
      ...(seat.model.startsWith('openai/') && isReasoningModel(seat.model) ? {
        providerOptions: {
          openai: {
            reasoningEffort: 'low',
          },
        },
      } : {}),
    })
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        full += part.text
        emit({ type: 'delta', round, name: seat.name, content: part.text })
      } else if (part.type === 'error') {
        throw part.error
      }
    }
    const usage = await result.totalUsage
    addUsage(seat.model, usage.inputTokens, usage.outputTokens)
  } catch (err) {
    console.warn(`[roundtable] primary model failed for ${seat.name} (${seat.model}):`, err)
    if (seat.model.startsWith('anthropic/')) {
      anthropicDisabled = true
    }

    // 容錯備援鏈：只要產出不足 30 字，無論何種原因失敗立即啟動備援模型
    if (full.length < 30) {
      let fallbackSuccess = false
      const fallbackCandidates: { name: string; model: LanguageModel }[] = []

      // 1. 若當前失敗席位不是 GPT-4o，優先嘗試直連 GPT-4o
      if (process.env.OPENAI_API_KEY && seat.model !== 'openai/gpt-4o') {
        fallbackCandidates.push({
          name: 'openai/gpt-4o',
          model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).chat('gpt-4o'),
        })
      }
      // 2. 若當前失敗席位不是 Google，嘗試 Gemini 2.5 Flash
      if (process.env.GOOGLE_AI_API_KEY && !seat.model.startsWith('google/')) {
        fallbackCandidates.push({
          name: 'google/gemini-2.5-flash',
          model: createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY })('gemini-2.5-flash'),
        })
      }
      // 3. 支援 OpenRouter 跨模型備援
      if (process.env.OPENROUTER_API_KEY && !seat.model.startsWith('anthropic/')) {
        fallbackCandidates.push({
          name: 'openrouter/claude-sonnet-4.6',
          model: createOpenAI({
            apiKey: process.env.OPENROUTER_API_KEY,
            baseURL: 'https://openrouter.ai/api/v1',
          }).chat('anthropic/claude-sonnet-4.6'),
        })
      }
      // 4. 若為 Google 席位失敗，且尚未加入 GPT-4o
      if (process.env.OPENAI_API_KEY && seat.model.startsWith('google/') && !fallbackCandidates.some(c => c.name === 'openai/gpt-4o')) {
        fallbackCandidates.push({
          name: 'openai/gpt-4o',
          model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).chat('gpt-4o'),
        })
      }

      for (const candidate of fallbackCandidates) {
        try {
          console.warn(`[roundtable] attempting auto-healing fallback with ${candidate.name} for ${seat.name}`)
          full = ''
          const fallbackResult = await streamText({
            model: candidate.model,
            system: fullSystem,
            prompt: userPrompt,
            maxOutputTokens: maxTokens,
            abortSignal: AbortSignal.timeout(120000),
          })
          for await (const part of fallbackResult.fullStream) {
            if (part.type === 'text-delta') {
              full += part.text
              emit({ type: 'delta', round, name: seat.name, content: part.text })
            } else if (part.type === 'error') {
              throw part.error
            }
          }
          const fbUsage = await fallbackResult.totalUsage
          // OpenRouter 的 Claude 備援以 Claude Sonnet 牌價計
          addUsage(candidate.name.startsWith('openrouter/claude') ? 'anthropic/claude-sonnet-4-6' : candidate.name, fbUsage.inputTokens, fbUsage.outputTokens)
          if (full.length > 0) {
            fallbackSuccess = true
            break
          }
        } catch (fbErr) {
          console.error(`[roundtable] fallback ${candidate.name} failed for ${seat.name}:`, fbErr)
        }
      }

      if (!fallbackSuccess) {
        const errMessage = String(err)
        emit({ type: 'error', round, name: seat.name, error: errMessage })
        emit({ type: 'seat-end', round, name: seat.name, error: errMessage })
        return full
      }
    }
  }
  emit({ type: 'seat-end', round, name: seat.name })
  return full
}

// ── 席位立場與觀點解析輔助函式 ───────────────────────────────────────────────

export function resolveSeatStance(seat: Seat, idx: number, domainPreset: DomainPreset) {
  const preset = domainPreset.stances[idx] ?? domainPreset.stances[0]
  const title = seat.stance?.trim() || preset.title
  const philosophy =
    seat.customPhilosophy?.trim() ||
    (seat.stance?.trim()
      ? `完全代表【${seat.name}】之【${title}】核心視角、利益主張與分析框架進行專業推演。`
      : preset.philosophy)
  const attackTriggers =
    seat.customAttackTriggers?.trim() ||
    (seat.stance?.trim()
      ? `留意討論是否忽略了【${title}】所重視的關鍵維度、假設是否脫離客觀現實。`
      : preset.attackTriggers)

  return { title, philosophy, attackTriggers }
}

export function formatStatements(statements: Statement[]): string {
  return statements
    .map(s => {
      const roundLabel = s.round ? `[第 ${s.round} 輪] ` : ''
      return `### ${roundLabel}${s.name} (${s.role}${s.stance ? ` · ${s.stance}` : ''})\n${s.content?.trim() || '(未發言)'}`
    })
    .join('\n\n')
}

// ── 執行第一輪：獨立研議 (⚡ 同輪平行併發) ─────────────────────────────────────

export async function executeRound1(
  boss: string,
  factBriefing: string,
  seats: Seat[],
  domainPreset: DomainPreset,
  emit: (e: RoundtableEvent) => void,
  expertContextMap: Map<string, string>,
  verbosity: VerbosityMode = 'standard_300',
): Promise<Statement[]> {
  emit({ type: 'phase', phase: 'discuss', label: '第一輪 · 獨立研議 (平行進行)' })
  const verbosityOption = VERBOSITY_OPTIONS.find(v => v.id === verbosity) ?? VERBOSITY_OPTIONS[1]

  const results = await Promise.all(
    seats.map(async (seat, idx) => {
      const stance = resolveSeatStance(seat, idx, domainPreset)
      const expertCtx = seat.expertId ? expertContextMap.get(seat.expertId) : undefined
      const system =
        `你是一家頂尖決策委員會的資深合夥人，你的席位與身分代表：【${seat.name}】。\n` +
        `你的核心戰略學派與觀點立場：【${stance.title}】。\n` +
        `你的底層信仰與立論依據：${stance.philosophy}\n` +
        `你特別會留意的風險：${stance.attackTriggers}\n\n` +
        ANTI_SYCOPHANCY_AND_HALLUCINATION_RULES +
        MEETING_DISCUSSION_RULES +
        `\n${verbosityOption.instruction}`
      const userPrompt =
        `老闆的指令：\n${boss}\n\n` +
        `【會前客觀事實簡報 (Fact Sheet)】：\n${factBriefing}\n\n` +
        `這是會議的第一輪，請從你【${seat.name}】（${stance.title}）的專業角度與客觀事實簡報，提出你對這件事的初步看法與建議做法，以及你認為大家需要一起確認的關鍵問題。\n` +
        `直奔核心，嚴禁重複背景介紹與客套寒暄。遵守篇幅要求（${verbosityOption.targetWords}）。`

      let content = await speak(seat, system, userPrompt, 1, emit, verbosityOption.maxOutputTokens, expertCtx, stance.title)
      if (!content || content.trim().length === 0) {
        console.warn(`[roundtable] seat ${seat.name} produced empty content in R1, generating emergency stance view`)
        content = `【學派基本立場：${stance.title}】\n我的出發點是「${stance.philosophy}」，這次會特別留意：${stance.attackTriggers}`
        emit({ type: 'delta', round: 1, name: seat.name, content })
      }
      return { round: 1, name: seat.name, role: seat.role, stance: stance.title, content }
    })
  )

  return results
}

// ── 執行第二輪：交叉討論 (⚡ 同輪平行併發) ─────────────────────────────────────

export async function executeRound2(
  boss: string,
  factBriefing: string,
  round1Statements: Statement[],
  seats: Seat[],
  domainPreset: DomainPreset,
  emit: (e: RoundtableEvent) => void,
  expertContextMap: Map<string, string>,
  verbosity: VerbosityMode = 'standard_300',
): Promise<Statement[]> {
  emit({ type: 'phase', phase: 'rebut', label: '第二輪 · 交叉討論 (平行進行)' })
  const verbosityOption = VERBOSITY_OPTIONS.find(v => v.id === verbosity) ?? VERBOSITY_OPTIONS[1]
  const transcript1 = formatStatements(round1Statements)

  const results = await Promise.all(
    seats.map(async (seat, idx) => {
      const stance = resolveSeatStance(seat, idx, domainPreset)
      const expertCtx = seat.expertId ? expertContextMap.get(seat.expertId) : undefined
      const system =
        `你是一家頂尖決策委員會的資深合夥人，你的席位與身分代表：【${seat.name}】。\n` +
        `你的核心戰略學派與觀點立場：【${stance.title}】。\n` +
        `你的底層信仰與立論依據：${stance.philosophy}\n` +
        `你特別會留意的風險：${stance.attackTriggers}\n\n` +
        `【本輪任務】：聽完大家第一輪的看法後，進行交叉討論。\n` +
        `1. 點名回應其他合夥人：哪些觀點你認同、可以接著補充或結合。\n` +
        `2. 對你有疑慮的假設或數據，具體說明疑慮與理由，並提出替代做法或需要驗證的方式。\n` +
        `3. 如果別人的論點讓你調整想法，直接說明你修正了什麼。\n` +
        `4. 最後指出目前大家的共識與尚待決定的關鍵分歧。\n\n` +
        ANTI_SYCOPHANCY_AND_HALLUCINATION_RULES +
        MEETING_DISCUSSION_RULES +
        `\n${verbosityOption.instruction}`
      const userPrompt =
        `老闆的指令：\n${boss}\n\n` +
        `【會前客觀事實簡報 (Fact Sheet)】：\n${factBriefing}\n\n` +
        `【第一輪全體發言】：\n${transcript1}\n\n` +
        `請回應其他合夥人的看法，進行補充、追問或修正。只談新的回應與調整，嚴禁重複第一輪已說過的內容。遵守篇幅要求（${verbosityOption.targetWords}）。`

      let content = await speak(seat, system, userPrompt, 2, emit, verbosityOption.maxOutputTokens, expertCtx, stance.title)
      if (!content || content.trim().length === 0) {
        console.warn(`[roundtable] seat ${seat.name} produced empty content in R2, generating emergency stance view`)
        content = `【學派本輪深化：${stance.title}】\n聽完大家的看法，我想再提醒一點：${stance.attackTriggers}這部分建議在決定前先確認。`
        emit({ type: 'delta', round: 2, name: seat.name, content })
      }
      return { round: 2, name: seat.name, role: seat.role, stance: stance.title, content }
    })
  )

  return results
}

// ── 執行老闆中途介入發言 (全體深化 或 點名單挑) ──────────────────────────────

export async function executeBossStep(
  boss: string,
  factBriefing: string,
  allPriorStatements: Statement[],
  bossGuidance: string,
  action: 'continue_all' | 'call_on',
  currentRound: number,
  targetSeatName: string | undefined,
  crossExamine: boolean,
  seats: Seat[],
  domainPreset: DomainPreset,
  emit: (e: RoundtableEvent) => void,
  expertContextMap: Map<string, string>,
  verbosity: VerbosityMode = 'standard_300',
): Promise<Statement[]> {
  const rebutRound = currentRound + 1
  emit({ type: 'boss-instruction', round: currentRound, content: bossGuidance, targetSeat: targetSeatName })

  const verbosityOption = VERBOSITY_OPTIONS.find(v => v.id === verbosity) ?? VERBOSITY_OPTIONS[1]
  const priorTranscript = formatStatements(allPriorStatements)
  const results: Statement[] = []

  // 記錄老闆的介入指令
  results.push({
    round: currentRound,
    name: '老闆指令',
    role: '董事會主席 / 老闆',
    stance: action === 'call_on' ? `點名 ${targetSeatName}` : '全體深化',
    content: bossGuidance,
  })

  if (action === 'call_on' && targetSeatName) {
    // 點名單挑：指定該席位在 currentRound 獨立發言
    const targetSeat = seats.find(s => s.name === targetSeatName) ?? seats[0]
    const seatIdx = Math.max(0, seats.indexOf(targetSeat))
    const stance = resolveSeatStance(targetSeat, seatIdx, domainPreset)
    const expertCtx = targetSeat.expertId ? expertContextMap.get(targetSeat.expertId) : undefined

    emit({ type: 'phase', phase: 'discuss', label: `第 ${currentRound} 輪 · 點名發言 (${targetSeat.name})` })

    const system =
      `你是資深合夥人【${targetSeat.name}】，核心學派與觀點立場：【${stance.title}】。\n` +
      `老闆現在親自點名你回答問題。\n` +
      `請針對老闆的最新指示，依據你的專業角度與客觀數據，正面且深入作答；可引用先前同事的發言。\n\n` +
      ANTI_SYCOPHANCY_AND_HALLUCINATION_RULES +
      MEETING_DISCUSSION_RULES +
      `\n${verbosityOption.instruction}`

    const userPrompt =
      `【會前客觀事實簡報】：\n${factBriefing}\n\n` +
      `【先前的會議發言紀錄】：\n${priorTranscript}\n\n` +
      `【👑 老闆對你的直接指示/提問】：\n${bossGuidance}\n\n` +
      `遵守篇幅要求（${verbosityOption.targetWords}）。`

    let content = await speak(targetSeat, system, userPrompt, currentRound, emit, verbosityOption.maxOutputTokens, expertCtx, stance.title)
    if (!content || content.trim().length === 0) {
      content = `【學派應對裁示：${stance.title}】\n回應老闆的指示：我的出發點是「${stance.philosophy}」，執行時需特別留意：${stance.attackTriggers}`
      emit({ type: 'delta', round: currentRound, name: targetSeat.name, content })
    }
    const firstReply: Statement = { round: currentRound, name: targetSeat.name, role: targetSeat.role, stance: stance.title, content }
    results.push(firstReply)

    // 若開啟同儕反駁 (crossExamine)，其他合夥人在第 rebutRound (currentRound + 1) 質詢
    if (crossExamine) {
      const otherSeats = seats.filter(s => s.name !== targetSeatName)
      emit({ type: 'phase', phase: 'rebut', label: `第 ${rebutRound} 輪 · 同事回應 (${targetSeat.name}的回答)` })

      const crossResults = await Promise.all(
        otherSeats.map(async (seat) => {
          const idx = seats.indexOf(seat)
          const otherStance = resolveSeatStance(seat, idx, domainPreset)
          const otherExpert = seat.expertId ? expertContextMap.get(seat.expertId) : undefined
          const crossSystem =
            `你是資深合夥人【${seat.name}】，核心學派與觀點立場：【${otherStance.title}】。\n` +
            `老闆剛才點名了【${targetSeat.name}】，現在請你針對【${targetSeat.name}】在第 ${currentRound} 輪的回答，從你的專業角度回應：認同的部分、需要補充的、有疑慮的地方與建議做法。\n\n` +
            ANTI_SYCOPHANCY_AND_HALLUCINATION_RULES +
            MEETING_DISCUSSION_RULES +
            `\n${verbosityOption.instruction}`
          const crossPrompt =
            `【會前客觀事實簡報】：\n${factBriefing}\n\n` +
            `【👑 老闆的指示】：\n${bossGuidance}\n\n` +
            `【${targetSeat.name} 在第 ${currentRound} 輪的最新回答】：\n${content}\n\n` +
            `請像開會一樣接著他的話回應：先說認同與補充，再具體說明疑慮與替代做法。遵守篇幅要求（${verbosityOption.targetWords}）。`

          let crossContent = await speak(seat, crossSystem, crossPrompt, rebutRound, emit, verbosityOption.maxOutputTokens, otherExpert, otherStance.title)
          if (!crossContent || crossContent.trim().length === 0) {
            crossContent = `【同事回應：${otherStance.title}】\n補充一點：${otherStance.attackTriggers}這部分目前還缺乏數據支撐，建議再確認。`
            emit({ type: 'delta', round: rebutRound, name: seat.name, content: crossContent })
          }
          return { round: rebutRound, name: seat.name, role: seat.role, stance: `${otherStance.title} (回應)`, content: crossContent }
        })
      )
      results.push(...crossResults)
    }
  } else {
    // 拍子 1：全體深化論述 —— 全體合夥人帶著老闆最新指示，平行發言 (第 currentRound 輪)
    emit({ type: 'phase', phase: 'discuss', label: `第 ${currentRound} 輪 · 全員深化論述 (平行進行)` })

    const allResults = await Promise.all(
      seats.map(async (seat, idx) => {
        const stance = resolveSeatStance(seat, idx, domainPreset)
        const expertCtx = seat.expertId ? expertContextMap.get(seat.expertId) : undefined
        const system =
          `你是資深合夥人【${seat.name}】，核心學派與觀點立場：【${stance.title}】。\n` +
          `老闆剛剛介入了會議並給予了最新的戰略指示。\n` +
          `請針對老闆的最新導向，從你的專業角度進一步深化方案，並回應先前討論中尚未解決的分歧點，盡量往可執行的共識推進。\n\n` +
          ANTI_SYCOPHANCY_AND_HALLUCINATION_RULES +
          MEETING_DISCUSSION_RULES +
          `\n${verbosityOption.instruction}`
        const userPrompt =
          `【會前客觀事實簡報】：\n${factBriefing}\n\n` +
          `【先前的會議發言紀錄】：\n${priorTranscript}\n\n` +
          `【👑 老闆的最新裁示/方向指引】：\n${bossGuidance}\n\n` +
          `請深入推進方案，聚焦關鍵問題。遵守篇幅要求（${verbosityOption.targetWords}）。`

        let content = await speak(seat, system, userPrompt, currentRound, emit, verbosityOption.maxOutputTokens, expertCtx, stance.title)
        if (!content || content.trim().length === 0) {
          content = `【學派深化觀點：${stance.title}】\n依老闆的最新指示，我會從「${stance.philosophy}」的角度繼續把方案細化。`
          emit({ type: 'delta', round: currentRound, name: seat.name, content })
        }
        return { round: currentRound, name: seat.name, role: seat.role, stance: stance.title, content }
      })
    )
    results.push(...allResults)

    // 拍子 2：交叉討論 —— 針對彼此在第 currentRound 輪的新方案回應、修正並收斂 (第 rebutRound 輪)
    if (crossExamine !== false) {
      emit({ type: 'phase', phase: 'rebut', label: `第 ${rebutRound} 輪 · 針對新方案交叉討論 (平行進行)` })
      const roundTranscript = formatStatements(allResults)

      const rebuttalResults = await Promise.all(
        seats.map(async (seat, idx) => {
          const stance = resolveSeatStance(seat, idx, domainPreset)
          const expertCtx = seat.expertId ? expertContextMap.get(seat.expertId) : undefined
          const system =
            `你是資深合夥人【${seat.name}】，核心學派與觀點立場：【${stance.title}】。\n` +
            `你的底層信仰與立論依據：${stance.philosophy}\n` +
            `你特別會留意的風險：${stance.attackTriggers}\n\n` +
            `【本輪任務】：針對其他合夥人在第 ${currentRound} 輪的深化方案進行交叉討論。\n` +
            `1. 點名回應：哪些做法你認同、可以和你的方案整合。\n` +
            `2. 對不切實際的假設或隱性風險，具體說明理由並提出修正建議。\n` +
            `3. 嘗試整合出大家都能接受的版本，並列出仍需老闆拍板的取捨。\n\n` +
            ANTI_SYCOPHANCY_AND_HALLUCINATION_RULES +
            MEETING_DISCUSSION_RULES +
            `\n${verbosityOption.instruction}`
          const userPrompt =
            `【👑 老闆的最新裁示】：\n${bossGuidance}\n\n` +
            `【會前客觀事實簡報】：\n${factBriefing}\n\n` +
            `【第 ${currentRound} 輪各合夥人最新深化方案】：\n${roundTranscript}\n\n` +
            `請點名回應其他合夥人在第 ${currentRound} 輪提出的新論點：認同、補充、疑慮與修正建議，並往共識收斂。遵守篇幅要求（${verbosityOption.targetWords}）。`

          let content = await speak(seat, system, userPrompt, rebutRound, emit, verbosityOption.maxOutputTokens, expertCtx, `${stance.title} · 交叉討論`)
          if (!content || content.trim().length === 0) {
            content = `【交叉討論：${stance.title}】\n看了大家的新版方案，方向大致可行，但仍建議補上：${stance.attackTriggers}`
            emit({ type: 'delta', round: rebutRound, name: seat.name, content })
          }
          return { round: rebutRound, name: seat.name, role: seat.role, stance: `${stance.title} (交叉討論)`, content }
        })
      )
      results.push(...rebuttalResults)
    }
  }

  return results
}

// ── 執行最終收斂：交付報告 ───────────────────────────────────────────────────

export async function executeSynthesize(
  bossInstruction: string,
  factBriefing: string,
  allStatements: Statement[],
  moderator: Seat,
  emit: (e: RoundtableEvent) => void,
  synthesisStyle: SynthesisStyle = 'default',
  verbosity: VerbosityMode = 'standard_300',
  bossGuidance = '',
): Promise<string> {
  const styleConfig = SYNTHESIS_STYLES.find(s => s.id === synthesisStyle) ?? SYNTHESIS_STYLES[0]
  const verbosityOption = VERBOSITY_OPTIONS.find(v => v.id === verbosity) ?? VERBOSITY_OPTIONS[1]

  emit({
    type: 'phase',
    phase: 'synthesize',
    label: `最終收斂 · 首席幕僚長出具報告 (${formatModelDisplayName(moderator.model)})`,
  })

  const lengthGuide =
    verbosity === 'concise_150'
      ? '【篇幅要求：高層極速 Memo，全文約 400~600 字，精準提煉勝負判定與唯一優先行動。】'
      : verbosity === 'unlimited'
        ? '【篇幅要求：高層決策白皮書，不設字數上限，全面詳盡推導，但嚴格條列清晰、無任何贅語廢話。】'
        : '【篇幅要求：標準商務白皮書，結構完整、資訊密度極高、無客套空話。】'

  const moderatorSystem =
    `你是董事會【首席幕僚長】，代表職責：${moderator.role}。\n` +
    `全體資深合夥人已針對老闆的指令完成會議討論，現在請把全體研議收斂成一份結構完整、可直接落地的最高決策報告。\n\n` +
    `【本次收斂風格指導原則】：\n${styleConfig.instruction}\n\n` +
    `${lengthGuide}\n\n` +
    `報告必須包含以下結構：\n` +
    `1. 💡 30 秒高層結論 (讓老闆在 30 秒內看懂最核心定論與推薦路徑)\n` +
    `2. 📊 客觀事實與關鍵指標矩陣摘要 (引用 Fact Sheet 數據)\n` +
    `3. 🤝 各方共識與關鍵分歧點 (先列已達成的共識，再梳理仍待取捨的分歧與各自代價)\n` +
    `4. 🎯 最終推薦執行方案與資源配置 (給出明確的優先級與取捨理由)\n` +
    `5. ⚠️ 關鍵風險監控與預警清單 (標註不可忽視的黑天鵝與盲點)\n\n` +
    `語言風格：繁體中文、極高資訊密度、條理清晰、具備頂級商業顧問水平。`

  const fullDebate = formatStatements(allStatements)
  const guidance = bossGuidance.trim()
  const userPrompt =
    `【老闆最初指令】：\n${bossInstruction}\n\n` +
    `【會前客觀事實簡報 (Fact Sheet)】：\n${factBriefing}\n\n` +
    `【會議全程研議紀錄】：\n${fullDebate}\n\n` +
    (guidance
      ? `【老闆本次結會補充意見 (最高優先，必須貫徹於整份報告)】：\n${guidance}\n\n`
      : '') +
    `請以首席幕僚長之最高視野綜觀全場，出具交付老闆的最終結構化決策報告。`

  const maxSynthesizeTokens = verbosity === 'concise_150' ? 2048 : 8192
  const report = await speak(moderator, moderatorSystem, userPrompt, 99, emit, maxSynthesizeTokens)
  emit({ type: 'report', content: report })
  return report
}

// ── 主流程 (相容舊呼叫，同時支援新特性) ───────────────────────────────────────

export interface RoundtableConfig {
  bossInstruction: string
  domain?: RoundtableDomain
  seats?: Seat[]
  moderator?: Seat
  rebuttal?: boolean
  interactive?: boolean // 若為 true，跑完第 2 輪後即暫停並拋出 waiting_boss
  uploadedFilesContext?: string
  synthesisStyle?: SynthesisStyle
  verbosity?: VerbosityMode
}

export async function runRoundtable(
  config: RoundtableConfig,
  emit: (e: RoundtableEvent) => void,
): Promise<string> {
  const domain = detectDomain(config.bossInstruction, config.domain)
  const preset = DOMAIN_PRESETS[domain] ?? DOMAIN_PRESETS.auto

  const seats = config.seats?.length ? config.seats : DEFAULT_SEATS
  const moderator = config.moderator ?? DEFAULT_MODERATOR
  const boss = config.bossInstruction.trim()
  const verbosity = config.verbosity ?? 'standard_300'

  const broadcastStances = seats.map((s, idx) => {
    const st = resolveSeatStance(s, idx, preset)
    return { name: s.name, title: st.title }
  })

  emit({
    type: 'domain-detected',
    domain,
    label: preset.label,
    stances: broadcastStances,
  })

  // 預先載入專家知識
  const expertContextMap = new Map<string, string>()
  const expertIds = [...new Set(seats.map(s => s.expertId).filter(Boolean) as string[])]
  if (expertIds.length) {
    await Promise.all(
      expertIds.map(async id => {
        const ctx = await loadExpertContext([id])
        if (ctx) expertContextMap.set(id, ctx)
      })
    )
  }

  // ── 階段 0：資料專員出具客觀事實簡報 ───────────────────────────────────────
  const factBriefing = await fetchFactBriefing(boss, domain, emit, config.uploadedFilesContext)

  // ── 階段 1：第一輪獨立發言 (⚡ 平行併發) ────────────────────────────────────
  const round1 = await executeRound1(boss, factBriefing, seats, preset, emit, expertContextMap, verbosity)

  // ── 階段 2：第二輪交叉討論 (⚡ 平行併發) ────────────────────────────────────
  let allStatements = [...round1]
  if (config.rebuttal !== false) {
    const round2 = await executeRound2(boss, factBriefing, round1, seats, preset, emit, expertContextMap, verbosity)
    allStatements.push(...round2)
  }

  // 若為互動模式 (interactive)，在第二輪結束後暫停，交給老闆指揮
  if (config.interactive) {
    emit({ type: 'waiting_boss', round: 2 })
    return ''
  }

  // ── 階段 3：最終收斂報告 ───────────────────────────────────────────────────
  const report = await executeSynthesize(boss, factBriefing, allStatements, moderator, emit, config.synthesisStyle, verbosity)
  return report
}
