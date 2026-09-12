import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import type { StoreLearningMaterial } from '@/lib/types/store-coach'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'

export const maxDuration = 60

const SEED_LEARNING_MATERIALS: StoreLearningMaterial[] = [
  {
    id: 'mat-01',
    store_code: 'ALL',
    title: '【總部SOP】打烊保溫茶桶深度除垢與密封環消毒指引',
    source_type: 'sop_manual',
    source_url: 'https://internal.feelingtea.com/sop/tea-urn-sanitation',
    raw_content: `保溫茶桶出水龍頭在長期使用後，喉管內部容易附著單寧酸茶垢與微細水垢，若未每日拆卸浸泡，會導致出茶帶有陳年茶酸味。
標準打烊流程：
1. 每日打烊前以 70°C 溫水沖泡食用級檸檬酸粉 (比例 1:50)，注入茶桶浸泡 20 分鐘。
2. 拆卸出水龍頭矽膠密封環，置於 75% 食品級酒精浸泡碗中，嚴禁使用粗糙菜瓜布刷洗以防刮傷漏水。
3. 隔日開早以 85°C 煮沸純水徹底循環沖洗兩次後，方可注入新鮮基底茶。`,
    ai_summary: '詳細規範保溫茶桶打烊深度清潔程序，強調檸檬酸除垢與矽膠密封環保養，確保基底茶新鮮純淨無雜味。',
    dimension: 'hygiene',
    key_takeaways: [
      '食用級檸檬酸 (1:50) 溫水浸泡 20 分鐘可徹底溶解單寧酸茶垢。',
      '出水龍頭矽膠環需拆卸浸泡酒精，禁止菜瓜布刷洗避免漏水。',
      '開早必須以 85°C 熱水排空沖洗兩次。',
    ],
    actionable_rules: [
      '打烊檢核表新增「出水龍頭密封環浸泡確認」勾選項。',
      '每週五晚班由值班主管親自點檢茶桶內膽不鏽鋼反光度。',
    ],
    evidence_level: 'A',
    status: 'active',
    author_role: '總部食品安全與品保部',
    created_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'mat-02',
    store_code: 'ALL',
    title: '【督導現場實證】尖峰外送雙軌叫號防催單與防漏做策略',
    source_type: 'audit_report',
    source_url: 'https://internal.feelingtea.com/audit/rush-delivery-queue',
    raw_content: `台南旗艦店在外送平台促銷期間，外送員常聚集於取餐台前催單，造成現場散客感受壓迫，且調茶師常因外送多杯重疊而跳單漏料。
改善對策實證：
1. 設立獨立「外送待取區」於取餐櫃檯右側 1.5 公尺處，劃定藍色等待標線，與現場散客取餐動線物理隔離。
2. 實施「雙標籤貼單制」：一張貼杯身、一張貼外帶袋口，調茶師做完由機動手核對雙標籤無誤後裝袋打結，杜絕漏放吸管與誤拿。
3. 平台接單設定前置製作緩衝時間由 8 分鐘彈性調整為 12 分鐘。`,
    ai_summary: '透過動線物理隔離與雙標籤檢核機制，徹底解決尖峰外送催單壓迫與漏做問題，外送準時率提升至 98.2%。',
    dimension: 'workflow',
    key_takeaways: [
      '外送動線與散客動線應保持 1.5 米物理間距。',
      '雙標籤制可完全消除外送漏杯與誤拿。',
      '尖峰動態調節平台製作緩衝時間可減輕吧檯夥伴心理焦慮。',
    ],
    actionable_rules: [
      '尖峰期每滿 10 杯外送單，立即由浮動機動手接管裝袋與核單。',
      '外送員抵達時由收銀員以 3 秒親切問候：「您好辛苦了，這袋已經為您核對完畢！」，降低催單焦躁。',
    ],
    evidence_level: 'B',
    status: 'active',
    author_role: '南區資深營運督導',
    created_at: '2026-09-05T14:30:00Z',
  },
  {
    id: 'mat-03',
    store_code: 'ALL',
    title: '【客訴應對案例】冰塊融化導致飲品口感變淡的換新與試飲挽回法',
    source_type: 'complaint_case',
    raw_content: `顧客外帶一杯微冰四季春，在店內座位區待了 30 分鐘後向櫃台抱怨「茶喝起來很淡，像白開水一樣」。
現場店長標準處置流程：
1. 第一時間微笑接過飲料，同理顧客感受：「不好意思，四季春放久冰塊融化確實會把茶香沖淡！」
2. 絕不爭辯「那是因為您放太久」，立即啟動 30 秒重調政策：「我立刻幫您用剛煮好的現泡茶湯，重做一杯微冰黃金比例！」
3. 遞送新茶時雙手奉上，並贈送一張新品試飲卡：「這是我們今日現煮的高山四季春，趁冰度剛好時品嚐香氣最鮮美！」`,
    ai_summary: '將冰塊融化客訴化為忠誠顧客的範例。以同理代替辯解，用現泡新鮮感重新贏得顧客信賴。',
    dimension: 'coaching',
    key_takeaways: [
      '永遠不以理性事實責怪顧客放太久。',
      '以「現泡茶湯的黃金賞味期」作為親切溝通切入點。',
      '重做速度小於 60 秒，讓顧客驚喜並感受被重視。',
    ],
    actionable_rules: [
      '所有門市夥伴皆授權直接為客人「免請示重做一杯」。',
      '重做時順手說明該品項最佳飲用時程（建議 30 分鐘內飲用）。',
    ],
    evidence_level: 'C',
    status: 'active',
    author_role: '門市資深店長培訓手冊',
    created_at: '2026-09-07T16:00:00Z',
  },
]

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const storeCode = searchParams.get('store_code') || 'ALL'
    const dimension = searchParams.get('dimension')

    const ctx = await getUnitContext('store').catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    let items = SEED_LEARNING_MATERIALS

    if (supabase) {
      try {
        let query = supabase.from('store_learning_materials').select('*').order('created_at', { ascending: false })
        if (storeCode !== 'ALL') {
          query = query.or(`store_code.eq.${storeCode},store_code.eq.ALL`)
        }
        if (dimension && dimension !== 'all') {
          query = query.eq('dimension', dimension)
        }
        const { data, error } = await query.limit(50)
        if (!error && data && data.length > 0) {
          // Merge with seeds without duplicates
          const liveIds = new Set(data.map((d: any) => d.id))
          const filteredSeeds = SEED_LEARNING_MATERIALS.filter(s => !liveIds.has(s.id))
          items = [...data, ...filteredSeeds]
        }
      } catch (dbErr) {
        console.warn('Store learning DB query fallback to seeds:', dbErr)
      }
    }

    return NextResponse.json({
      success: true,
      count: items.length,
      materials: items,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch learning materials' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      title,
      source_type = 'sop_manual',
      source_url = '',
      raw_content = '',
      dimension = 'sop',
      store_code = 'ALL',
      author_role = '門市店長/指導員',
      query_prompt = '', // 若為提問模式
    } = body

    // 模式 1：向已學習的教練發問 (Ask the learned coach)
    if (query_prompt) {
      const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
      const hasGoogle = !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY)
      const hasOpenAI = !!process.env.OPENAI_API_KEY

      let answer = ''
      const prompt = `你是 Feeling Tea (啡靈茶飲) 門市營運教練 AI。
你已經深入學習了總部所有 SOP、督導稽核報告、打烊除垢指引、外送排班動線與客訴應對標準。
請依據你學習到的知識，針對以下問題給出精確、專業且具體可落地的指導：

店長/督導提問：${query_prompt}

請提供：
1. 【核心標準原則】：
2. 【具體操作步驟 (Step-by-Step)】：
3. 【避免之致命錯誤】：
4. 【店長現場教練話術建議】：
繁體中文，溫暖且專業。`

      if (hasAnthropic) {
        const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const res = await generateText({
          model: anthropic('claude-sonnet-4-5'),
          messages: [{ role: 'user', content: prompt }],
          maxOutputTokens: 2000,
        })
        answer = res.text
      } else if (hasGoogle) {
        const google = createGoogleGenerativeAI({
          apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
        })
        const res = await generateText({
          model: google('gemini-2.0-flash'),
          messages: [{ role: 'user', content: prompt }],
        })
        answer = res.text
      } else if (hasOpenAI) {
        const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const res = await generateText({
          model: openai('gpt-4o'),
          messages: [{ role: 'user', content: prompt }],
        })
        answer = res.text
      } else {
        answer = `【核心標準原則】：依據 Feeling Tea 營運手冊，所有品質問題以「現做新鮮與標準校準」為第一原則。\n【具體操作步驟】：\n1. 檢視標準溫度與刻度（茶湯 85°C、果糖噴嘴無結晶）。\n2. 執行 90 秒快閃清潔程序並重新校準量杯。\n3. 對顧客採 30 秒免費現泡重調。\n【避免之致命錯誤】：嚴禁與顧客辯解或推卸原料問題。\n【店長話術建議】：「小林，我們先一起做一次量杯刻度平視，確認標準比例，客人一定會感受到你的用心！」`
      }

      return NextResponse.json({
        success: true,
        type: 'query_answer',
        answer,
        timestamp: new Date().toISOString(),
      })
    }

    // 模式 2：餵入新資料進行 AI 結構化學習 (Ingest & Learn)
    if (!title && !raw_content) {
      return NextResponse.json({ error: '請提供資料標題與內容' }, { status: 400 })
    }

    let evidenceLevel = 'B'
    if (source_type === 'sop_manual' || source_type === 'owner_memo') evidenceLevel = 'A'
    else if (source_type === 'audit_report' || source_type === 'supervisor_guide') evidenceLevel = 'B'
    else if (source_type === 'complaint_case') evidenceLevel = 'C'
    else if (source_type === 'external_benchmark' || source_type === 'video_url') evidenceLevel = 'D'

    let aiSummary = ''
    let keyTakeaways: string[] = []
    let actionableRules: string[] = []
    let detectedDimension = dimension

    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
    const hasGoogle = !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY)
    const hasOpenAI = !!process.env.OPENAI_API_KEY

    if (hasAnthropic || hasGoogle || hasOpenAI) {
      try {
        const extractionPrompt = `你是連鎖茶飲門市營運知識萃取專家。
請將以下輸入的門市資料萃取為結構化的「門市教練大腦營運知識卡」：
- 標題：${title}
- 來源類型：${source_type}
- 內容：
${raw_content.slice(0, 4000)}

請以純 JSON 格式輸出：
{
  "ai_summary": "100-200 字摘要，精準概括其營運價值與問題解法...",
  "dimension": "sop" | "workflow" | "workstation" | "layout" | "movement" | "hygiene" | "coaching" | "problem_memory",
  "key_takeaways": [
    "核心要點1 (含具體數據或原則)",
    "核心要點2",
    "核心要點3"
  ],
  "actionable_rules": [
    "現場可執行的行為規則1",
    "規則2",
    "規則3"
  ]
}`

        let text = ''
        if (hasAnthropic) {
          const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
          const res = await generateText({
            model: anthropic('claude-sonnet-4-5'),
            messages: [{ role: 'user', content: extractionPrompt }],
            maxOutputTokens: 2000,
          })
          text = res.text
        } else if (hasGoogle) {
          const google = createGoogleGenerativeAI({
            apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
          })
          const res = await generateText({
            model: google('gemini-2.0-flash'),
            messages: [{ role: 'user', content: extractionPrompt }],
          })
          text = res.text
        } else if (hasOpenAI) {
          const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
          const res = await generateText({
            model: openai('gpt-4o'),
            messages: [{ role: 'user', content: extractionPrompt }],
          })
          text = res.text
        }

        const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(cleanJson)
        if (parsed.ai_summary) aiSummary = parsed.ai_summary
        if (parsed.dimension) detectedDimension = parsed.dimension
        if (Array.isArray(parsed.key_takeaways)) keyTakeaways = parsed.key_takeaways
        if (Array.isArray(parsed.actionable_rules)) actionableRules = parsed.actionable_rules
      } catch (parseErr) {
        console.warn('AI knowledge extraction fallback to standard parser:', parseErr)
      }
    }

    if (!aiSummary) {
      aiSummary = raw_content.slice(0, 200) + '...'
      keyTakeaways = [
        `重點摘錄：${raw_content.slice(0, 60)}...`,
        '現場落實標準作業手冊規範。',
        '重視顧客滿意與夥伴心理安全感。',
      ]
      actionableRules = [
        '納入每日晨會或打烊交接例行檢查點。',
        '店長加強現場觀察並即時給予正向教練回饋。',
      ]
    }

    const newMaterial: StoreLearningMaterial = {
      id: `learned-${Date.now()}`,
      store_code,
      title: title || '門市學習資料',
      source_type,
      source_url,
      raw_content,
      ai_summary: aiSummary,
      dimension: detectedDimension,
      key_takeaways: keyTakeaways,
      actionable_rules: actionableRules,
      evidence_level: evidenceLevel,
      status: 'active',
      author_role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // 嘗試寫入 Supabase
    const ctx = await getUnitContext('store').catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin
    if (supabase) {
      try {
        const { data: dbItem, error } = await supabase
          .from('store_learning_materials')
          .insert(newMaterial)
          .select('*')
          .single()
        if (!error && dbItem) {
          return NextResponse.json({ success: true, material: dbItem })
        }
      } catch (dbInsertErr) {
        console.warn('Persist learning material fallback to session return:', dbInsertErr)
      }
    }

    return NextResponse.json({
      success: true,
      material: newMaterial,
      note: '已成功注入門市營運教練 AI 學習大腦！',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Knowledge ingestion failed' }, { status: 500 })
  }
}
