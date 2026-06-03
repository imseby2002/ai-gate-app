// 可執行 skill 註冊表（第一批）
// 每個 skill = 一份定義：UI 表單欄位 + 計價（點數）+ run()。
// run() 透過 ctx 取得模型呼叫與圖片生成能力，與既有 marketing 基礎一致。

export type SkillCategory = 'copywriting' | 'video' | 'illustration' | 'research'

export interface SkillField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'number'
  required?: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
  default?: string | number
}

export interface SkillRunContext {
  // 呼叫 LLM（claude-sonnet-4-6），回傳文字與用量
  callModel: (opts: {
    system: string
    prompt: string
    maxOutputTokens?: number
  }) => Promise<{ text: string; inputTokens: number; outputTokens: number }>
  // 生成圖片（fal-ai），回傳圖片 URL
  generateImage: (prompt: string, aspectRatio?: string) => Promise<string>
}

export interface SkillResult {
  output: string
  data?: Record<string, unknown>
  // 動態加扣點數（例如實際生成的圖片張數）
  extraCredits?: number
}

export interface SkillDef {
  id: string
  label: string
  description: string
  category: SkillCategory
  module: 'marketing'
  // 基礎固定扣點（單位與 credit_transactions.amount_usd 相同）
  priceCredits: number
  fields: SkillField[]
  // 預估本次最大花費（用於執行前餘額檢查），預設 = priceCredits
  estimateCost?: (input: Record<string, unknown>) => number
  run: (input: Record<string, unknown>, ctx: SkillRunContext) => Promise<SkillResult>
}

// 配圖每張成本（fal flux/dev，與 api/image/generate 一致）
const IMAGE_UNIT_COST = 0.05

function str(input: Record<string, unknown>, key: string, fallback = ''): string {
  const v = input[key]
  return typeof v === 'string' ? v : v == null ? fallback : String(v)
}

function num(input: Record<string, unknown>, key: string, fallback: number): number {
  const v = Number(input[key])
  return Number.isFinite(v) ? v : fallback
}

// ──────────────────────────────────────────────────────────────────────────
// 1. 電商商品文案
// ──────────────────────────────────────────────────────────────────────────
const ecommerceCopywriter: SkillDef = {
  id: 'ecommerce-copywriter',
  label: '電商商品文案',
  description: '依商品資訊產出可直接上架的商品描述（賣點、規格、情境）。',
  category: 'copywriting',
  module: 'marketing',
  priceCredits: 0.02,
  fields: [
    { name: 'productName', label: '商品名稱', type: 'text', required: true, placeholder: '例：保溫不鏽鋼隨行杯 500ml' },
    { name: 'features', label: '賣點 / 規格', type: 'textarea', required: true, placeholder: '材質、容量、保溫時數、適用情境…' },
    { name: 'audience', label: '目標客群', type: 'text', placeholder: '例：通勤上班族、健身族群' },
    { name: 'tone', label: '語氣', type: 'select', default: 'professional', options: [
      { value: 'professional', label: '專業可信' },
      { value: 'warm', label: '親切溫暖' },
      { value: 'playful', label: '活潑趣味' },
    ] },
  ],
  async run(input, ctx) {
    const { text, inputTokens, outputTokens } = await ctx.callModel({
      system: '你是頂尖電商商品文案撰寫人，擅長把規格轉化為打動人心的賣點，文案需具體、可信、促進轉換，符合台灣電商平台習慣。',
      prompt: `請為以下商品撰寫上架文案，包含：①一句吸睛標題 ②3-5 個條列賣點 ③一段情境式商品描述（150-250字）④規格整理。

商品名稱：${str(input, 'productName')}
賣點/規格：${str(input, 'features')}
目標客群：${str(input, 'audience', '一般消費者')}
語氣：${str(input, 'tone', 'professional')}`,
      maxOutputTokens: 1500,
    })
    return { output: text, data: { inputTokens, outputTokens } }
  },
}

// ──────────────────────────────────────────────────────────────────────────
// 2. 行銷推廣文案
// ──────────────────────────────────────────────────────────────────────────
const productMarketingCopywriter: SkillDef = {
  id: 'product-marketing-copywriter',
  label: '行銷推廣文案',
  description: '針對廣告 / 促銷活動產出多版本行銷文案與廣告標題。',
  category: 'copywriting',
  module: 'marketing',
  priceCredits: 0.02,
  fields: [
    { name: 'product', label: '商品 / 服務', type: 'text', required: true },
    { name: 'campaign', label: '活動 / 主題', type: 'text', placeholder: '例：母親節限時 8 折' },
    { name: 'platform', label: '投放平台', type: 'select', default: 'facebook', options: [
      { value: 'facebook', label: 'Facebook' },
      { value: 'instagram', label: 'Instagram' },
      { value: 'line', label: 'LINE' },
      { value: 'google', label: 'Google 搜尋廣告' },
    ] },
    { name: 'usp', label: '核心優勢', type: 'textarea', placeholder: '與競品的差異、限時優惠…' },
  ],
  async run(input, ctx) {
    const { text, inputTokens, outputTokens } = await ctx.callModel({
      system: '你是頂尖行銷文案與廣告操盤手，產出的文案需訴求明確、CTA 強烈，並符合各平台格式與字數規範。',
      prompt: `請為以下行銷活動產出：①5 組不同訴求的廣告標題（痛點/好奇/利益/恐懼/社會認同）②2 版完整推廣貼文 ③一組行動呼籲（CTA）。

商品/服務：${str(input, 'product')}
活動/主題：${str(input, 'campaign', '日常推廣')}
投放平台：${str(input, 'platform', 'facebook')}
核心優勢：${str(input, 'usp')}`,
      maxOutputTokens: 1800,
    })
    return { output: text, data: { inputTokens, outputTokens } }
  },
}

// ──────────────────────────────────────────────────────────────────────────
// 3. 短影音爆款腳本
// ──────────────────────────────────────────────────────────────────────────
const viralVideoCopywriting: SkillDef = {
  id: 'viral-video-copywriting',
  label: '短影音爆款腳本',
  description: '產出短影音（Reels / 抖音 / Shorts）的鉤子、分鏡腳本與口播。',
  category: 'video',
  module: 'marketing',
  priceCredits: 0.02,
  fields: [
    { name: 'topic', label: '影片主題', type: 'text', required: true, placeholder: '例：3 招快速收納小廚房' },
    { name: 'product', label: '置入商品 / 服務', type: 'text' },
    { name: 'duration', label: '影片長度（秒）', type: 'number', default: 30 },
    { name: 'style', label: '風格', type: 'select', default: 'energetic', options: [
      { value: 'energetic', label: '快節奏帶動' },
      { value: 'storytelling', label: '故事敘事' },
      { value: 'educational', label: '知識乾貨' },
    ] },
  ],
  async run(input, ctx) {
    const { text, inputTokens, outputTokens } = await ctx.callModel({
      system: '你是短影音爆款腳本專家，深諳前 3 秒鉤子、節奏與留人技巧，輸出需含鏡頭分鏡與口播逐字稿。',
      prompt: `請產出一支約 ${num(input, 'duration', 30)} 秒短影音腳本，包含：①3 個可選的前 3 秒鉤子 ②分鏡表（時間軸 / 畫面 / 口播）③結尾 CTA ④建議的 hashtag。

影片主題：${str(input, 'topic')}
置入商品/服務：${str(input, 'product', '無')}
風格：${str(input, 'style', 'energetic')}`,
      maxOutputTokens: 1800,
    })
    return { output: text, data: { inputTokens, outputTokens } }
  },
}

// ──────────────────────────────────────────────────────────────────────────
// 4. 文章自動配圖
// ──────────────────────────────────────────────────────────────────────────
const articleIllustrator: SkillDef = {
  id: 'article-illustrator',
  label: '文章自動配圖',
  description: '解析文章內容，產生每段配圖提示詞並生成圖片。',
  category: 'illustration',
  module: 'marketing',
  priceCredits: 0.02,
  fields: [
    { name: 'article', label: '文章內容', type: 'textarea', required: true, placeholder: '貼上文章全文…' },
    { name: 'numImages', label: '配圖張數', type: 'number', default: 3 },
    { name: 'aspectRatio', label: '圖片比例', type: 'select', default: '16:9', options: [
      { value: '16:9', label: '16:9 橫式' },
      { value: '1:1', label: '1:1 方形' },
      { value: '9:16', label: '9:16 直式' },
    ] },
  ],
  estimateCost(input) {
    const n = Math.max(1, Math.min(6, num(input, 'numImages', 3)))
    return 0.02 + n * IMAGE_UNIT_COST
  },
  async run(input, ctx) {
    const n = Math.max(1, Math.min(6, num(input, 'numImages', 3)))
    const aspectRatio = str(input, 'aspectRatio', '16:9')

    // ① LLM 產出每張配圖的英文提示詞（JSON 陣列）
    const { text, inputTokens, outputTokens } = await ctx.callModel({
      system: '你是專業的視覺編輯，會依文章重點規劃配圖。請只輸出 JSON 陣列，每個元素是一個適合 AI 生圖的英文 prompt（具體、攝影/插畫風格描述），數量需符合要求。',
      prompt: `請為以下文章規劃 ${n} 張配圖，輸出 JSON 陣列（僅 prompt 字串）：\n\n${str(input, 'article').slice(0, 4000)}`,
      maxOutputTokens: 800,
    })

    let prompts: string[] = []
    try {
      const match = text.match(/\[[\s\S]*\]/)
      if (match) prompts = JSON.parse(match[0]).filter((p: unknown) => typeof p === 'string')
    } catch {
      prompts = []
    }
    if (prompts.length === 0) prompts = [str(input, 'article').slice(0, 200)]
    prompts = prompts.slice(0, n)

    // ② 逐張生成圖片
    const images: { prompt: string; url: string }[] = []
    for (const p of prompts) {
      try {
        const url = await ctx.generateImage(p, aspectRatio)
        if (url) images.push({ prompt: p, url })
      } catch {
        // 單張失敗略過，不中斷整批
      }
    }

    const output = images.length
      ? images.map((im, i) => `【圖 ${i + 1}】${im.prompt}\n${im.url}`).join('\n\n')
      : '圖片生成失敗，請稍後再試。'

    return {
      output,
      data: { images, inputTokens, outputTokens },
      // 實際成功張數計費
      extraCredits: images.length * IMAGE_UNIT_COST,
    }
  },
}

// ──────────────────────────────────────────────────────────────────────────
// 5. 市場研究報告
// ──────────────────────────────────────────────────────────────────────────
const marketResearchReports: SkillDef = {
  id: 'market-research-reports',
  label: '市場研究報告',
  description: '產出結構化市場 / 競品分析報告。',
  category: 'research',
  module: 'marketing',
  priceCredits: 0.08,
  fields: [
    { name: 'topic', label: '研究主題 / 產業', type: 'text', required: true, placeholder: '例：台灣手沖咖啡器材市場' },
    { name: 'competitors', label: '主要競品', type: 'textarea', placeholder: '已知的競爭品牌（選填）' },
    { name: 'focus', label: '分析重點', type: 'select', default: 'overview', options: [
      { value: 'overview', label: '市場總覽' },
      { value: 'competitor', label: '競品分析' },
      { value: 'entry', label: '進入策略' },
    ] },
  ],
  async run(input, ctx) {
    const { text, inputTokens, outputTokens } = await ctx.callModel({
      system: '你是資深市場研究分析師，輸出需結構化、條理分明，包含資料化的洞察與可執行建議。請以繁體中文撰寫。',
      prompt: `請針對以下主題撰寫市場研究報告，包含：①市場概況與規模 ②目標客群輪廓 ③競品分析（定位/優劣勢）④市場趨勢與機會 ⑤具體行動建議。

研究主題/產業：${str(input, 'topic')}
主要競品：${str(input, 'competitors', '（未提供，請依產業推估）')}
分析重點：${str(input, 'focus', 'overview')}`,
      maxOutputTokens: 4000,
    })
    return { output: text, data: { inputTokens, outputTokens } }
  },
}

export const SKILLS: Record<string, SkillDef> = {
  [ecommerceCopywriter.id]: ecommerceCopywriter,
  [productMarketingCopywriter.id]: productMarketingCopywriter,
  [viralVideoCopywriting.id]: viralVideoCopywriting,
  [articleIllustrator.id]: articleIllustrator,
  [marketResearchReports.id]: marketResearchReports,
}

export function getSkill(id: string): SkillDef | undefined {
  return SKILLS[id]
}

// 給前端列表用的精簡資訊（不含 run）
export function listSkills() {
  return Object.values(SKILLS).map(s => ({
    id: s.id,
    label: s.label,
    description: s.description,
    category: s.category,
    priceCredits: s.priceCredits,
    fields: s.fields,
  }))
}
