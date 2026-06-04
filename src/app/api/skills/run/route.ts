// POST /api/skills/run — 統一執行入口
// 流程：認證 → 模組權限 → 預估餘額檢查 → 執行 skill → 依實際成本扣點 → 寫紀錄
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSkill } from '@/lib/skills/registry'
import { createSkillContext } from '@/lib/skills/runtime'
import { getBalance, deductCredits, logSkillRun } from '@/lib/skills/billing'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { skillId, input = {} } = await req.json().catch(() => ({}))
  const skill = getSkill(skillId)
  if (!skill) return NextResponse.json({ error: '未知的 skill' }, { status: 404 })

  // 模組權限：admin 全開，其他看 enabled_modules / is_active
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, is_active, enabled_modules')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.is_active === false) return NextResponse.json({ error: '帳號已停用' }, { status: 403 })

  if (profile.user_type !== 'admin') {
    const enabled: string[] = profile.enabled_modules ?? ['chat', 'marketing', 'cs', 'leads', 'resume']
    if (!enabled.includes(skill.module)) {
      return NextResponse.json({ error: `未開通模組：${skill.module}` }, { status: 403 })
    }
  }

  // 執行前餘額檢查（用預估上限）
  const estimate = skill.estimateCost ? skill.estimateCost(input) : skill.priceCredits
  const balance = await getBalance(user.id)
  if (balance < estimate) {
    return NextResponse.json(
      { error: '點數不足', balance, required: estimate },
      { status: 402 },
    )
  }

  // 執行
  let result
  try {
    const ctx = createSkillContext(user.id)
    result = await skill.run(input, ctx)
  } catch (err) {
    await logSkillRun({
      userId: user.id, skillId: skill.id, input,
      output: '', creditsSpent: 0, status: 'error', error: String(err),
    })
    return NextResponse.json({ error: `執行失敗：${String(err)}` }, { status: 500 })
  }

  // 實際扣點 = 基礎 + 動態加扣
  const cost = skill.priceCredits + (result.extraCredits ?? 0)
  const deduct = await deductCredits(user.id, cost, `[skill] ${skill.id}`)
  if (!deduct.ok && deduct.reason === 'insufficient') {
    // 極少數並發情況：餘額在執行間被扣光，仍回傳結果但標記未扣款
    await logSkillRun({
      userId: user.id, skillId: skill.id, input,
      output: result.output, creditsSpent: 0, status: 'success',
    })
    return NextResponse.json(
      { error: '點數不足，本次結果未扣款', balance: await getBalance(user.id) },
      { status: 402 },
    )
  }

  await logSkillRun({
    userId: user.id, skillId: skill.id, input,
    output: result.output, creditsSpent: cost, status: 'success',
  })

  return NextResponse.json({
    output: result.output,
    data: result.data ?? null,
    creditsSpent: cost,
    balance: deduct.ok ? deduct.balance : await getBalance(user.id),
  })
}
