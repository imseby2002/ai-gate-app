import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export const maxDuration = 60

async function ctx() { return await getUnitContextAny(['audit', 'store']) }
const s = (v: unknown) => String(v ?? '').trim()

// 將客戶端傳來的分析結果壓成精簡文字，供 AI 參考（限制長度）
function analysisText(a: unknown): string {
  if (!a || typeof a !== 'object') return ''
  const o = a as Record<string, unknown>
  const rows = Array.isArray(o.rows) ? o.rows as Record<string, unknown>[] : []
  const cc = (o.cross_checks ?? {}) as Record<string, unknown>
  const po = (o.possibility ?? {}) as Record<string, unknown>
  const top = rows.filter(r => r.over).slice(0, 25)
    .map(r => `${r.material_name}：規定 ${r.expected}／實耗 ${r.actual}／誤差 ${r.pct === null ? '—' : Math.round(Number(r.pct)) + '%'}／金額損失 ${Math.round(Number(r.money_loss) || 0)}`).join('\n')
  let out = `【本月分析（門檻 ${o.threshold}%，超標 ${o.over_count} 項，估計金額損失 ${Math.round(Number(o.total_loss) || 0)}）】\n`
  if (top) out += `超標原料：\n${top}\n`
  if (cc.configured) out += `交叉檢核：售出杯數 ${cc.cups_sold}、杯子實耗 ${cc.cup_used}、茶實耗 ${cc.tea_used}、奶精實耗 ${cc.creamer_used}、由茶反推杯數 ${cc.implied_cups_tea}\n`
  if (po.configured && po.has_displacement) out += `加料排擠：茶可解釋少用 ${Math.round(Number(po.tea_explained) || 0)}、奶精可解釋 ${Math.round(Number(po.creamer_explained) || 0)}、額外加料份數 ${Math.round(Number(po.extra_topping_servings) || 0)}\n`
  return out.slice(0, 6000)
}

// 稽核 AI 對談。body: { chat_id?, store, message, analysis? }
export async function POST(req: NextRequest) {
  const c = await ctx(); if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 400 })
  const b = await req.json().catch(() => ({}))
  const message = s(b.message)
  const store = s(b.store)
  if (!message) return NextResponse.json({ error: '訊息必填' }, { status: 400 })

  // 對話
  let chatId = s(b.chat_id)
  if (chatId) {
    const { data } = await c.admin.from('audit_chats').select('id').eq('id', chatId).eq('owner_id', c.ownerId).single()
    if (!data) chatId = ''
  }
  if (!chatId) {
    const { data, error } = await c.admin.from('audit_chats').insert({ owner_id: c.ownerId, store, title: message.slice(0, 30) }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    chatId = data.id
  }
  await c.admin.from('audit_messages').insert({ chat_id: chatId, owner_id: c.ownerId, role: 'user', content: message })

  // 硬性規定（該門市＋全門市通用）
  const { data: rules } = await c.admin.from('audit_rules')
    .select('rule, store, active').eq('owner_id', c.ownerId).eq('active', true).or(`store.eq.${store},store.eq.`)
  const ruleText = (rules ?? []).map((r, i) => `${i + 1}. ${r.rule}${r.store ? `（限 ${r.store}）` : ''}`).join('\n')

  const { data: hist } = await c.admin.from('audit_messages').select('role, content').eq('chat_id', chatId).eq('owner_id', c.ownerId).order('created_at').limit(20)

  const system = `你是資深稽核暨飲料成本分析專家，協助稽核者判斷門市原物料使用是否合理。
重點：不能只用單純百分比。例如一杯珍奶可放 1 份或 2 份 topping，IPOS 只看得到杯數與各 topping 份數，實際奶茶(茶/奶精)用量會因加料份數不同而變；需從茶量與奶精用量交叉推算「加料排擠」，判斷茶/奶精「少用」是正常加料所致還是短少/浪費。
請以繁體中文、務實、具體地與稽核者一邊看數據一邊討論，指出可疑點、可能原因與查證方向。
${ruleText ? `\n【已定案的硬性規定（務必遵守並套用於判斷）】\n${ruleText}\n` : ''}
${analysisText(b.analysis)}
若稽核者明確要求「把某項設為硬性規定/既定規定」，請在正常回覆之後，另起一行輸出分隔線 ===規則=== ，其後只放一句精煉、可重複套用的規則文字（系統會自動存為硬性規定）。`

  const messages = (hist ?? []).map(m => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: m.content }))

  let text = ''
  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await generateText({ model: anthropic('claude-sonnet-4-5'), system, maxOutputTokens: 2000, messages })
    text = res.text
  } catch (e) {
    return NextResponse.json({ error: `AI 回覆失敗：${e instanceof Error ? e.message : e}` }, { status: 500 })
  }

  // 擷取硬性規定
  let reply = text, savedRule = ''
  const idx = text.search(/===\s*規則\s*===/)
  if (idx >= 0) {
    reply = text.slice(0, idx).trim()
    savedRule = text.slice(idx).replace(/===\s*規則\s*===/, '').trim().split('\n')[0].trim()
    if (savedRule) {
      await c.admin.from('audit_rules').insert({ owner_id: c.ownerId, store, rule: savedRule, source_chat_id: chatId })
    }
  }

  await c.admin.from('audit_messages').insert({ chat_id: chatId, owner_id: c.ownerId, role: 'assistant', content: reply })
  await c.admin.from('audit_chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId).eq('owner_id', c.ownerId)

  return NextResponse.json({ chat_id: chatId, reply, saved_rule: savedRule })
}
