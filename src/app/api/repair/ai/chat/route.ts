import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { getUnitContextAny } from '@/lib/auth/unit-access'
import { searchRepairKnowledge } from '@/lib/repair-ai/engine'
import type { RepairMode, RepairAIMessage, EquipmentCategory } from '@/lib/types/repair-ai'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      message,
      mode = 'store',
      equipment_model = '',
      category = 'bar',
      history = [],
    } = body as {
      message: string
      mode: RepairMode
      equipment_model?: string
      category?: EquipmentCategory
      history?: { role: 'user' | 'assistant'; content: string }[]
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: '請輸入問題描述或故障代碼' }, { status: 400 })
    }

    // 1. 取得資料庫連線或備援
    const ctx = await getUnitContextAny(['repair', 'store']).catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    // 嘗試從資料庫載入自訂切片或案例（若表存在）
    let dbChunks: any[] = []
    let dbCases: any[] = []
    let dbModels: any[] = []
    if (supabase) {
      try {
        const { data: chunks } = await supabase.from('repair_knowledge_chunks').select('*').limit(20)
        if (chunks && chunks.length > 0) dbChunks = chunks
        const { data: cases } = await supabase.from('repair_case_feedbacks').select('*').limit(10)
        if (cases && cases.length > 0) dbCases = cases
        const { data: models } = await supabase.from('repair_cold_start_models').select('*').limit(10)
        if (models && models.length > 0) dbModels = models
      } catch (err) {
        // Fallback safely to in-memory seeds
      }
    }

    // 2. 執行混合檢索 (Hybrid Search & RAG)
    const retrieval = searchRepairKnowledge({
      query: message,
      equipment_model,
      category,
      mode,
      dbChunks,
      dbCases,
      dbModels,
    })

    // 3. 準備 LLM 提示詞 (Prompt Routing)
    const isStore = mode === 'store'
    const systemPrompt = isStore
      ? `你是由 FEELING TEA 總部打造的「門市吧檯設備與 IT 軟硬體快速排除 AI 助理（門市模式）」。
你的使用者是：繁忙的門市店長、早晚班吧台工讀生。
【門市模式鐵律與指導方針】：
1. ⚠️ 【安全防呆第一】：絕對禁止叫門市人員拆解螺絲、外殼或碰觸高溫（160°C 以上）發熱棒與 110V/220V 電路板。
2. 🎯 【極簡精準，拒絕廢話】：每次只給 1~3 個具體行動步驟（如：重插插頭、擦拭電眼鏡頭、60°C溫水浸泡出糖嘴、調整出單機紙卷方向）。
3. 📋 【排查未果自動轉報修】：如果指示的免拆機步驟無法解決，直接總結狀況並告知「已為您備妥報修單草稿，點擊下方即可一鍵送修」。

【檢索到之原廠手冊與知識庫依據】：
${retrieval.matched_chunks.map(c => `[${c.title}]\n${c.content}`).join('\n\n')}

${retrieval.matched_cases.length > 0 ? `【歷史技師真實修復紀錄】：\n${retrieval.matched_cases.map(cs => `- 機型 ${cs.equipment_model}: 真因是「${cs.actual_root_cause}」，更換「${cs.parts_replaced}」`).join('\n')}` : ''}

請用親切、清晰且條理分明的繁體中文回答。`
      : `你是由 FEELING TEA 總部機電工程部打造的「專業技師與工務工程 AI 助理（技師工程模式）」。
你的使用者是：具備水電、機電或 IT 專業的工務技師與硬體工程師。
【技師模式核心方針】：
1. ⚡ 【深入機電與電路分析】：提供電阻值量測範圍 (Ω)、電壓量測點 (24VDC/12VDC/5VDC)、凸輪微動開關 (Cam Switch) 導通蜂鳴測試與接點判讀。
2. 🔩 【零件料號精確推薦】：主動提供原廠料號 (Part Number)、更換工序以及安全注意事項。
3. 🔁 【閉環回饋】：維修完成後提醒技師回傳實際損壞零件與量測數據，持續擴充企業大腦。

【檢索到之原廠手冊、電路圖與知識庫依據】：
${retrieval.matched_chunks.map(c => `[${c.title}]\n${c.content}`).join('\n\n')}

${retrieval.matched_cases.length > 0 ? `【歷史技師修復案例】：\n${retrieval.matched_cases.map(cs => `- [${cs.equipment_model}] 真因: ${cs.actual_root_cause} | 零件: ${cs.parts_replaced} | 量測: ${cs.measured_resistance_or_voltage}`).join('\n')}` : ''}

請用嚴謹、專業且直擊機電核心問題的繁體中文回答。`

    let replyText = ''
    let aiModelUsed = 'Local Repair Diagnostic Engine'

    // 嘗試調用 AI 模型
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
    const hasGoogle = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
    const hasOpenAI = !!process.env.OPENAI_API_KEY

    const messages = [
      ...history.slice(-4).map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: message },
    ]

    if (hasAnthropic) {
      try {
        const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const res = await generateText({
          model: anthropic('claude-3-5-sonnet-latest'),
          system: systemPrompt,
          messages,
        })
        replyText = res.text
        aiModelUsed = 'Claude 3.5 Sonnet'
      } catch (err) {
        console.warn('Anthropic failed, falling back...', err)
      }
    }

    if (!replyText && hasGoogle) {
      try {
        const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
        const res = await generateText({
          model: google('gemini-2.5-flash'),
          system: systemPrompt,
          messages,
        })
        replyText = res.text
        aiModelUsed = 'Gemini 2.5 Flash'
      } catch (err) {
        console.warn('Google AI failed, falling back...', err)
      }
    }

    if (!replyText && hasOpenAI) {
      try {
        const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const res = await generateText({
          model: openai('gpt-4o-mini'),
          system: systemPrompt,
          messages,
        })
        replyText = res.text
        aiModelUsed = 'GPT-4o Mini'
      } catch (err) {
        console.warn('OpenAI failed, falling back to rule engine...', err)
      }
    }

    // 本地高品質備援合成器 (無 API Key 時保證 100% 正常運作)
    if (!replyText) {
      if (isStore) {
        replyText = `### 門市快速排查指引（免拆機・安全防呆）\n\n`
        if (retrieval.error_code_hit) {
          replyText += `已辨識到故障代碼 **${retrieval.error_code_hit}**。\n\n`
        }
        if (retrieval.suggested_steps.length > 0) {
          replyText += `請依序嘗試以下 **${retrieval.suggested_steps.length}** 個步驟排除問題：\n\n`
          retrieval.suggested_steps.forEach((st, idx) => {
            replyText += `**步驟 ${idx + 1}：${st.title}**\n- 操作：${st.instruction}\n- 正常狀態：${st.expected_normal}\n- 若未改善：${st.if_failed_action}\n\n`
          })
        } else {
          replyText += `請先確認：\n1. 插座電源是否通電（確認插頭未鬆脫）。\n2. 關閉總電源開關 30 秒後重新開機。\n3. 外觀檢查是否有茶湯溢出或異物卡死。\n\n`
        }

        if (retrieval.ticket_draft) {
          replyText += `> 💡 若上述步驟皆已完成但問題持續，請勿自行拆解外殼。下方已為您自動彙整報修工單，點擊按鈕即可立即通知工務技師派工！`
        }
      } else {
        replyText = `### 專業技師機電分析與量測指引\n\n`
        if (retrieval.matched_model) {
          replyText += `**目標設備**：${retrieval.matched_model.brand} ${retrieval.matched_model.model_name}\n\n`
        }
        if (retrieval.suggested_steps.length > 0) {
          replyText += `#### 逐步電阻/電壓量測 SOP：\n\n`
          retrieval.suggested_steps.forEach((st, idx) => {
            replyText += `**${idx + 1}. ${st.title}**\n- 檢驗操作：${st.instruction}\n- 標準數值：\`${st.expected_normal}\`\n- 異常判定：${st.if_failed_action}\n\n`
          })
        }
        if (retrieval.matched_cases.length > 0) {
          replyText += `#### 技師歷史修復案例參考：\n`
          retrieval.matched_cases.forEach(cs => {
            replyText += `- **[${cs.equipment_model}]** 真因：${cs.actual_root_cause} | 零件：${cs.parts_replaced} (${cs.measured_resistance_or_voltage || '正常'})\n`
          })
          replyText += '\n'
        }
        replyText += `維修完成後，請務必於工單回填實際量測阻值與更換料號，協助 AI 知識庫持續閉環學習。`
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      ai_model: aiModelUsed,
      reply: replyText,
      safety_alert: retrieval.safety_alert,
      diagnostic_steps: retrieval.suggested_steps,
      ticket_draft: retrieval.ticket_draft,
      matched_chunks: retrieval.matched_chunks,
      matched_cases: retrieval.matched_cases,
      matched_model: retrieval.matched_model,
    })
  } catch (error: any) {
    console.error('Repair AI chat error:', error)
    return NextResponse.json({ error: error?.message || '內部伺服器錯誤' }, { status: 500 })
  }
}
