import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { summarizeAuditChat } from '@/lib/audit/summarize'

export const maxDuration = 60

async function ctx() {
  const c = await getUnitContextAny(['audit', 'store', 'rd'])
  return c.ok ? c : null
}
const s = (v: unknown) => String(v ?? '').trim()

// 將合理性分析數據壓成文字供 AI 參考
function analysisText(a: unknown): string {
  if (!a || typeof a !== 'object') return ''
  const o = a as Record<string, unknown>
  const rows = Array.isArray(o.rows) ? o.rows as Record<string, unknown>[] : []
  const cc = (o.cross_checks ?? {}) as Record<string, unknown>
  const po = (o.possibility ?? {}) as Record<string, unknown>
  const top = rows.filter(r => r.over).slice(0, 20)
    .map(r => `${r.material_name}：規定 ${r.expected}／實耗 ${r.actual}／誤差 ${r.pct === null ? '—' : Math.round(Number(r.pct)) + '%'}／金額損失 ${Math.round(Number(r.money_loss) || 0)}`).join('\n')
  let out = `【原物料合理性分析（門檻 ${o.threshold}%，超標 ${o.over_count} 項，估計金額損失 ${Math.round(Number(o.total_loss) || 0)}）】\n`
  if (top) out += `超標原料：\n${top}\n`
  if (cc.configured) out += `交叉檢核：售出杯數 ${cc.cups_sold}、杯子實耗 ${cc.cup_used}、茶實耗 ${cc.tea_used}、奶精實耗 ${cc.creamer_used}、由茶反推杯數 ${cc.implied_cups_tea}\n`
  if (po.configured && po.has_displacement) out += `加料排擠：茶少用 ${Math.round(Number(po.tea_explained) || 0)}、奶精少用 ${Math.round(Number(po.creamer_explained) || 0)}、額外加料份數 ${Math.round(Number(po.extra_topping_servings) || 0)}\n`
  return out.slice(0, 5000)
}

const MODE_PROMPT: Record<string, string> = {
  discuss: `【模式：討論式（預設）】
請以資深稽核總監與動線流程顧問的角度，帶著稽核人員一起思考與探討問題本質。
請勿直接丟出標準答案，而是多用啟發式提問、分析利弊（如人體工學是否增加轉身彎腰次數、是否形成水吧動線交叉、擺設美觀與顧客觀感），引導稽核人員與現場店長共同找出最佳解。`,
  guide: `【模式：導引式】
請扮演現場督導教練，以結構化步驟循序引導稽核人員推進檢查：
清楚指出「第一步應先核對什麼、第二步查證什麼、第三步注意哪些安全規範」，協助新手或現場稽核人員不漏掉任何關鍵細節。`,
}

const SUGGEST_PROMPT = `【建議與答案功能已開啟】
請在回覆內文探討完畢後，另起一行輸出明確的分隔線：
===建議===
其後請條列 3–5 點精煉、具體可落地執行的「改善答案或規範建議」（此區會獨立呈現在右側 1/3 建議看板，供稽核人員與研發人員直接參考、追問或採納）。`

// 載入稽核訓練知識庫（SOP、人體工學、動線擺設、規章）
async function loadKnowledge(admin: any, ownerId: string): Promise<string> {
  const { data: know } = await admin.from('audit_knowledge')
    .select('kind, title, content')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(40)
  if (!know || know.length === 0) return ''
  let out = '\n=== 稽核專家知識庫（公司內部 SOP、動線擺設與法規訓練資料）===\n'
  for (const k of know) {
    const item = `【${k.kind}】${k.title}：${k.content}\n`
    if (out.length + item.length > 6000) break
    out += item
  }
  return out
}

// 稽核 AI 對談。body: { chat_id?, store, message, mode?, suggest?, photo_url?, analysis? }
export async function POST(req: NextRequest) {
  const c = await ctx()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 400 })

  const b = await req.json().catch(() => ({}))
  const message = s(b.message)
  const store = s(b.store)
  const mode = b.mode === 'guide' ? 'guide' : 'discuss'
  const suggest = !!b.suggest
  const photoUrl = s(b.photo_url)

  if (!message && !photoUrl) return NextResponse.json({ error: '訊息或照片必填' }, { status: 400 })

  // 對話
  let chatId = s(b.chat_id)
  if (chatId) {
    const { data } = await c.admin.from('audit_chats').select('id').eq('id', chatId).eq('owner_id', c.ownerId).single()
    if (!data) chatId = ''
  }
  if (!chatId) {
    const titleText = (message || '現場照片巡檢討論').slice(0, 30)
    const { data, error } = await c.admin.from('audit_chats')
      .insert({ owner_id: c.ownerId, store, title: titleText, mode })
      .select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    chatId = data.id
  }

  // 儲存使用者提問（含照片）
  await c.admin.from('audit_messages').insert({
    chat_id: chatId,
    owner_id: c.ownerId,
    role: 'user',
    content: message || '（上傳現場巡檢照片並請求專家診斷）',
    photo_url: photoUrl,
  })

  // 硬性規定（該門市＋全門市通用）
  const { data: rules } = await c.admin.from('audit_rules')
    .select('rule, store, active').eq('owner_id', c.ownerId).eq('active', true).or(`store.eq.${store},store.eq.`)
  const ruleText = (rules ?? []).map((r: any, i: number) => `${i + 1}. ${r.rule}${r.store ? `（限 ${r.store}）` : ''}`).join('\n')

  const knowledgeText = await loadKnowledge(c.admin, c.ownerId)

  // 取近期歷史訊息
  const { data: hist } = await c.admin.from('audit_messages')
    .select('role, content, photo_url')
    .eq('chat_id', chatId)
    .eq('owner_id', c.ownerId)
    .order('created_at')
    .limit(20)

  const system = `你是具備連鎖手搖飲與餐飲營運現場實戰經驗的【資深稽核暨門市動線人體工學專家顧問】。
你的專業領域涵蓋：
1. 門市吧台出餐動線優化、人體工學（減少頻繁轉身、彎腰、交叉手臂、預防職業傷害）
2. 設備與物料擺放美觀、整潔標準（生熟分區、抹布定位、器具防污染、隨手清 Clean-as-you-go）
3. 食品品質與原料安全（嚴禁按「作廢」卻偷偷使用之嚴重舞弊、過期檢核、糖度溫度標準公差）
4. 原物料消耗與合理性分析（交叉推算加料排擠、抓私購幽靈原料）
5. 門市行銷與公務機規範（防私群拉客、防飛單、官方 QR Code 白名單）

請一律以繁體中文專業、清晰、客觀回答。
${MODE_PROMPT[mode]}
${suggest ? '\n' + SUGGEST_PROMPT : ''}
${ruleText ? `\n【已定案的硬性規定（務必嚴格遵循）】\n${ruleText}\n` : ''}
${knowledgeText}
${analysisText(b.analysis)}

若稽核人員明確要求「把某項設為硬性規定/定案規定」，請在回覆最後另起一行輸出：
===規則===
其後只放一句精練、可重複套用的規則文字（系統會自動存入硬性規定庫）。`

  // 整理訊息陣列（支援多模態圖片）
  const formattedMessages = (hist ?? []).map((m: any) => {
    if (m.photo_url && m.photo_url.startsWith('data:image')) {
      return {
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: [
          { type: 'text' as const, text: m.content },
          { type: 'image' as const, image: m.photo_url }
        ]
      }
    }
    return {
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: m.content,
    }
  })

  let text = ''
  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await generateText({
      model: anthropic('claude-sonnet-4-5'),
      system,
      maxOutputTokens: 2500,
      messages: formattedMessages,
    })
    text = res.text
  } catch (e) {
    return NextResponse.json({ error: `AI 回覆失敗：${e instanceof Error ? e.message : e}` }, { status: 500 })
  }

  // 擷取硬性規定
  let reply = text, savedRule = '', suggestion = ''
  const ruleIdx = text.search(/===\s*規則\s*===/)
  if (ruleIdx >= 0) {
    savedRule = text.slice(ruleIdx).replace(/===\s*規則\s*===/, '').trim().split('\n')[0].trim()
    reply = text.slice(0, ruleIdx).trim()
    if (savedRule) {
      await c.admin.from('audit_rules').insert({ owner_id: c.ownerId, store, rule: savedRule, source_chat_id: chatId })
    }
  }

  // 擷取建議答案區
  if (suggest) {
    const sugIdx = reply.search(/===\s*建議\s*===/)
    if (sugIdx >= 0) {
      suggestion = reply.slice(sugIdx).replace(/===\s*建議\s*===/, '').trim()
      reply = reply.slice(0, sugIdx).trim()
    }
  }

  // 儲存 AI 回覆
  await c.admin.from('audit_messages').insert({
    chat_id: chatId,
    owner_id: c.ownerId,
    role: 'assistant',
    content: reply,
    suggestion,
  })

  await c.admin.from('audit_chats').update({
    mode,
    updated_at: new Date().toISOString()
  }).eq('id', chatId).eq('owner_id', c.ownerId)

  // 自動日誌：累積每數則對話自動更新日誌
  const totalMsgs = (hist?.length ?? 0) + 2
  if (totalMsgs >= 4 && totalMsgs % 4 === 0) {
    await summarizeAuditChat(c.admin, c.ownerId, chatId).catch(() => {})
  }

  return NextResponse.json({
    chat_id: chatId,
    reply,
    suggestion,
    saved_rule: savedRule,
  })
}
