// 可執行 skill 註冊表
// 每個 skill = 一份定義：UI 表單欄位 + 計價（點數）+ run()。
// run() 透過 ctx 取得模型呼叫與圖片生成能力，與既有 marketing 基礎一致。
import pptxgen from 'pptxgenjs'

export type SkillCategory = 'copywriting' | 'video' | 'illustration' | 'research' | 'audio' | 'presentation'

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
  // 文字轉語音（fal-ai TTS），回傳音檔 URL
  generateAudio: (text: string, voice?: string) => Promise<string>
  // 上傳檔案至 storage，回傳公開下載 URL
  storeFile: (bytes: Uint8Array, filename: string, contentType: string) => Promise<string>
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

// ──────────────────────────────────────────────────────────────────────────
// 6. 商品影片企劃師（分鏡 + 影片 prompt + 配音稿 + 關鍵視覺參考圖）
//    註：實際影片渲染為非同步流程，請至既有影片生成功能提交；本 skill 產出可直接餵入的企劃包。
// ──────────────────────────────────────────────────────────────────────────
const productVideoCreator: SkillDef = {
  id: 'product-video-creator',
  label: '商品影片企劃師',
  description: '產出商品影片分鏡、影片生成 prompt、配音稿，並生成 1 張關鍵視覺參考圖。',
  category: 'video',
  module: 'marketing',
  priceCredits: 0.05,
  fields: [
    { name: 'product', label: '商品名稱', type: 'text', required: true },
    { name: 'features', label: '賣點 / 規格', type: 'textarea', required: true },
    { name: 'duration', label: '影片長度（秒）', type: 'number', default: 15 },
    { name: 'aspectRatio', label: '畫面比例', type: 'select', default: '9:16', options: [
      { value: '9:16', label: '9:16 直式（短影音）' },
      { value: '16:9', label: '16:9 橫式' },
      { value: '1:1', label: '1:1 方形' },
    ] },
  ],
  estimateCost() {
    return 0.05 + IMAGE_UNIT_COST
  },
  async run(input, ctx) {
    const aspectRatio = str(input, 'aspectRatio', '9:16')
    const { text, inputTokens, outputTokens } = await ctx.callModel({
      system: '你是商品影片導演，熟悉 AI 影片生成（kling / veo）的 prompt 寫法。輸出需含：①分鏡表（時間軸/畫面描述/運鏡）②每個鏡頭可直接使用的英文影片生成 prompt ③配音逐字稿。最後另起一行輸出「KEY_VISUAL:」加上一段適合生成關鍵視覺的英文圖片 prompt。',
      prompt: `請為以下商品規劃一支約 ${num(input, 'duration', 15)} 秒、${aspectRatio} 的商品影片：

商品名稱：${str(input, 'product')}
賣點/規格：${str(input, 'features')}`,
      maxOutputTokens: 2000,
    })

    // 取出關鍵視覺 prompt 並生成參考圖
    let imageUrl = ''
    const m = text.match(/KEY_VISUAL:\s*(.+)/i)
    const visualPrompt = m?.[1]?.trim() || `${str(input, 'product')} product commercial key visual, studio lighting`
    try {
      imageUrl = await ctx.generateImage(visualPrompt, aspectRatio)
    } catch {
      imageUrl = ''
    }

    const planText = text.replace(/KEY_VISUAL:\s*.+/i, '').trim()
    const output = imageUrl
      ? `${planText}\n\n【關鍵視覺參考圖】\n${imageUrl}`
      : planText

    return {
      output,
      data: { imageUrl, visualPrompt, inputTokens, outputTokens },
      extraCredits: imageUrl ? IMAGE_UNIT_COST : 0,
    }
  },
}

// ──────────────────────────────────────────────────────────────────────────
// 7. 電商帶貨短影片腳本
// ──────────────────────────────────────────────────────────────────────────
const ecommerceVideoMarketing: SkillDef = {
  id: 'ecommerce-video-marketing',
  label: '電商帶貨短影片腳本',
  description: '產出帶貨短影片腳本：口播、節奏、CTA 與平台投放建議。',
  category: 'video',
  module: 'marketing',
  priceCredits: 0.03,
  fields: [
    { name: 'product', label: '商品 / 服務', type: 'text', required: true },
    { name: 'sellingPoints', label: '主打賣點 / 優惠', type: 'textarea', required: true },
    { name: 'platform', label: '投放平台', type: 'select', default: 'tiktok', options: [
      { value: 'tiktok', label: '抖音 / TikTok' },
      { value: 'reels', label: 'Instagram Reels' },
      { value: 'shorts', label: 'YouTube Shorts' },
      { value: 'shopee', label: '蝦皮直播 / 影片' },
    ] },
  ],
  async run(input, ctx) {
    const { text, inputTokens, outputTokens } = await ctx.callModel({
      system: '你是電商帶貨短影片操盤手，擅長高轉換的口播腳本。輸出需含：①3 個前 3 秒鉤子 ②完整口播逐字稿（含節奏與情緒提示）③畫面建議 ④結尾促購 CTA ⑤該平台投放與 hashtag 建議。',
      prompt: `請為以下商品撰寫帶貨短影片腳本：

商品/服務：${str(input, 'product')}
主打賣點/優惠：${str(input, 'sellingPoints')}
投放平台：${str(input, 'platform', 'tiktok')}`,
      maxOutputTokens: 2000,
    })
    return { output: text, data: { inputTokens, outputTokens } }
  },
}

// ──────────────────────────────────────────────────────────────────────────
// 8. AI 語音配音（TTS）
// ──────────────────────────────────────────────────────────────────────────
const ttsVoiceSynthesis: SkillDef = {
  id: 'tts-voice-synthesis',
  label: 'AI 語音配音',
  description: '將文字稿合成為語音配音，回傳可下載的音檔。',
  category: 'audio',
  module: 'marketing',
  priceCredits: 0.03,
  fields: [
    { name: 'text', label: '配音文字稿', type: 'textarea', required: true, placeholder: '貼上要配音的文字…' },
    { name: 'voice', label: '音色', type: 'select', default: 'default', options: [
      { value: 'default', label: '預設' },
      { value: 'female', label: '女聲' },
      { value: 'male', label: '男聲' },
    ] },
  ],
  async run(input, ctx) {
    const text = str(input, 'text')
    if (!text.trim()) return { output: '請提供配音文字稿。' }
    let audioUrl = ''
    try {
      audioUrl = await ctx.generateAudio(text, str(input, 'voice', 'default'))
    } catch (err) {
      return { output: `語音合成失敗：${String(err)}` }
    }
    return {
      output: audioUrl ? `【配音音檔】\n${audioUrl}` : '語音合成未回傳音檔。',
      data: { audioUrl },
    }
  },
}

// ──────────────────────────────────────────────────────────────────────────
// 9. 簡報生成（PPTX）
//    LLM 規劃投影片結構 → pptxgenjs 產出 .pptx → 上傳 storage 回傳下載連結
// ──────────────────────────────────────────────────────────────────────────
interface SlideSpec { title: string; bullets: string[] }

const pptGenerator: SkillDef = {
  id: 'ppt-generator',
  label: '簡報生成（PPTX）',
  description: '依主題自動規劃投影片並產出可下載的 .pptx 簡報檔。',
  category: 'presentation',
  module: 'marketing',
  priceCredits: 0.05,
  fields: [
    { name: 'topic', label: '簡報主題', type: 'text', required: true, placeholder: '例：2026 年品牌行銷策略' },
    { name: 'context', label: '內容重點 / 補充資料', type: 'textarea', placeholder: '要涵蓋的重點、數據、章節…' },
    { name: 'numSlides', label: '投影片張數', type: 'number', default: 8 },
    { name: 'audience', label: '對象', type: 'text', placeholder: '例：主管、客戶、投資人' },
  ],
  async run(input, ctx) {
    const n = Math.max(3, Math.min(20, num(input, 'numSlides', 8)))
    const topic = str(input, 'topic')

    // ① LLM 規劃投影片結構（JSON）
    const { text, inputTokens, outputTokens } = await ctx.callModel({
      system: '你是簡報架構師。請只輸出 JSON 陣列，每個元素為 { "title": string, "bullets": string[] }，bullets 每張 3-5 點、精煉有力。第一張為封面（title=簡報標題、bullets 可含副標/講者），最後一張為結語/CTA。',
      prompt: `請規劃一份共 ${n} 張投影片的簡報，輸出 JSON 陣列：

主題：${topic}
內容重點：${str(input, 'context', '（請依主題自行充實）')}
對象：${str(input, 'audience', '一般聽眾')}`,
      maxOutputTokens: 2500,
    })

    let slides: SlideSpec[] = []
    try {
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        slides = (JSON.parse(match[0]) as unknown[])
          .filter((s): s is SlideSpec =>
            !!s && typeof (s as SlideSpec).title === 'string')
          .map(s => ({ title: String(s.title), bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : [] }))
      }
    } catch {
      slides = []
    }
    if (slides.length === 0) {
      return { output: '簡報結構解析失敗，請再試一次或補充內容重點。' }
    }
    slides = slides.slice(0, n)

    // ② 用 pptxgenjs 產出 .pptx
    const pptx = new pptxgen()
    pptx.layout = 'LAYOUT_WIDE'
    pptx.defineSlideMaster({ title: 'MAIN', background: { color: 'FFFFFF' } })

    slides.forEach((s, idx) => {
      const slide = pptx.addSlide()
      if (idx === 0) {
        slide.background = { color: '1E293B' }
        slide.addText(s.title, { x: 0.6, y: 2.0, w: '90%', h: 1.5, fontSize: 40, bold: true, color: 'FFFFFF' })
        if (s.bullets.length) {
          slide.addText(s.bullets.join('\n'), { x: 0.6, y: 3.6, w: '90%', h: 1.5, fontSize: 18, color: 'CBD5E1' })
        }
      } else {
        slide.addText(s.title, { x: 0.5, y: 0.4, w: '92%', h: 0.9, fontSize: 28, bold: true, color: '1E293B' })
        if (s.bullets.length) {
          slide.addText(
            s.bullets.map(b => ({ text: b, options: { bullet: true } })),
            { x: 0.7, y: 1.6, w: '88%', h: 4.5, fontSize: 18, color: '334155', lineSpacingMultiple: 1.2 },
          )
        }
      }
    })

    const out = await pptx.write({ outputType: 'nodebuffer' })
    const bytes = out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer)

    const safeTopic = topic.replace(/[^a-zA-Z0-9一-龥._-]/g, '_').slice(0, 40) || 'presentation'
    const filename = `${Date.now()}_${safeTopic}.pptx`
    const url = await ctx.storeFile(
      bytes,
      filename,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    )

    const outline = slides.map((s, i) => `${i + 1}. ${s.title}`).join('\n')
    return {
      output: `已生成 ${slides.length} 張投影片簡報。\n\n【大綱】\n${outline}\n\n【下載】\n${url}`,
      data: { url, slides, inputTokens, outputTokens },
    }
  },
}

export const SKILLS: Record<string, SkillDef> = {
  [ecommerceCopywriter.id]: ecommerceCopywriter,
  [productMarketingCopywriter.id]: productMarketingCopywriter,
  [viralVideoCopywriting.id]: viralVideoCopywriting,
  [articleIllustrator.id]: articleIllustrator,
  [marketResearchReports.id]: marketResearchReports,
  [productVideoCreator.id]: productVideoCreator,
  [ecommerceVideoMarketing.id]: ecommerceVideoMarketing,
  [ttsVoiceSynthesis.id]: ttsVoiceSynthesis,
  [pptGenerator.id]: pptGenerator,
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
