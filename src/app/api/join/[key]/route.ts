/**
 * POST /api/join/[key] — 公開「加入會員」表單送出（免登入）
 * key：民宿官網 slug 或 owner id。寫入 site_members（service-role；表本身不開放匿名寫入）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveJoinKey } from '@/lib/marketing/members'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  // honeypot：真人看不到這個欄位，有填的是機器人，直接假裝成功
  if (clip(body.website, 200)) return NextResponse.json({ ok: true })

  const name = clip(body.name, 80)
  const email = clip(body.email, 200).toLowerCase() || null
  const phone = clip(body.phone, 30).replace(/[\s-]/g, '') || null
  const lineId = clip(body.line_id, 80) || null
  const source = clip(body.source, 80) || null

  if (!name) return NextResponse.json({ error: '請填寫姓名' }, { status: 400 })
  if (!email && !phone) return NextResponse.json({ error: 'Email 或手機至少填一項' }, { status: 400 })
  if (email && !EMAIL_RE.test(email)) return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 })
  if (phone && !/^\+?\d{6,20}$/.test(phone)) return NextResponse.json({ error: '手機格式不正確' }, { status: 400 })
  if (body.consent !== true) return NextResponse.json({ error: '請勾選同意接收優惠通知' }, { status: 400 })

  const admin = createAdminClient()
  const target = await resolveJoinKey(admin, key)
  if (!target) return NextResponse.json({ error: '找不到此頁面' }, { status: 404 })

  const { error } = await admin.from('site_members').insert({
    owner_id: target.ownerId, name, email, phone, line_id: lineId, source, consent: true,
  })
  // 23505：同一個 email／手機已加入過，對訪客來說一樣算成功
  if (error && error.code !== '23505') {
    console.error('[join] site_members insert 失敗', { key, error })
    return NextResponse.json({ error: '送出失敗，請稍後再試' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, already: error?.code === '23505' })
}
