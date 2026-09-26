import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateCompanySlug } from '@/lib/company/subdomain'
import { loadAdminCompanyList } from '@/lib/company/admin-list'

async function checkIsAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized', status: 401 }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  if (profile?.user_type !== 'admin') {
    return { ok: false, error: 'Forbidden', status: 403 }
  }
  return { ok: true, user }
}

// GET /api/admin/companies — 取得所有公司列表及成員概要
export async function GET() {
  const auth = await checkIsAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json({ companies: await loadAdminCompanyList() })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// POST /api/admin/companies — 管理員建立獨立公司
export async function POST(req: NextRequest) {
  const auth = await checkIsAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await req.json()
    const { name, ownerId, itId, enabledModules, bnbOwnerId } = body as {
      name?: string
      ownerId?: string
      itId?: string
      enabledModules?: string[]
      bnbOwnerId?: string
    }

    const trimmedName = String(name ?? '').trim()
    if (!trimmedName) {
      return NextResponse.json({ error: '請提供公司名稱' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. 建立公司實體
    const { data: company, error: compErr } = await admin
      .from('companies')
      .insert({
        name: trimmedName,
        created_by: auth.user!.id,
        enabled_modules: enabledModules ?? null,
        bnb_owner_id: bnbOwnerId || ownerId || null,
      })
      .select('*')
      .single()

    if (compErr || !company) {
      return NextResponse.json({ error: compErr?.message ?? '建立公司失敗' }, { status: 500 })
    }

    // 2. 若有指定負責人 (owner)，納入公司作為 owner
    if (ownerId) {
      const { data: ownerProfile } = await admin
        .from('profiles')
        .select('id, email')
        .eq('id', ownerId)
        .single()

      if (ownerProfile) {
        // 一個人可以同時是多家公司的一般成員；owner 角色仍是一人限一家
        // （DB 唯一索引 company_members_one_active_owner_per_member 會擋），
        // 所以這裡只 upsert 這家公司這個人的那一列，不去動他在其他公司的列。
        const { error: memErr } = await admin.from('company_members').upsert({
          company_id: company.id,
          member_id: ownerProfile.id,
          invited_email: (ownerProfile.email ?? '').toLowerCase(),
          role: 'owner',
          status: 'active',
          invited_by: auth.user!.id,
          accepted_at: new Date().toISOString(),
        }, { onConflict: 'company_id,invited_email' })

        if (memErr) {
          console.error('[admin/companies] Failed to assign owner:', memErr)
        }
      }
    }

    // 3. 若有指定公司 IT (admin)，納入公司作為 admin/IT
    if (itId && itId !== ownerId) {
      const { data: itProfile } = await admin
        .from('profiles')
        .select('id, email')
        .eq('id', itId)
        .single()

      if (itProfile) {
        // 同上：只 upsert 這家公司這個人的那一列，不動他在其他公司的成員身分
        const { error: itErr } = await admin.from('company_members').upsert({
          company_id: company.id,
          member_id: itProfile.id,
          invited_email: (itProfile.email ?? '').toLowerCase(),
          role: 'admin',
          status: 'active',
          invited_by: auth.user!.id,
          accepted_at: new Date().toISOString(),
        }, { onConflict: 'company_id,invited_email' })

        if (itErr) {
          console.error('[admin/companies] Failed to assign IT:', itErr)
        }
      }
    }

    return NextResponse.json({ ok: true, company })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '內部伺服器錯誤' }, { status: 500 })
  }
}

// PATCH /api/admin/companies — 管理員更新公司資訊
export async function PATCH(req: NextRequest) {
  const auth = await checkIsAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await req.json()
    const { id, name, enabledModules, bnbOwnerId, ownerId, itId, feedbackFree, freeFeatureQuotaMonthly, plan, erpSeats, retailStores, customDomain, creditTopUpUsd, slug, enterprise, enterpriseMonthlyUsd, costAlertRatio } = body as {
      id: string
      name?: string
      enabledModules?: string[] | null
      bnbOwnerId?: string | null
      ownerId?: string
      itId?: string
      feedbackFree?: boolean
      freeFeatureQuotaMonthly?: number | null
      plan?: 'free' | 'core' | 'pro' | 'max' | 'company'
      erpSeats?: number
      retailStores?: number
      customDomain?: boolean
      creditTopUpUsd?: number
      slug?: string | null
      enterprise?: boolean
      enterpriseMonthlyUsd?: number | null
      costAlertRatio?: number
    }

    if (!id) {
      return NextResponse.json({ error: '缺少公司 ID' }, { status: 400 })
    }

    const admin = createAdminClient()
    const patch: Record<string, unknown> = {}
    if (name !== undefined) patch.name = String(name).trim()
    if (enabledModules !== undefined) patch.enabled_modules = enabledModules
    if (bnbOwnerId !== undefined) {
      patch.bnb_owner_id = bnbOwnerId || null
    } else if (ownerId) {
      patch.bnb_owner_id = ownerId
    }
    if (feedbackFree !== undefined) patch.feedback_free_features = feedbackFree
    if (slug !== undefined) {
      const normalized = (slug ?? '').trim().toLowerCase()
      if (normalized) {
        const slugErr = validateCompanySlug(normalized)
        if (slugErr) return NextResponse.json({ error: slugErr }, { status: 400 })
      }
      patch.slug = normalized || null
    }
    if (freeFeatureQuotaMonthly !== undefined) patch.free_feature_quota_monthly = freeFeatureQuotaMonthly

    if (Object.keys(patch).length > 0) {
      const { error: updateErr } = await admin.from('companies').update(patch).eq('id', id)
      if (updateErr?.code === '23505') return NextResponse.json({ error: '這個子網域已被其他公司使用' }, { status: 409 })
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // 方案與公司方案計價設定（ERP 人數、門市數、自訂網域）；只寫入有傳的欄位
    const subPatch: Record<string, unknown> = {}
    if (plan !== undefined) { subPatch.plan = plan; subPatch.status = 'active' }
    if (erpSeats !== undefined) subPatch.erp_seats = Math.max(0, Math.floor(Number(erpSeats) || 0))
    if (retailStores !== undefined) subPatch.retail_stores = Math.max(0, Math.floor(Number(retailStores) || 0))
    if (customDomain !== undefined) subPatch.custom_domain = !!customDomain
    // 專屬客製-企業版建立在公司版之上：開啟時一併設為 'company' 方案
    if (enterprise !== undefined) {
      subPatch.enterprise = !!enterprise
      if (enterprise) { subPatch.plan = 'company'; subPatch.status = 'active' }
    }
    if (enterpriseMonthlyUsd !== undefined) subPatch.enterprise_monthly_usd = enterpriseMonthlyUsd == null ? null : Math.max(0, Number(enterpriseMonthlyUsd) || 0)
    if (costAlertRatio !== undefined && Number(costAlertRatio) > 0) subPatch.cost_alert_ratio = Number(costAlertRatio)
    if (Object.keys(subPatch).length > 0) {
      const { error: planErr } = await admin
        .from('company_subscriptions')
        .upsert({ company_id: id, ...subPatch }, { onConflict: 'company_id' })
      if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 })
    }

    // 管理員手動為公司錢包加值（寫入儲值桶）
    if (creditTopUpUsd !== undefined && Number(creditTopUpUsd) > 0) {
      const { error: topUpErr } = await admin.rpc('add_company_credits', {
        p_company_id: id,
        p_user_id: auth.user!.id,
        p_amount: Number(creditTopUpUsd),
        p_type: 'admin',
        p_description: '管理員加值',
      })
      if (topUpErr) return NextResponse.json({ error: topUpErr.message }, { status: 500 })
    }

    // 若變更負責人
    if (ownerId) {
      const { data: ownerProfile } = await admin
        .from('profiles')
        .select('id, email')
        .eq('id', ownerId)
        .single()

      if (ownerProfile) {
        // 先將原 owner 降為 manager（若有，僅限這家公司）
        await admin
          .from('company_members')
          .update({ role: 'manager' })
          .eq('company_id', id)
          .eq('role', 'owner')

        // 寫入/更新新 owner——只 upsert 這家公司這個人的那一列，不能像以前那樣
        // 先清空他在「所有」公司的 company_members，那會連他在其他公司的員工
        // 身分都一起砍掉。owner 角色本身仍受 DB 唯一索引限制一人一家，若這個人
        // 已經是別家公司的 owner，這裡會直接報錯，不會靜默覆蓋。
        const { error: newOwnerErr } = await admin.from('company_members').upsert({
          company_id: id,
          member_id: ownerProfile.id,
          invited_email: (ownerProfile.email ?? '').toLowerCase(),
          role: 'owner',
          status: 'active',
          invited_by: auth.user!.id,
          accepted_at: new Date().toISOString(),
        }, { onConflict: 'company_id,invited_email' })
        if (newOwnerErr) return NextResponse.json({ error: newOwnerErr.message }, { status: 500 })
      }
    }

    // 若變更公司 IT
    if (itId !== undefined) {
      if (!itId) {
        // 解除公司 IT
        await admin
          .from('company_members')
          .update({ role: 'manager' })
          .eq('company_id', id)
          .eq('role', 'admin')
      } else {
        const { data: itProfile } = await admin
          .from('profiles')
          .select('id, email')
          .eq('id', itId)
          .single()

        if (itProfile) {
          // 先將原 IT 降為 manager（僅限這家公司）
          await admin
            .from('company_members')
            .update({ role: 'manager' })
            .eq('company_id', id)
            .eq('role', 'admin')

          // 寫入/更新新 IT——同上，只 upsert 這家公司這個人的那一列
          const { error: newItErr } = await admin.from('company_members').upsert({
            company_id: id,
            member_id: itProfile.id,
            invited_email: (itProfile.email ?? '').toLowerCase(),
            role: 'admin',
            status: 'active',
            invited_by: auth.user!.id,
            accepted_at: new Date().toISOString(),
          }, { onConflict: 'company_id,invited_email' })
          if (newItErr) return NextResponse.json({ error: newItErr.message }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '內部伺服器錯誤' }, { status: 500 })
  }
}

// DELETE /api/admin/companies — 管理員刪除公司
export async function DELETE(req: NextRequest) {
  const auth = await checkIsAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { id } = await req.json() as { id: string }
    if (!id) return NextResponse.json({ error: '缺少公司 ID' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin.from('companies').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '內部伺服器錯誤' }, { status: 500 })
  }
}
