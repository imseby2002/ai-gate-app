// 客戶服務關懷專員（cs-care）專屬工具：讀取既有 CS 客戶追蹤資料 + 主動發訊給客戶。
// cs_customers 目前沒有生日/家人狀況欄位（migration 032），所以「客戶生日關懷」
// 暫時做不到，先聚焦在既有資料能支撐的場景：找出多次問價但沒成交、或許久沒互動的
// 客戶，主動關心詢問需求。
import { createAdminClient } from '@/lib/supabase/admin'
import { sendToCustomer } from '@/lib/cs/send'
import type { AgentToolDef } from '../types'

interface ListDormantInput {
  minDaysSinceLastMessage?: number
  stages?: string[]
}

export const listDormantCustomersTool: AgentToolDef<ListDormantInput> = {
  id: 'list_dormant_customers',
  description:
    '列出許久沒互動、或多次問價但尚未成交的客戶名單（來自既有客服系統的客戶追蹤資料），' +
    '供評估要主動關心/詢問需求的對象。',
  inputSchema: {
    type: 'object',
    properties: {
      minDaysSinceLastMessage: { type: 'number', description: '最後互動至今至少幾天，預設 14' },
      stages: {
        type: 'array',
        items: { type: 'string', enum: ['new', 'inquiring', 'quoted', 'negotiating', 'won', 'lost'] },
        description: '限定洽詢階段，預設 [quoted, negotiating]（已報價但還沒成交的最值得關心）',
      },
    },
    required: [],
  },
  async execute(input, ctx) {
    const admin = createAdminClient()
    const minDays = input.minDaysSinceLastMessage ?? 14
    const stages = input.stages?.length ? input.stages : ['quoted', 'negotiating']
    const cutoff = new Date(Date.now() - minDays * 86_400_000).toISOString()

    const { data, error } = await admin
      .from('cs_customers')
      .select('id, platform, from_id, name, stage, price_ask_count, message_count, summary, last_message_at')
      .eq('user_id', ctx.userId)
      .in('stage', stages)
      .lt('last_message_at', cutoff)
      .order('price_ask_count', { ascending: false })
      .order('last_message_at', { ascending: true })
      .limit(30)

    if (error) return { error: error.message }
    return { customers: data ?? [] }
  },
}

interface SendCustomerMessageInput {
  platform: string
  to: string
  text: string
}

export const sendCustomerMessageTool: AgentToolDef<SendCustomerMessageInput> = {
  id: 'send_customer_message',
  description:
    '主動發送一則訊息給指定客戶（透過既有客服系統綁定的 LINE/WhatsApp/Telegram/Zalo 帳號）。' +
    '這是真的會送到客戶手機的動作，一律需要真人核准。',
  inputSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string', enum: ['line', 'line-oa', 'whatsapp', 'whatsapp-biz', 'whatsapp-personal', 'telegram', 'zalo', 'zalo-oa'] },
      to: { type: 'string', description: '客戶在該平台的 id（對應 cs_customers.from_id）' },
      text: { type: 'string', description: '要發送的訊息內容' },
    },
    required: ['platform', 'to', 'text'],
  },
  async execute(input, ctx) {
    return sendToCustomer(ctx.userId, input.platform, input.to, input.text)
  },
}
