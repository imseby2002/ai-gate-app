import { NextRequest, NextResponse } from 'next/server'
import { getPosOwner } from '@/lib/pos/auth'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const ctx = await getPosOwner()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = (await req.json()) as { rows?: Record<string, unknown>[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '沒有可匯入的門市資料' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []

  const { data: existing } = await ctx.supabase
    .from('pos_stores')
    .select('id, name, slug')
    .eq('owner_id', ctx.userId)

  const existingList = existing || []
  let inserted = 0
  let updated = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 2
    const name = String(r.name ?? '').trim()
    if (!name) {
      errors.push({ line, reason: '缺少門市名稱' })
      continue
    }

    const slug = String(r.slug ?? name).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'store'

    const match = existingList.find(s => s.name.trim().toLowerCase() === name.toLowerCase() || s.slug === slug)
    if (match) {
      const { error } = await ctx.supabase
        .from('pos_stores')
        .update({ name, slug })
        .eq('id', match.id)
      if (error) {
        errors.push({ line, reason: `更新「${name}」失敗: ${error.message}` })
      } else {
        updated++
      }
    } else {
      const { data: newStore, error } = await ctx.supabase
        .from('pos_stores')
        .insert({ owner_id: ctx.userId, name, slug })
        .select()
        .single()
      if (error || !newStore) {
        errors.push({ line, reason: `新增「${name}」失敗: ${error?.message}` })
      } else {
        inserted++
        // Auto create default terminal
        await ctx.supabase
          .from('pos_terminals')
          .insert({ store_id: newStore.id, owner_id: ctx.userId, name: '櫃台' })
      }
    }
  }

  return NextResponse.json({ ok: true, inserted, updated, errors })
}
