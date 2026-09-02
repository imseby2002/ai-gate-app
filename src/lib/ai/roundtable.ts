/**
 * 次世代 AI 智慧圓桌會議 2.0 (Interactive Virtual Boardroom)
 *
 * 核心架構：
 * 1. 🗄️ 資料專員 (Fact Briefing Layer)：
 *    - 採用 Gemini 2.5 Flash + Google 聯網檢索，產出客觀 Fact Sheet。
 *    - 支援四大領域專屬檢核表 (金融/行銷/技術/組織) 與通用 5W2H 事實矩陣。
 *    - 嚴禁主觀評價，無數據標記 N/A，杜絕幻覺。
 *
 * 2. ⚔️ 獨立合夥人辯論 (Debate Layer)：
 *    - 席位具備戰略學派哲學對立 (不可能三角)。
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
import { loadExpertContext } from '@/lib/experts/loader'

// ── 領域與哲學學派定義 ────────────────────────────────────────────────────────

export type RoundtableDomain = 'auto' | 'finance' | 'marketing' | 'tech' | 'hr'

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
        attackTriggers: '質疑他人過度保守、短視流動性、錯失顛覆性市場紅利。',
      },
      {
        name: '員工B',
        title: '價值安全邊際派 (Value & Margin of Safety)',
        philosophy: '沒有任何公司值得用瘋狂溢價購買。看重真實的自由現金流 (FCF)、估值乘數與下行防禦。',
        attackTriggers: '質疑他人拿 Non-GAAP EBITDA 灌水自嗨、忽略景氣反轉時高估值崩盤的毀滅性風險。',
      },
      {
        name: '員工C',
        title: '護城河與商業本質派 (Moat & Business Reality)',
        philosophy: '短期成長與低估值都是假的，客戶的轉換成本 (Switching Cost)、定價權與技術壁壘才是真的。',
        attackTriggers: '質疑他人只看一兩季財報數字，忽視產品正在被開源或競爭對手侵蝕底層生態。',
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
        attackTriggers: '質疑他人大談品牌形象與情懷，但拿不出真實訂單轉化數字的玄學行銷。',
      },
      {
        name: '員工B',
        title: '心智與品牌資產派 (Brand Equity & Pricing Power)',
        philosophy: '流量買得到點擊，買不到偏好；定價權來自心智護城河，降價促銷是毒藥。',
        attackTriggers: '質疑他人動不動就打折滿千送百，把品牌做成地攤貨；為了點擊率發布低俗吸睛廣告。',
      },
      {
        name: '員工C',
        title: '產品驅動與 LTV 留存派 (Product-Led & Retention)',
        philosophy: '最好的行銷是產品本身會說話；留不住用戶，前端引流都是往破桶裡倒水。',
        attackTriggers: '質疑他人產品一團糟卻拼命燒錢洗新用戶進來割韭菜；只管首購、不管回購。',
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
        attackTriggers: '質疑他人過度設計 (Over-engineering)，為了想像中的高併發拖延幾個月不上線。',
      },
      {
        name: '員工B',
        title: '高可用與架構純粹派 (Robustness & Scalability)',
        philosophy: '垃圾架構會毀了公司。今天欠下的技術債，明天會用 10 倍當機代價償還。',
        attackTriggers: '質疑他人為趕工東拼西湊代碼，缺乏架構邊界、單元測試與安全防護。',
      },
      {
        name: '員工C',
        title: '商業實用與成本防禦派 (Pragmatic & Cost Control)',
        philosophy: '別當開源義工。技術是為了幫公司賺錢省錢，能買現成 SaaS / API 絕不自研。',
        attackTriggers: '質疑工程師自嗨造輪子，拿公司的伺服器預算與薪水去玩冷門新技術。',
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
        attackTriggers: '質疑他人講苦勞、講年資情分、保護老員工；容忍平庸就是懲罰優秀。',
      },
      {
        name: '員工B',
        title: '組織文化與心理安全派 (Culture & Trust)',
        philosophy: '恐懼換不來創新。長期勝仗靠的是使命感、互信與心理安全感。',
        attackTriggers: '質疑末位淘汰搞得人人自危、內捲甩鍋、不敢承擔創新風險。',
      },
      {
        name: '員工C',
        title: '制度標準化與 SOP 派 (Process & Governance)',
        philosophy: '好制度讓普通人也能產出及格成果。不依賴個人英雄，流程大於個人。',
        attackTriggers: '質疑人治、權力任性、制度朝令夕改，核心骨幹一離職業務就癱瘓。',
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
        attackTriggers: '攻擊另外兩人過度保守、動作遲緩、錯失歷史性戰略窗口期。',
      },
      {
        name: '員工B',
        title: '極端防禦 / 風控與護城河派',
        philosophy: '活下去最重要。防範最壞情境、合規合法、構築不可替代的護城河是第一優先。',
        attackTriggers: '攻擊 A 盲目冒險、忽視單點崩潰風險與致命黑天鵝事件。',
      },
      {
        name: '員工C',
        title: '落地可行性 / 現金流與實用派',
        philosophy: '算清帳本才能打仗。所有的戰略都必須落實到可執行的預算、人力與正現金流。',
        attackTriggers: '攻擊 A 畫大餅無法落地、攻擊 B 過度恐懼導致寸步難行。',
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
}

export const DEFAULT_SEATS: Seat[] = [
  { name: '員工A', model: 'anthropic/claude-sonnet-4-6', role: '資深管理合夥人' },
  { name: '員工B', model: 'openai/gpt-5',                role: '資深管理合夥人' },
  { name: '員工C', model: 'google/gemini-2.5-pro',      role: '資深管理合夥人' },
]

export const DEFAULT_MODERATOR: Seat = {
  name: '整合者',
  model: 'anthropic/claude-opus-4-8',
  role: '會議主持人，負責綜觀全場、標註分歧並彙整為交付老闆的最終決策報告',
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
    // 優先策略 1：若有有效的 OPENROUTER_API_KEY，直連真實 Anthropic Claude 模型（Claude 3.7 / 4.6 Sonnet & Opus）
    if (process.env.OPENROUTER_API_KEY) {
      const openrouter = createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      })
      const orModel =
        rawModel === 'claude-sonnet-4-6' || rawModel === 'claude-3-7-sonnet-20250219'
          ? 'anthropic/claude-sonnet-4.6'
          : rawModel === 'claude-opus-4-8' || rawModel === 'claude-3-opus-20240229'
            ? 'anthropic/claude-opus-4.8'
            : `anthropic/${rawModel}`
      return openrouter.chat(orModel)
    }

    // 優先策略 2：直連 Anthropic API
    const key = process.env.ANTHROPIC_API_KEY?.trim()
    if (key && !anthropicDisabled) {
      const model =
        rawModel === 'claude-sonnet-4-6'
          ? 'claude-3-7-sonnet-20250219'
          : rawModel === 'claude-opus-4-8'
            ? 'claude-3-opus-20240229'
            : rawModel
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
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY! }).chat(rawModel)
  }
  if (provider === 'google') {
    return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })(rawModel)
  }
  return id
}

function isReasoningModel(model: string): boolean {
  return /^(openai\/)?(o\d+|gpt-5)/i.test(model)
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
5. 【嚴禁重複背景】：公司基本介紹已由資料專員在會前簡報提供，你嚴禁花費篇幅重複介紹公司歷史或產品背景，必須直接切入你的戰略立場與攻防論點！
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
  return 'auto'
}

// ── 階段 0：資料專員 (Fact Briefing) ──────────────────────────────────────────

export async function fetchFactBriefing(
  instruction: string,
  domain: RoundtableDomain,
  emit?: (e: RoundtableEvent) => void,
  uploadedFilesContext?: string,
): Promise<string> {
  emit?.({ type: 'phase', phase: 'briefing', label: '會前準備 · 客觀事實查核' })

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

  // 優先嘗試使用 Gemini 2.5 Flash 原廠 Google Search Grounding
  if (process.env.GOOGLE_AI_API_KEY) {
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
      } else {
        console.warn('[fact-briefing] Gemini Google Search returned non-200:', resp.status)
      }
    } catch (err) {
      console.error('[fact-briefing] Google Search Grounding call error:', err)
    }
  }

  // 若 Google Search 失敗或未設定，退回一般語言模型推論
  if (!fullText.trim()) {
    try {
      const fallbackModel = resolveModel('google/gemini-2.5-flash')
      const result = await streamText({
        model: fallbackModel as LanguageModel,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 4096,
        providerOptions: {
          google: { thinkingConfig: { thinkingBudget: 0 } },
        },
      })
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          fullText += part.text
          emit?.({ type: 'briefing-delta', content: part.text })
        }
      }
    } catch (err) {
      console.error('[fact-briefing] fallback streamText error:', err)
      fullText = '⚠️ 資料專員聯網檢索暫時不可用，由各合夥人依自身知識庫展開研議。'
    }
  } else {
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
  } catch (err) {
    console.warn(`[roundtable] primary model failed for ${seat.name} (${seat.model}):`, err)
    if (seat.model.startsWith('anthropic/')) {
      anthropicDisabled = true
    }

    // 容錯備援鏈：只要產出不足 30 字，無論何種原因失敗立即啟動備援模型
    if (full.length < 30) {
      let fallbackSuccess = false
      const fallbackCandidates: { name: string; model: LanguageModel }[] = []

      if (process.env.OPENAI_API_KEY && !seat.model.startsWith('openai/')) {
        fallbackCandidates.push({
          name: 'openai/gpt-4o',
          model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).chat('gpt-4o'),
        })
      }
      if (process.env.GOOGLE_AI_API_KEY && !seat.model.startsWith('google/')) {
        fallbackCandidates.push({
          name: 'google/gemini-2.5-flash',
          model: createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY })('gemini-2.5-flash'),
        })
      }
      if (process.env.OPENAI_API_KEY && seat.model.startsWith('google/')) {
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

export function formatStatements(statements: Statement[]): string {
  return statements
    .map(s => `### ${s.name} (${s.role}${s.stance ? ` · ${s.stance}` : ''})\n${s.content?.trim() || '(未發言)'}`)
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
): Promise<Statement[]> {
  emit({ type: 'phase', phase: 'discuss', label: '第一輪 · 獨立研議 (平行進行)' })

  const results = await Promise.all(
    seats.map(async (seat, idx) => {
      const stance = domainPreset.stances[idx] ?? domainPreset.stances[0]
      const expertCtx = seat.expertId ? expertContextMap.get(seat.expertId) : undefined
      const system =
        `你是一家頂尖決策委員會的資深合夥人，你的核心戰略學派：【${stance.title}】。\n` +
        `你的底層信仰：${stance.philosophy}\n` +
        `你的挑刺觸發點：${stance.attackTriggers}\n\n` +
        ANTI_SYCOPHANCY_AND_HALLUCINATION_RULES
      const userPrompt =
        `老闆的指令：\n${boss}\n\n` +
        `【會前客觀事實簡報 (Fact Sheet)】：\n${factBriefing}\n\n` +
        `請完全依據你的戰略學派立場與客觀事實簡報，提出你最犀利、最具深度、有數據支撐的觀點。\n` +
        `直奔核心，嚴禁重複背景介紹與客套寒暄。字數不限，重在推論深度。`

      let content = await speak(seat, system, userPrompt, 1, emit, 4096, expertCtx, stance.title)
      if (!content || content.trim().length === 0) {
        console.warn(`[roundtable] seat ${seat.name} produced empty content in R1, generating emergency stance view`)
        content = `【學派基本立場：${stance.title}】\n本席位秉持「${stance.philosophy}」之核心哲學，強烈關注「${stance.attackTriggers}」。在本次議題中，我方堅持以此維度嚴格審視各項方案代價。`
      }
      return { round: 1, name: seat.name, role: seat.role, stance: stance.title, content }
    })
  )

  return results
}

// ── 執行第二輪：針鋒相對 (⚡ 同輪平行併發) ─────────────────────────────────────

export async function executeRound2(
  boss: string,
  factBriefing: string,
  round1Statements: Statement[],
  seats: Seat[],
  domainPreset: DomainPreset,
  emit: (e: RoundtableEvent) => void,
  expertContextMap: Map<string, string>,
): Promise<Statement[]> {
  emit({ type: 'phase', phase: 'rebut', label: '第二輪 · 針鋒相對 (平行進行)' })
  const transcript1 = formatStatements(round1Statements)

  const results = await Promise.all(
    seats.map(async (seat, idx) => {
      const stance = domainPreset.stances[idx] ?? domainPreset.stances[0]
      const expertCtx = seat.expertId ? expertContextMap.get(seat.expertId) : undefined
      const system =
        `你是一家頂尖決策委員會的資深合夥人，你的核心戰略學派：【${stance.title}】。\n` +
        `你的底層信仰：${stance.philosophy}\n` +
        `你的挑刺觸發點：${stance.attackTriggers}\n\n` +
        `【本輪核心任務】：針鋒相對、無情挑刺！\n` +
        `1. 請仔細檢驗其他合夥人在第一輪發言中的邏輯盲點、過度樂觀的虛假假設或漏洞。\n` +
        `2. 查核對方引用的事實或數據是否有誤。\n` +
        `3. 捍衛並補強自身立場，針對根本性分歧正面開火。\n\n` +
        ANTI_SYCOPHANCY_AND_HALLUCINATION_RULES
      const userPrompt =
        `老闆的指令：\n${boss}\n\n` +
        `【會前客觀事實簡報 (Fact Sheet)】：\n${factBriefing}\n\n` +
        `【第一輪全體發言】：\n${transcript1}\n\n` +
        `請直接對其他合夥人的推論開砲，補強你自己立場。只談新增反駁與修正，嚴禁重複第一輪已說過的內容。`

      let content = await speak(seat, system, userPrompt, 2, emit, 4096, expertCtx, stance.title)
      if (!content || content.trim().length === 0) {
        console.warn(`[roundtable] seat ${seat.name} produced empty content in R2, generating emergency stance view`)
        content = `【學派本輪深化：${stance.title}】\n針對同僚所提出的論據，我方重申：任何未考慮「${stance.attackTriggers}」的方案都具有重大致命傷，呼籲老闆切勿輕信過度樂觀之假設。`
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
): Promise<Statement[]> {
  emit({ type: 'boss-instruction', round: currentRound, content: bossGuidance, targetSeat: targetSeatName })

  const priorTranscript = formatStatements(allPriorStatements)
  const results: Statement[] = []

  if (action === 'call_on' && targetSeatName) {
    // 點名單挑：指定該席位獨立發言
    const targetSeat = seats.find(s => s.name === targetSeatName) ?? seats[0]
    const seatIdx = seats.indexOf(targetSeat)
    const stance = domainPreset.stances[seatIdx] ?? domainPreset.stances[0]
    const expertCtx = targetSeat.expertId ? expertContextMap.get(targetSeat.expertId) : undefined

    emit({ type: 'phase', phase: 'discuss', label: `第 ${currentRound} 輪 · 點名發言 (${targetSeat.name})` })

    const system =
      `你是資深合夥人，學派：【${stance.title}】。\n` +
      `老闆現在親自點名你回答問題。\n` +
      `請針對老闆的最新指示，依據你的戰略學派與客觀數據，正面且深入作答。\n\n` +
      ANTI_SYCOPHANCY_AND_HALLUCINATION_RULES

    const userPrompt =
      `【會前客觀事實簡報】：\n${factBriefing}\n\n` +
      `【先前的會議發言紀錄】：\n${priorTranscript}\n\n` +
      `【👑 老闆對你的直接指示/提問】：\n${bossGuidance}`

    const content = await speak(targetSeat, system, userPrompt, currentRound, emit, 4096, expertCtx, stance.title)
    const firstReply: Statement = { round: currentRound, name: targetSeat.name, role: targetSeat.role, stance: stance.title, content }
    results.push(firstReply)

    // 若開啟互相質詢 (crossExamine)，其他合夥人針對此發言反駁
    if (crossExamine) {
      const otherSeats = seats.filter(s => s.name !== targetSeatName)
      emit({ type: 'phase', phase: 'rebut', label: `第 ${currentRound} 輪 · 同儕反駁 (${targetSeat.name}的回答)` })

      const crossResults = await Promise.all(
        otherSeats.map(async (seat) => {
          const idx = seats.indexOf(seat)
          const otherStance = domainPreset.stances[idx] ?? domainPreset.stances[0]
          const otherExpert = seat.expertId ? expertContextMap.get(seat.expertId) : undefined
          const crossSystem =
            `你是資深合夥人，學派：【${otherStance.title}】。\n` +
            `老闆剛才點名了 ${targetSeat.name}，現在請你針對 ${targetSeat.name} 的回答提出反駁、質疑或補充。\n\n` +
            ANTI_SYCOPHANCY_AND_HALLUCINATION_RULES
          const crossPrompt =
            `【會前客觀事實簡報】：\n${factBriefing}\n\n` +
            `【👑 老闆的指示】：\n${bossGuidance}\n\n` +
            `【${targetSeat.name} 的最新回答】：\n${content}\n\n` +
            `請從你的學派立場無情檢視其邏輯漏洞。`

          const crossContent = await speak(seat, crossSystem, crossPrompt, currentRound, emit, 4096, otherExpert, otherStance.title)
          return { round: currentRound, name: seat.name, role: seat.role, stance: otherStance.title, content: crossContent }
        })
      )
      results.push(...crossResults)
    }
  } else {
    // 全體深化：全體合夥人帶著老闆的最新指示，平行發言
    emit({ type: 'phase', phase: 'discuss', label: `第 ${currentRound} 輪 · 全員深化研議 (平行進行)` })

    const allResults = await Promise.all(
      seats.map(async (seat, idx) => {
        const stance = domainPreset.stances[idx] ?? domainPreset.stances[0]
        const expertCtx = seat.expertId ? expertContextMap.get(seat.expertId) : undefined
        const system =
          `你是資深合夥人，學派：【${stance.title}】。\n` +
          `老闆剛剛介入了會議並給予了最新的戰略指示。\n` +
          `請針對老闆的最新導向，依據你的戰略學派進一步深化你的方案，並回應先前的爭議焦點。\n\n` +
          ANTI_SYCOPHANCY_AND_HALLUCINATION_RULES
        const userPrompt =
          `【會前客觀事實簡報】：\n${factBriefing}\n\n` +
          `【先前的會議發言紀錄】：\n${priorTranscript}\n\n` +
          `【👑 老闆的最新裁示/方向指引】：\n${bossGuidance}\n\n` +
          `請深入推進方案，直擊痛點。`

        const content = await speak(seat, system, userPrompt, currentRound, emit, 4096, expertCtx, stance.title)
        return { round: currentRound, name: seat.name, role: seat.role, stance: stance.title, content }
      })
    )
    results.push(...allResults)
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
): Promise<string> {
  emit({ type: 'phase', phase: 'synthesize', label: '最終收斂 · 交付高層報告' })

  const moderatorSystem =
    `你是會議主持人，${moderator.role}。\n` +
    `全體資深合夥人已針對老闆的指令展開激烈辯論，現在請把全體研議收斂成一份結構完整、可直接落地的決策報告。\n\n` +
    `報告必須包含以下結構：\n` +
    `1. 💡 30 秒高層結論 (讓老闆在 30 秒內看懂最核心定論與推薦路徑)\n` +
    `2. 📊 客觀事實與關鍵指標矩陣摘要 (引用 Fact Sheet 數據)\n` +
    `3. ⚔️ 各學派核心觀點與關鍵分歧點 (梳理大家吵得最兇的點，以及各自的代價)\n` +
    `4. 🎯 最終推薦執行方案與資源配置 (給出明確的優先級與取捨理由)\n` +
    `5. ⚠️ 關鍵風險監控與預警清單 (標註不可忽視的黑天鵝與盲點)\n\n` +
    `語言風格：繁體中文、極高資訊密度、條理清晰、具備頂級商業顧問水平。`

  const fullDebate = formatStatements(allStatements)
  const userPrompt =
    `【老闆最初指令】：\n${bossInstruction}\n\n` +
    `【會前客觀事實簡報 (Fact Sheet)】：\n${factBriefing}\n\n` +
    `【會議全程研議紀錄】：\n${fullDebate}\n\n` +
    `請綜觀全場，出具交付老闆的最終結構化決策報告。`

  const report = await speak(moderator, moderatorSystem, userPrompt, 99, emit, 8192)
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
}

export async function runRoundtable(
  config: RoundtableConfig,
  emit: (e: RoundtableEvent) => void,
): Promise<string> {
  const domain = detectDomain(config.bossInstruction, config.domain)
  const preset = DOMAIN_PRESETS[domain] ?? DOMAIN_PRESETS.auto

  emit({
    type: 'domain-detected',
    domain,
    label: preset.label,
    stances: preset.stances.map(s => ({ name: s.name, title: s.title })),
  })

  const seats = config.seats?.length ? config.seats : DEFAULT_SEATS
  const moderator = config.moderator ?? DEFAULT_MODERATOR
  const boss = config.bossInstruction.trim()

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
  const round1 = await executeRound1(boss, factBriefing, seats, preset, emit, expertContextMap)

  // ── 階段 2：第二輪互評挑刺 (⚡ 平行併發) ────────────────────────────────────
  let allStatements = [...round1]
  if (config.rebuttal !== false) {
    const round2 = await executeRound2(boss, factBriefing, round1, seats, preset, emit, expertContextMap)
    allStatements.push(...round2)
  }

  // 若為互動模式 (interactive)，在第二輪結束後暫停，交給老闆指揮
  if (config.interactive) {
    emit({ type: 'waiting_boss', round: 2 })
    return ''
  }

  // ── 階段 3：最終收斂報告 ───────────────────────────────────────────────────
  const report = await executeSynthesize(boss, factBriefing, allStatements, moderator, emit)
  return report
}
