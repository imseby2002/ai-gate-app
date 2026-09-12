import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdminUser } from '@/lib/auth/admin-check'

export const dynamic = 'force-dynamic'

interface ProposalPayload {
  department: string
  department_label?: string
  store_code?: string
  content: string
  expected_solution: string
  attachments?: string[]
  author_name?: string
  author_email?: string
  approved_at?: string
  approved_by_name?: string
}

function parsePayload(rawDesc: string): ProposalPayload {
  try {
    const parsed = JSON.parse(rawDesc)
    if (parsed && typeof parsed === 'object') {
      return {
        department: parsed.department || 'system',
        department_label: parsed.department_label,
        store_code: parsed.store_code || '',
        content: parsed.content || parsed.description || rawDesc,
        expected_solution: parsed.expected_solution || '',
        attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
        author_name: parsed.author_name,
        author_email: parsed.author_email,
        approved_at: parsed.approved_at,
        approved_by_name: parsed.approved_by_name,
      }
    }
  } catch {
    // plain string
  }
  return {
    department: 'system',
    store_code: '',
    content: rawDesc,
    expected_solution: '',
    attachments: [],
  }
}

// 取得全公司所有提案（任何人皆可查看進度與提案；管理者可批示）
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, user_type, company_id, full_name, email, department')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = isSuperAdminUser(user, profile)
  let isCompanyAdmin = false

  if (profile?.company_id) {
    const { data: m } = await admin
      .from('company_members')
      .select('role')
      .eq('company_id', profile.company_id)
      .eq('member_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (m?.role === 'owner' || m?.role === 'admin') {
      isCompanyAdmin = true
    }
  }

  const canManage = isSuperAdmin || isCompanyAdmin

  // 取得全部相關提案（依更新與建立時間排序）
  const { data: rows, error } = await admin
    .from('user_feedback')
    .select('*, profiles(id, full_name, email, department)')
    .in('type', ['problem', 'idea', 'bug', 'feature'])
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const proposals = (rows ?? []).map(r => {
    const parsed = parsePayload(r.description || '')
    return {
      id: r.id,
      user_id: r.user_id,
      type: r.type === 'bug' ? 'problem' : r.type === 'feature' ? 'idea' : r.type,
      title: r.title,
      department: parsed.department,
      department_label: parsed.department_label,
      store_code: parsed.store_code || (r.profiles as any)?.department || '',
      description: parsed.content,
      expected_solution: parsed.expected_solution,
      attachments: parsed.attachments || [],
      author_name: parsed.author_name || (r.profiles as any)?.full_name || (r.profiles as any)?.email?.split('@')[0] || '同仁',
      author_email: parsed.author_email || (r.profiles as any)?.email || '',
      status: r.status || 'pending',
      admin_notes: r.admin_notes || '',
      ai_plan: r.ai_plan || '',
      branch_name: r.branch_name || '',
      pr_url: r.pr_url || '',
      created_at: r.created_at,
      updated_at: r.updated_at,
      approved_at: parsed.approved_at,
      approved_by_name: parsed.approved_by_name,
    }
  })

  return NextResponse.json({
    proposals,
    canManage,
    currentUser: {
      id: user.id,
      name: profile?.full_name || profile?.email?.split('@')[0] || user.email?.split('@')[0] || '我',
      email: profile?.email || user.email || '',
      store_code: profile?.department || '',
      canManage,
    }
  })
}

// 提出問題或想法
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const title = String(b.title || '').trim()
  const content = String(b.description || '').trim()
  const expectedSolution = String(b.expected_solution || '').trim()
  const type = b.type === 'problem' ? 'problem' : 'idea'
  const department = String(b.department || 'system').trim()
  const departmentLabel = String(b.department_label || '').trim()
  const attachments = Array.isArray(b.attachments) ? b.attachments : []

  if (!title || !content) {
    return NextResponse.json({ error: '請填寫提案標題與問題/想法說明' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, email, store_code')
    .eq('id', user.id)
    .single()

  const storeCode = String(b.store_code || profile?.store_code || '').trim()
  const authorName = profile?.display_name || profile?.email?.split('@')[0] || '同仁'
  const authorEmail = profile?.email || ''

  const payload: ProposalPayload = {
    department,
    department_label: departmentLabel,
    store_code: storeCode,
    content,
    expected_solution: expectedSolution,
    attachments,
    author_name: authorName,
    author_email: authorEmail,
  }

  const { data, error } = await admin
    .from('user_feedback')
    .insert({
      user_id: user.id,
      title,
      description: JSON.stringify(payload),
      type,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

// 老闆審批：批准並啟動寫程式 / 標記開發中 / 標記完成 / 駁回
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, user_type, company_id, full_name, email')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = isSuperAdminUser(user, profile)
  let isCompanyAdmin = false

  if (profile?.company_id) {
    const { data: m } = await admin
      .from('company_members')
      .select('role')
      .eq('company_id', profile.company_id)
      .eq('member_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (m?.role === 'owner' || m?.role === 'admin') {
      isCompanyAdmin = true
    }
  }

  if (!isSuperAdmin && !isCompanyAdmin) {
    return NextResponse.json({ error: '僅公司負責人或管理者有權審批提案與批准改寫程式' }, { status: 403 })
  }

  const b = await req.json().catch(() => ({}))
  const id = String(b.id || '').trim()
  const status = String(b.status || '').trim()
  const adminNotes = String(b.admin_notes || '').trim()

  if (!id || !status) {
    return NextResponse.json({ error: 'id 與 status 必填' }, { status: 400 })
  }

  // 取得原有資料
  const { data: existing } = await admin.from('user_feedback').select('*').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: '找不到該筆提案' }, { status: 404 })

  const parsed = parsePayload(existing.description || '')
  if (status === 'approved') {
    parsed.approved_at = new Date().toISOString()
    parsed.approved_by_name = profile?.full_name || profile?.email?.split('@')[0] || user.email?.split('@')[0] || '負責人'
  }

  // 若批准，自動產生 AI 重寫程式提示詞 (AI Task Specification)
  let aiPlan = existing.ai_plan || ''
  if (status === 'approved') {
    const approverName = parsed.approved_by_name
    aiPlan = [
      '【AI 程式重寫任務規格書 (AI Reprogramming Task)】',
      '■ 提案名稱：' + existing.title,
      '■ 提案類型：' + (existing.type === 'problem' ? '🚨 問題修復 (Bug Fix)' : '💡 功能改進 (Feature Proposal)'),
      '■ 相關部門：' + (parsed.department_label || parsed.department),
      '■ 提案同仁：' + (parsed.author_name || '同仁') + (parsed.store_code ? ' (門市: ' + parsed.store_code + ')' : ' (總部)'),
      '■ 現狀與問題描述：',
      parsed.content,
      '',
      '■ 期望解決方式：',
      parsed.expected_solution || '依最佳實踐優化重構',
      '',
      '■ 負責人批示指引：',
      adminNotes || '批准執行程式重寫與功能優化',
      '',
      '■ 審批確認：由 ' + approverName + ' 於 ' + new Date().toLocaleString('zh-TW') + ' 批准。請即刻依上述指引重寫程式並驗證測試。'
    ].join('\n')
  }

  const updateFields: Record<string, any> = {
    status,
    description: JSON.stringify(parsed),
    updated_at: new Date().toISOString(),
  }

  if (adminNotes) updateFields.admin_notes = adminNotes
  if (aiPlan) updateFields.ai_plan = aiPlan

  const { error } = await admin.from('user_feedback').update(updateFields).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, ai_plan: aiPlan })
}
