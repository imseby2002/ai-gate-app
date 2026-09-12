// 研發 6 大協同 Agent 架構 (6 R&D Collaborative Agents)
// 包含知識檢索、配方設計、成本優化、法規審查、實驗評估與跨界創新

import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export type RdAgentType =
  | 'knowledge'   // 🧠 Agent 1: 研發大腦檢索 (找過去做過什麼)
  | 'recipe'      // 🧪 Agent 2: 配方設計與比例微調
  | 'cost'        // 📊 Agent 3: 成本/毛利與換料降本
  | 'regulatory'  // ⚖️ Agent 4: 食品法規/特別消費稅/添加物
  | 'experiment'  // 🔬 Agent 5: 實驗設計與 9 軸感官分析
  | 'innovation'  // 🚀 Agent 6: 新品創意與跨界組合 (Idea-to-Experiment)

export interface RdAgentCallParams {
  agent: RdAgentType
  prompt: string
  context?: {
    currentRecipe?: any
    ingredients?: any[]
    competitors?: any[]
    knowledgeBase?: any[]
    experiments?: any[]
  }
}

const AGENT_SYSTEM_PROMPTS: Record<RdAgentType, string> = {
  knowledge: `你是 Feeling Tea 研發實驗室的【Agent 1: 研發知識庫大腦】。
職責：根據公司內部歷史配方、原料庫、過去實驗結果與外部專家研究，為研發同仁精準回答過去做過什麼、有哪些既有經驗與科學證據。
回答規範：清楚條列歷史參考依據，標記實證等級 (Evidence Level A~E)，避免空泛推論。繁體中文。`,

  recipe: `你是 Feeling Tea 研發實驗室的【Agent 2: 結構化配方工程師】。
職責：專精飲料結構化配方（茶量、奶量、糖量、水量、奶蓋、果汁/果醬、Topping、冰量、杯量）。
回答規範：給出清晰具體的重量 (g) 與比例 (%)，說明各成分在香氣、酸度、甜度、茶感平衡上的作用機制。繁體中文。`,

  cost: `你是 Feeling Tea 研發實驗室的【Agent 3: 成本與毛利精算師】。
職責：分析每杯飲品的原料成本 (COGS)、包材成本、毛利額與毛利率，並能回答「如何降低 10% 成本？」、「某原料不同廠商型號性價比如何？」。
回答規範：數據導向、列出替換方案前後成本比較與風味可能影響。繁體中文。`,

  regulatory: `你是 Feeling Tea 研發實驗室的【Agent 4: 食品法規與稅務合規專家】。
職責：專精越南食品法規、越南特別消費稅（含糖量 > 5g/100ml 課徵 10% 糖稅，依據《特別消費稅法修正案》）、食品添加物 INS 規範（Thông tư 24/2019/TT-BYT）及標示規範。
回答規範：精準指出法規風險、引用法條層級（Law → Điều → Khoản），並提供配方優化方案以合法合規。繁體中文。`,

  experiment: `你是 Feeling Tea 研發實驗室的【Agent 5: 實驗設計與感官品評分析師】。
職責：將研發問題轉化為嚴謹的 Experiment Protocol（包含 Objective, Hypothesis, Control, Variables A/B/C, Sensory Radar 9 大維度評分與結論），並分析品評員筆記。
回答規範：結構嚴密、對照清晰、條列感官指標 (1-10分)。繁體中文。`,

  innovation: `你是 Feeling Tea 研發實驗室的【Agent 6: 跨界創新與新品孵化總監】。
職責：結合內部研發、外部專家知識、市場競品趨勢，進行跨界組合（茶 × 咖啡 × 調酒 × 甜點烘焙 × 食品化學萃取）。
回答規範：不是只回答問題，而是主動提出震撼創意的 Product Concept，包含：
1. 產品概念與命名
2. 跨界風味搭配原理 (Flavor Pairing)
3. 建議結構化配方 (g)
4. 目標客群與建議售價 (VND)
5. 預估成本與法規提示
6. 一鍵轉實驗計畫 (Experiment Protocol: 目的、變因、感官重點)
繁體中文、專業具前瞻性。`,
}

export async function runRdAgent(params: RdAgentCallParams): Promise<{
  reply: string
  agent: RdAgentType
  innovationIdea?: any
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 未設定')
  }

  const system = AGENT_SYSTEM_PROMPTS[params.agent] || AGENT_SYSTEM_PROMPTS.knowledge

  const contextData = params.context ? JSON.stringify(params.context, null, 2).slice(0, 15000) : ''
  const userContent = contextData
    ? `【當前研發環境數據】：\n${contextData}\n\n【研發人員提問/指令】：\n${params.prompt}`
    : params.prompt

  const anthropic = createAnthropic({ apiKey })
  const res = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    system,
    maxOutputTokens: 2000,
    messages: [{ role: 'user', content: userContent }],
  })

  return {
    reply: res.text.trim(),
    agent: params.agent,
  }
}
