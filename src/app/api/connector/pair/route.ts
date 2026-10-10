// POST /api/connector/pair — 桌面連接器用配對碼換取裝置 token（token 只回傳這一次）
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDeviceToken, normalizePairCode, sha256 } from '@/lib/connector/auth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const code = normalizePairCode(String(body.code ?? ''))
  const deviceName = String(body.device_name ?? '').trim().slice(0, 80) || 'Windows 電腦'
  if (code.length !== 9) return NextResponse.json({ error: '配對碼格式錯誤' }, { status: 400 })

  const admin = createAdminClient()
  // 原子消耗配對碼：未使用且未過期才會更新到
  const { data: pair } = await admin
    .from('marketing_connector_pair_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code_hash', sha256(code))
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('user_id')
    .maybeSingle()
  if (!pair) return NextResponse.json({ error: '配對碼無效或已過期，請在網頁重新產生' }, { status: 400 })

  const token = generateDeviceToken()
  const { data: device, error } = await admin
    .from('marketing_connector_devices')
    .insert({ user_id: pair.user_id, name: deviceName, token_hash: sha256(token), last_seen_at: new Date().toISOString() })
    .select('id, name')
    .single()
  if (error) return NextResponse.json({ error: `配對失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true, token, device })
}
