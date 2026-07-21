// 財務發票/核銷專員（finance-invoice）專屬工具：重用既有 hr_cashflow 出納帳務表
// （owner_id/type/category/amount/receipt_url，見 migration 054）。
// 沒有 OCR 辨識與 ERP 整合，範圍限定在既有帳務紀錄的分類複核。
import { createAdminClient } from '@/lib/supabase/admin'
import type { AgentToolDef } from '../types'

interface ListUncategorizedInput {
  minDaysAgo?: number
}

export const listUncategorizedCashflowTool: AgentToolDef = {
  id: 'list_uncategorized_cashflow',
  description: '列出尚未分類（category 為空）的收支紀錄，供覆核與建議分類。',
  inputSchema: {
    type: 'object',
    properties: {
      minDaysAgo: { type: 'number', description: '只看最近幾天內的紀錄，預設 30' },
    },
    required: [],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as ListUncategorizedInput
    const days = input.minDaysAgo ?? 30
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('hr_cashflow')
      .select('id, type, category, amount, date, description, notes, receipt_url')
      .eq('owner_id', ctx.userId)
      .or('category.is.null,category.eq.')
      .gte('date', since)
      .order('date', { ascending: false })
      .limit(30)
    if (error) return { error: error.message }
    return { entries: data ?? [] }
  },
}

interface UpdateCashflowCategoryInput {
  entryId: string
  category: string
  notes?: string
}

export const updateCashflowCategoryTool: AgentToolDef = {
  id: 'update_cashflow_category',
  description: '更新一筆收支紀錄的分類/備註。這會實際寫入帳本，一律需要真人核准。',
  inputSchema: {
    type: 'object',
    properties: {
      entryId: { type: 'string' },
      category: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['entryId', 'category'],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as UpdateCashflowCategoryInput
    const admin = createAdminClient()
    const patch: Record<string, unknown> = { category: input.category }
    if (input.notes != null) patch.notes = input.notes
    const { error } = await admin
      .from('hr_cashflow')
      .update(patch)
      .eq('id', input.entryId)
      .eq('owner_id', ctx.userId)
    if (error) return { error: error.message }
    return { ok: true }
  },
}
