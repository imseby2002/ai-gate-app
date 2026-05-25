import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSafeWebhookUrl } from '@/lib/ssrf'

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

// Looks like a Taiwan national ID (1 letter + 9 digits). Foreign passports won't match.
function looksLikeTwId(raw: string): boolean {
  return /^[A-Za-z][0-9]{9}$/.test((raw ?? '').trim())
}

// Validate Taiwan national ID checksum — catches typos before they reach insurance.
function isValidTwId(raw: string): boolean {
  const s = (raw ?? '').trim().toUpperCase()
  if (!/^[A-Z][12][0-9]{8}$/.test(s)) return false
  const map: Record<string, number> = {
    A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34, J: 18, K: 19,
    L: 20, M: 21, N: 22, O: 35, P: 23, Q: 24, R: 25, S: 26, T: 27, U: 28, V: 29,
    W: 32, X: 30, Y: 31, Z: 33,
  }
  const head = map[s[0]]
  const digits = [Math.floor(head / 10), head % 10, ...s.slice(1).split('').map(Number)]
  const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1]
  return digits.reduce((acc, d, i) => acc + d * weights[i], 0) % 10 === 0
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
    const id = p.idNumber?.trim() ?? ''
    // Flag TW-format IDs that fail the checksum (likely a typo); leave foreign passports alone.
    const idFlag = id && looksLikeTwId(id) && !isValidTwId(id) ? '（⚠️身分證格式有誤，請確認）' : ''
    const idPart = cat === '幼兒' ? '（幼兒免填）' : (id ? `${id}${idFlag}` : '（未填）')
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
      if (!isSafeWebhookUrl(wh.value.trim())) return Promise.resolve()  // block SSRF to internal hosts
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
