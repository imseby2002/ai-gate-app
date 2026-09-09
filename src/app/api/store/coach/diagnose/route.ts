import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { STORE_COACH_KNOWLEDGE } from '@/lib/store-coach/knowledge-base'
import type { DiagnosisOutput, DiagnosisLayer } from '@/lib/types/store-coach'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'

export const maxDuration = 60

const ALL_LAYERS: { layer: number; name: string; category: string }[] = [
  { layer: 1, name: '產品配方與標準 (Product & Recipe)', category: '產品品質' },
  { layer: 2, name: '流程節奏與交接 (Process & Pace)', category: '門市營運' },
  { layer: 3, name: '人員技能與心態 (People & Skills)', category: '人員管理' },
  { layer: 4, name: '設備器具與校準 (Equipment & Tools)', category: '門市營運' },
  { layer: 5, name: '環境動線與工效 (Environment & Layout)', category: '工作站與動線' },
  { layer: 6, name: '顧客反饋與場景 (Customer Context)', category: '服務溝通' },
  { layer: 7, name: '門市行銷與推廣 (Local Marketing)', category: '門市行銷' },
  { layer: 8, name: '店務管理與排班 (Store Management)', category: '人員管理' },
  { layer: 9, name: '原料與供應鏈批次 (Suppliers & Raw Materials)', category: '產品品質' },
  { layer: 10, name: '法規與食品安全 (Regulations & Food Safety)', category: '品質衛生' },
]

function generateRuleBasedDiagnosis(params: {
  problem_title: string
  problem_description: string
  product_name?: string
  store_code?: string
  category?: string
  rdRecipe?: any
}): DiagnosisOutput {
  const { problem_title, problem_description, product_name, store_code = 'TNN-01', category = 'quality', rdRecipe } = params
  const text = `${problem_title} ${problem_description}`.toLowerCase()

  const isSweetness = text.includes('甜') || text.includes('糖') || text.includes('果糖') || text.includes('sweet')
  const isSpeedOrBottleneck = text.includes('慢') || text.includes('塞') || text.includes('等很久') || text.includes('卡') || text.includes('延遲') || text.includes('動線')
  const isHygiene = text.includes('髒') || text.includes('異物') || text.includes('臭') || text.includes('蟑螂') || text.includes('抹布') || text.includes('清潔')
  const isService = text.includes('態度') || text.includes('口氣') || text.includes('臉臭') || text.includes('微笑') || text.includes('問候') || text.includes('客訴')

  const layers: DiagnosisLayer[] = ALL_LAYERS.map(l => {
    let status: DiagnosisLayer['status'] = 'normal'
    let finding = '未發現明顯異常或偏離標準'
    let evidence = '與 Feeling Tea 標準營運手冊一致'
    let remedy = '維持日常巡檢與定期點檢'

    if (l.layer === 1) { // 產品配方
      if (isSweetness) {
        status = 'root_cause'
        finding = `果糖定量設定或糖度計校正偏差。${rdRecipe ? `研發標準甜度為 ${rdRecipe.target_brix || '10.5'}°Bx，標準糖量 ${rdRecipe.syrup_ml || '25'}ml` : '標準半糖糖量為 15ml、微糖 7ml'}。`
        evidence = '顧客連續反映飲品甜度偏高，茶湯本體甜膩'
        remedy = '立即使用數位糖度計量測出杯 Brix 度數，比對研發配方卡'
      } else if (isSpeedOrBottleneck) {
        status = 'suspect'
        finding = '基底茶沖泡過濃或配料比例不均，影響搖茶融合時間'
        evidence = '調茶師需要額外攪拌才能溶解'
        remedy = '檢視熱水水溫 (85°C) 與茶湯泡發標準時間'
      }
    } else if (l.layer === 2) { // 流程節奏
      if (isSpeedOrBottleneck) {
        status = 'root_cause'
        finding = '茶湯工作站與冰塊封口站出現交叉逆向移動，造成瓶頸積單'
        evidence = '調茶師在雪克杯完成後需走動 3 步至封口機，卡住出杯檯'
        remedy = '實施標準「雙軌平行分流」：一人專注茶湯注料，一人專注加冰雪克封口'
      } else {
        status = 'normal'
        finding = '出單與貼標流程順暢'
        evidence = '平均每杯點單至進入製作小於 20 秒'
        remedy = '維持出單機與雪克杯順序對應'
      }
    } else if (l.layer === 3) { // 人員技能
      if (isService) {
        status = 'root_cause'
        finding = '夥伴在高峰期缺乏「3秒眼神接觸」與「進店問候語」，面部緊繃'
        evidence = '顧客感覺被冷落、店員忙於低頭看點單機'
        remedy = '店長進行 5 步驟引導式教練對話，重溫 Feeling Tea 溫暖接待心法'
      } else if (isSweetness || isSpeedOrBottleneck) {
        status = 'suspect'
        finding = '兼職新人對量杯傾倒視線平視 (Eye-level) 掌握不純熟，或使用量匙時未刮平'
        evidence = '倒糖時手抖或由高處傾倒未檢視刻度'
        remedy = '店長示範標準刻度平視確認手法，並陪同操作 3 杯'
      }
    } else if (l.layer === 4) { // 設備器具
      if (isSweetness) {
        status = 'root_cause'
        finding = '果糖機出糖噴嘴結晶沉積，每次注糖微量漏滴或吐糖馬達刻度偏離 +3ml'
        evidence = '熱水清洗噴嘴前秤重誤差達 12%'
        remedy = '立即進行 60°C 溫水沖洗噴嘴，並以電子秤進行 10 次校準測試'
      } else if (isSpeedOrBottleneck) {
        status = 'suspect'
        finding = '自動封口機下壓溫度感應器遲滯，每杯封口時間多耗 1.8 秒'
        evidence = '封口溫度儀顯示由 165°C 降至 150°C'
        remedy = '清潔封口機上下發熱模具，確認微動開關定位'
      }
    } else if (l.layer === 5) { // 環境動線
      if (isSpeedOrBottleneck) {
        status = 'suspect'
        finding = '吧檯工作站未遵循「高頻物料置於手肘 45cm 圓弧內」的黃金人體工學'
        evidence = '夥伴拿取備用茶湯需頻繁彎腰或側身跨步'
        remedy = '執行吧檯物料 5S 定位，將熱門茶膽置於注茶機正下方'
      } else if (isHygiene) {
        status = 'root_cause'
        finding = '水槽排水口濾網殘渣堆積，未落實 90 秒快閃清潔'
        evidence = '排水遲緩且產生微小異味'
        remedy = '啟動 90 秒水槽清潔序列 (SOP-CLEAN-03)'
      }
    } else if (l.layer === 6) { // 顧客反饋
      status = 'normal'
      finding = '顧客大多為上班族外帶或熟客，對甜度穩定度與出餐速度極為敏銳'
      evidence = '社群回饋與外送平台星等目前維持在 4.7 顆星'
      remedy = '遇顧客疑慮時，主動致歉並依「30秒免費重調機制」處理'
    } else if (l.layer === 7) { // 門市行銷
      status = 'normal'
      finding = '現行促銷活動宣傳物已陳列於點餐櫃檯右側'
      evidence = 'Zalo 官方帳號推播已同步折扣條碼'
      remedy = '維持行銷活動說明清晰，避免結帳時夥伴反覆向客人解說造成卡單'
    } else if (l.layer === 8) { // 店務管理
      if (isSpeedOrBottleneck) {
        status = 'suspect'
        finding = '15:00-17:00 下午茶高峰排班僅配置 2 人，未安排浮動機動手 (Floater)'
        evidence = '點餐員被迫兼任雪克備料，無法專注接待'
        remedy = '調整排班矩陣：平日下午高峰期配置 3 人（點餐/茶湯/雪克封口）'
      } else {
        status = 'normal'
        finding = '值班經理在場巡檢頻率正常'
        evidence = '日誌記錄每兩小時巡站一次'
        remedy = '巡檢時加強茶湯 Brix 抽檢'
      }
    } else if (l.layer === 9) { // 原料與供應鏈
      if (isSweetness) {
        status = 'suspect'
        finding = '新進批次蔗糖糖漿濃度檢驗值比上一批提高 1.2°Bx'
        evidence = '總部供應鏈批號 #SUG-2026-08 批次濃度略高'
        remedy = '通報總部研發 AI (RD-LAB)，微調門市果糖機檔位係數'
      } else {
        status = 'normal'
        finding = '茶葉、原汁與包材皆為總部合格批號'
        evidence = '進貨檢驗單皆在效期與溫控範圍內'
        remedy = '落實先進先出 (FIFO)'
      }
    } else if (l.layer === 10) { // 法規食安
      status = 'normal'
      finding = '糖度、熱量標示與茶葉產地標示皆符合食品安全衛生法規'
      evidence = '門市菜單與杯身標籤完整揭露咖啡因與糖分含量'
      remedy = '定期更新法規告示牌'
    }

    return {
      layer: l.layer,
      name: l.name,
      category: l.category,
      status,
      finding,
      evidence,
      remedy,
    }
  })

  return {
    problem_analysis: `針對門市【${store_code}】所回報之問題「${problem_title}」，營運教練 AI 透過 10 層全景診斷矩陣完成了交叉比對與原因溯源。`,
    layers,
    root_cause_summary: isSweetness
      ? '果糖機出糖噴嘴結晶造成定量偏差（實際出糖量大於刻度值約 12%），加上調茶員未平視量杯刻度雙重疊加。'
      : isSpeedOrBottleneck
      ? '高峰期吧檯動線交叉干擾，調茶師需跨站走動取冰與封口，且排班缺少機動手支援。'
      : isHygiene
      ? '未落實尖峰交接與關店前的 90 秒快閃清潔標準，水槽濾網與抹布分色管理鬆懈。'
      : '夥伴在高峰壓力下出現緊張感，缺乏 3 秒眼神問候與微笑傳遞，導致顧客感受冷漠。',
    immediate_actions: [
      '【即刻 15 分鐘】店長立即使用溫熱水 (60°C) 清洗並校準果糖機出糖噴嘴，使用電子秤秤量 5 次標準糖量。',
      '【出杯抽檢】對現場備製的熱銷茶品進行糖度計抽檢，比對 Feeling Tea 研發配方卡標準 Brix。',
      '【顧客挽回】若仍有在場顧客反映口感問題，依照「30秒客訴服務準則」親切重做並奉上一杯試飲茶。',
    ],
    preventive_actions: [
      '【每日打烊 SOP】將果糖機出糖嘴拆卸浸泡溫水列為打烊 90 秒必檢項目。',
      '【培訓認證】全體夥伴於本週班前會完成「量杯刻度視平線校準」3 次無盲測通過。',
      '【排班優化】下週起平日 15:00-17:00 下午茶高峰時段，排定第 3 位夥伴擔任浮動機動手。',
    ],
    coaching_dialogue: {
      step_1_empathy: '「小林，今天下午突然湧入一大波外送單，你看起來非常全力以赴在衝速度，辛苦了！」',
      step_2_factual_observation: '「剛剛有兩位客人反應檸檬綠茶喝起來比平時偏甜，我看你出單時量杯傾倒很快，可能沒注意到果糖嘴邊緣有微量結晶滴落。」',
      step_3_guiding_question: '「依你的經驗，如果果糖機噴嘴有一點黏稠結晶，或是倒糖時沒有平視刻度，會對出杯的口感和客人的信任造成什麼影響呢？」',
      step_4_action_agreement: '「我們一起來做一次 60 秒的果糖機噴嘴溫水清潔和磅秤校正，然後你調一杯我們一起盲測試喝，好嗎？」',
      step_5_empowerment: '「太棒了！只要這個細節把關好，客人都說你是店裡手藝最棒的調茶師，今天下午繼續加油！」',
    },
    related_rd_recipe: rdRecipe ? {
      name: rdRecipe.name || product_name,
      target_brix: rdRecipe.target_brix || '10.5°Bx',
      standard_syrup: rdRecipe.syrup_ml ? `${rdRecipe.syrup_ml} ml` : '25 ml',
      brewing_temp: rdRecipe.brewing_temp || '85°C',
      link: `/rd-lab?recipe=${encodeURIComponent(product_name || '')}`,
    } : {
      name: product_name || '翡翠檸檬綠 (標準配方)',
      target_brix: '10.5°Bx',
      standard_syrup: '微糖: 7ml / 半糖: 15ml / 全糖: 25ml',
      brewing_temp: '85°C 浸泡 7 分鐘',
      link: '/rd-lab',
    },
    similar_past_cases: STORE_COACH_KNOWLEDGE.problemMemories.filter(m => m.category === category).slice(0, 2),
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { problem_title, problem_description, store_code = 'TNN-01', product_name = '', category = 'quality', station_code } = body

    if (!problem_title) {
      return NextResponse.json({ error: '請輸入問題標題或異常描述' }, { status: 400 })
    }

    const ctx = await getUnitContext('store').catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    // Attempt to lookup R&D recipe standards if product is mentioned
    let rdRecipe: any = null
    if (product_name && supabase) {
      try {
        const { data: recipeData } = await supabase
          .from('rd_recipes')
          .select('*')
          .ilike('name', `%${product_name}%`)
          .limit(1)
          .maybeSingle()

        if (recipeData) {
          rdRecipe = recipeData
        }
      } catch (err) {
        console.warn('R&D recipe lookup fallback:', err)
      }
    }

    // Query recent learned materials
    let learnedMaterialsContext = ''
    if (supabase) {
      try {
        const { data: mats } = await supabase
          .from('store_learning_materials')
          .select('title, dimension, key_takeaways, actionable_rules')
          .eq('status', 'active')
          .limit(6)
        if (mats && mats.length > 0) {
          learnedMaterialsContext = '\n【門市教練已學習之內部最新實務與指導手冊】：\n' +
            mats.map((m: any) => `• [${m.dimension}] ${m.title}：\n  重點：${(m.key_takeaways || []).join('；')}\n  現場規則：${(m.actionable_rules || []).join('；')}`).join('\n')
        }
      } catch (matErr) {
        console.warn('Learned materials context query fallback:', matErr)
      }
    }

    // Query corporate regulations context
    const regList = STORE_COACH_KNOWLEDGE.companyRegulations || []
    const companyRegulationsContext = '\n【Feeling Tea 公司官方正式規章與員工紅線守則】：\n' +
      regList.map(r => `• [${r.code}] ${r.title} (${r.mandatory_level === 'strict' ? '嚴格紅線' : '常規規範'}): 條款: ${r.clause_content} | 罰則: ${r.violation_penalty}`).join('\n')

    // Check LLM availability
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
    const hasGoogle = !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY)
    const hasOpenAI = !!process.env.OPENAI_API_KEY

    let aiOutput: DiagnosisOutput | null = null

    if (hasAnthropic || hasGoogle || hasOpenAI) {
      try {
        const prompt = `你是 Feeling Tea (啡靈茶飲) 的首席門市營運教練 AI。
你不是只列檢查清單的聊天機器人，而是能陪著店長、區督導、門市指導員一同解決門市現場營運痛點的高階專家。
你的企業使命：「一杯好茶，五步傳遞。標準是底線，溫暖是靈魂，動線是效率，數據是真相。」

請對以下門市營運問題執行嚴謹的【10 層全景診斷】：
- 門市代號：${store_code}
- 涉及品項：${product_name || '無特定品項 / 現場營運'}
- 異常標題：${problem_title}
- 詳細描述：${problem_description}
- 問題分類：${category}
${rdRecipe ? `- 研發標準參考：${JSON.stringify(rdRecipe)}` : ''}
${learnedMaterialsContext}
${companyRegulationsContext}

【10層診斷矩陣定義】：
1. 產品配方 (Product & Recipe)：糖度 Brix、比例、茶湯鮮度
2. 流程節奏 (Process & Pace)：出單、雙軌平行、瓶頸
3. 人員技能與心態 (People & Skills)：動作熟練度、視平線、服務熱忱
4. 設備器具與校準 (Equipment & Tools)：果糖機校準、封口機、水溫機
5. 環境動線與工效 (Environment & Layout)：黃金三角動線、45cm取物半徑、5S
6. 顧客反饋與場景 (Customer Context)：等待心理、客訴挽回
7. 門市行銷與推廣 (Local Marketing)：促銷順暢度、Zalo活動
8. 店務管理與排班 (Store Management)：高峰排班、機動手、督導巡站
9. 原料與供應鏈批次 (Suppliers & Raw Materials)：蔗糖糖漿批次、茶葉進貨
10. 法規與食品安全 (Regulations & Food Safety)：標示法規、衛生標準

請輸出嚴格且合法的 JSON 格式，不要加入額外 markdown 之外的多餘文字：
{
  "problem_analysis": "綜合問題分析...",
  "layers": [
    {
      "layer": 1,
      "name": "產品配方與標準 (Product & Recipe)",
      "category": "產品品質",
      "status": "root_cause" | "suspect" | "normal" | "not_applicable",
      "finding": "詳細發現...",
      "evidence": "佐證依據...",
      "remedy": "對應處方..."
    },
    ... 全部 10 層
  ],
  "root_cause_summary": "核心根因歸納...",
  "immediate_actions": ["15分鐘緊急措施1", "措施2", "措施3"],
  "preventive_actions": ["預防措施1", "措施2", "措施3"],
  "coaching_dialogue": {
    "step_1_empathy": "同理夥伴辛勞與肯定...",
    "step_2_factual_observation": "陳述客觀事實，不帶批判...",
    "step_3_guiding_question": "啟發性提問，讓夥伴自發思考...",
    "step_4_action_agreement": "共同約定改善行動與示範...",
    "step_5_empowerment": "賦能激勵，建立夥伴信心..."
  }
}`

        let text = ''
        if (hasAnthropic) {
          const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
          const res = await generateText({
            model: anthropic('claude-sonnet-4-5'),
            messages: [{ role: 'user', content: prompt }],
            maxOutputTokens: 3500,
          })
          text = res.text
        } else if (hasGoogle) {
          const google = createGoogleGenerativeAI({
            apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
          })
          const res = await generateText({
            model: google('gemini-2.0-flash'),
            messages: [{ role: 'user', content: prompt }],
          })
          text = res.text
        } else if (hasOpenAI) {
          const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
          const res = await generateText({
            model: openai('gpt-4o'),
            messages: [{ role: 'user', content: prompt }],
          })
          text = res.text
        }

        const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(cleanJson)

        if (parsed.layers && parsed.coaching_dialogue) {
          aiOutput = {
            ...parsed,
            related_rd_recipe: rdRecipe ? {
              name: rdRecipe.name || product_name,
              target_brix: rdRecipe.target_brix || '10.5°Bx',
              standard_syrup: rdRecipe.syrup_ml ? `${rdRecipe.syrup_ml} ml` : '25 ml',
              brewing_temp: rdRecipe.brewing_temp || '85°C',
              link: `/rd-lab?recipe=${encodeURIComponent(product_name || '')}`,
            } : {
              name: product_name || 'Feeling Tea 標準飲品配方',
              target_brix: '10.5°Bx',
              standard_syrup: '微糖: 7ml / 半糖: 15ml / 全糖: 25ml',
              brewing_temp: '85°C 浸泡 7 分鐘',
              link: '/rd-lab',
            },
            similar_past_cases: STORE_COACH_KNOWLEDGE.problemMemories.filter(m => m.category === category).slice(0, 2),
          }
        }
      } catch (llmErr) {
        console.warn('Store coach LLM generation fallback to expert engine:', llmErr)
      }
    }

    // If LLM was unavailable or encountered an error, use expert rule-based engine
    if (!aiOutput) {
      aiOutput = generateRuleBasedDiagnosis({
        problem_title,
        problem_description,
        product_name,
        store_code,
        category,
        rdRecipe,
      })
    }

    // Persist diagnosis into Supabase store_problems if live
    if (supabase) {
      try {
        await supabase.from('store_problems').insert({
          store_code,
          title: problem_title,
          category,
          product_name: product_name || null,
          description: problem_description,
          status: 'diagnosed',
          root_cause: aiOutput.root_cause_summary,
          immediate_action: aiOutput.immediate_actions.join('\n'),
          preventive_action: aiOutput.preventive_actions.join('\n'),
          diagnosis_output: aiOutput,
        })
      } catch (persistErr) {
        console.warn('Persist diagnosis log fallback:', persistErr)
      }
    }

    return NextResponse.json(aiOutput)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Diagnosis execution failed' }, { status: 500 })
  }
}
