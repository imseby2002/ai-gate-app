import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Participant {
  name: string
  birthday: string  // YYYY-MM-DD
  idNumber: string
}

function calcAge(birthday: string): number {
  if (!birthday) return -1
  const birth = new Date(birthday)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function getCategory(age: number): '幼兒' | '小孩' | '成人' {
  if (age <= 3) return '幼兒'
  if (age < 12) return '小孩'
  return '成人'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    packageName = '',
    participants = [] as Participant[],
    contactPhone = '',
    notifyWebhooks = [],
    campaignId,
  } = await req.json()

  const taiwanNow = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })

  const participantLines = (participants as Participant[]).map((p, i) => {
    const age = calcAge(p.birthday)
    const cat = getCategory(age)
    const idPart = cat === '幼兒' ? '（幼兒免填）' : (p.idNumber?.trim() || '（未填）')
    const ageStr = age >= 0 ? `${age}歲` : ''
    return `${i + 1}. ${p.name}｜${p.birthday}｜${idPart}｜${cat}${ageStr ? `（${ageStr}）` : ''}`
  }).join('\n')

  const lineMsg = `[AI GATE 訂位申請]\n方案：${packageName}\n聯絡電話：${contactPhone}\n\n參加人員（共${participants.length}位）：\n${participantLines}\n\n送出時間：${taiwanNow}`

  type NW = { type: 'line_messaging' | 'webhook' | 'telegram'; value: string; target?: string }
  await Promise.allSettled((notifyWebhooks as NW[]).filter((wh: NW) => wh.value?.trim()).map((wh: NW) => {
    if (wh.type === 'line_messaging') {
      if (!wh.target?.trim()) return Promise.resolve()
      return fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${wh.value.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: wh.target.trim(), messages: [{ type: 'text', text: lineMsg }] }),
      })
    } else if (wh.type === 'telegram') {
      if (!wh.target?.trim()) return Promise.resolve()
      return fetch(`https://api.telegram.org/bot${wh.value.trim()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: wh.target.trim(), text: lineMsg }),
      })
    } else {
      return fetch(wh.value.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageName, participants, contactPhone, lineMsg }),
      })
    }
  }))

  await supabase.from('cs_tickets').insert({
    user_id: user.id,
    industry: 'homestay',
    platform: 'chat',
    subject: `訂位申請：${packageName}`,
    description: lineMsg,
    priority: 'medium',
    intent: '訂位申請',
    campaign_id: campaignId ?? null,
  })

  return NextResponse.json({ ok: true })
}
