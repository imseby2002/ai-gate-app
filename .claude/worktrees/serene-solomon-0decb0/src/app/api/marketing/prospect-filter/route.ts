/**
 * POST /api/marketing/prospect-filter
 *
 * Pipeline：AI 解析組織 → 篩選 → 距離計算 → 分類 → 電話整理
 *
 * Body: {
 *   rawText: string            // 從蒐集單元取得的原始文字
 *   filterCriteria: string     // 自然語言篩選條件（AI 理解）
 *   minEmployees?: number
 *   maxDistanceKm?: number     // 距離淘汰閾值（km）
 *   branches: Branch[]         // 門市資料（含 lat/lng）
 * }
 *
 * Response: { orgs: ProspectOrg[] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Branch {
  id: string
  name: string
  address: string
  phone?: string
  lat?: number
  lng?: number
}

export interface ProspectOrg {
  id: string
  name: string
  phone?: string
  phoneNormalized?: string
  address?: string
  lat?: number
  lng?: number
  rawCategory?: string
  aiCategory: string
  employeeHint?: string
  rating?: number
  website?: string
  // computed
  nearestBranch?: string
  nearestBranchDistance?: number   // km
  selected: boolean
  filterReason?: string
}

// ─── Haversine distance (km) ───────────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Phone normalisation (TW-first, E.164) ────────────────────────────────────

function normalizePhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  // strip formatting
  let p = raw.replace(/[\s\-().+]/g, '')
  if (!p || p.length < 7) return undefined

  // Taiwan mobile: 09xxxxxxxx → +8869xxxxxxxx
  if (/^09\d{8}$/.test(p)) return `+886${p.slice(1)}`
  // Taiwan landline with area code: 0x-xxxxxxx
  if (/^0\d{1,3}\d{6,8}$/.test(p)) return `+886${p.slice(1)}`
  // already has country code
  if (/^\+?\d{10,15}$/.test(p)) return p.startsWith('+') ? p : `+${p}`

  return undefined
}

// ─── AI parse + filter + classify ─────────────────────────────────────────────

async function aiParseOrgs(
  rawText: string,
  filterCriteria: string,
  minEmployees: number,
): Promise<Omit<ProspectOrg, 'nearestBranch' | 'nearestBranchDistance' | 'selected' | 'filterReason'>[]> {

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const systemPrompt = `你是一個資料萃取助理。從原始蒐集文字中提取每個組織/公司的結構化資料，並依照篩選條件評估、分類。

請回傳純 JSON，格式如下（陣列，每個元素是一個組織）：
[
  {
    "name": "公司名稱",
    "phone": "原始電話號碼（若有）",
    "address": "地址（若有）",
    "lat": 緯度數字或null,
    "lng": 經度數字或null,
    "rawCategory": "原始分類（若有）",
    "aiCategory": "factory|hotel|restaurant|financial|retail|healthcare|education|realestate|logistics|other",
    "employeeHint": "員工人數估計（若有，如：50-100人）",
    "rating": 評分數字或null,
    "website": "網址（若有）",
    "passFilter": true 或 false,
    "filterReason": "若 passFilter=false，說明原因"
  }
]

分類標準：
- factory: 製造業、工廠、生產、加工
- hotel: 飯店、民宿、旅館、住宿
- restaurant: 餐廳、食品、飲料、小吃
- financial: 銀行、保險、投資、金融、證券
- retail: 零售、商店、電商、賣場
- healthcare: 醫院、診所、藥局、醫療
- education: 學校、補習班、教育、訓練
- realestate: 房地產、仲介、建設
- logistics: 物流、運輸、倉儲
- other: 其他

只回傳 JSON 陣列，不加任何說明文字。`

  const userPrompt = `原始資料：
${rawText.slice(0, 12000)}

篩選條件：${filterCriteria || '無特殊條件'}
最低員工人數：${minEmployees > 0 ? `${minEmployees}人以上` : '不限'}

請萃取所有組織，應用篩選條件，並回傳 JSON 陣列。`

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    prompt: userPrompt,
    maxOutputTokens: 4096,
  })
  // Extract JSON array from response
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('AI 未回傳有效 JSON')

  const parsed = JSON.parse(match[0]) as Array<{
    name: string
    phone?: string
    address?: string
    lat?: number | null
    lng?: number | null
    rawCategory?: string
    aiCategory: string
    employeeHint?: string
    rating?: number | null
    website?: string
    passFilter: boolean
    filterReason?: string
  }>

  return parsed.map((o, i) => ({
    id: `org-${Date.now()}-${i}`,
    name: o.name,
    phone: o.phone || undefined,
    phoneNormalized: normalizePhone(o.phone),
    address: o.address || undefined,
    lat: typeof o.lat === 'number' ? o.lat : undefined,
    lng: typeof o.lng === 'number' ? o.lng : undefined,
    rawCategory: o.rawCategory || undefined,
    aiCategory: o.aiCategory || 'other',
    employeeHint: o.employeeHint || undefined,
    rating: typeof o.rating === 'number' ? o.rating : undefined,
    website: o.website || undefined,
    _passFilter: o.passFilter,
    _filterReason: o.filterReason,
  })) as (Omit<ProspectOrg, 'nearestBranch' | 'nearestBranchDistance' | 'selected' | 'filterReason'> & {
    _passFilter: boolean; _filterReason?: string
  })[]
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    rawText = '',
    filterCriteria = '',
    minEmployees = 0,
    maxDistanceKm = 0,
    branches = [] as Branch[],
  } = body

  if (!rawText.trim()) {
    return NextResponse.json({ error: '請先執行蒐集步驟' }, { status: 400 })
  }

  try {
    // 1. AI parse + classify + filter decision
    const rawOrgs = await aiParseOrgs(rawText, filterCriteria, minEmployees)

    const branchesWithCoords = (branches as Branch[]).filter(b => b.lat && b.lng)

    // 2. Distance calculation + selection
    const orgs: ProspectOrg[] = rawOrgs.map(org => {
      const r = org as typeof org & { _passFilter: boolean; _filterReason?: string }

      // AI filter
      if (!r._passFilter) {
        return { ...org, selected: false, filterReason: r._filterReason || 'AI 篩選淘汰' }
      }

      // Distance filter (only if branches have coords AND maxDistanceKm > 0)
      if (branchesWithCoords.length > 0 && maxDistanceKm > 0) {
        if (!org.lat || !org.lng) {
          // No coords → cannot check distance → keep but mark
          return {
            ...org,
            selected: true,
            nearestBranch: undefined,
            nearestBranchDistance: undefined,
          }
        }

        let minDist = Infinity
        let nearestName = ''
        for (const b of branchesWithCoords) {
          const d = haversine(org.lat!, org.lng!, b.lat!, b.lng!)
          if (d < minDist) { minDist = d; nearestName = b.name }
        }

        if (minDist > maxDistanceKm) {
          return {
            ...org,
            selected: false,
            nearestBranch: nearestName,
            nearestBranchDistance: Math.round(minDist * 10) / 10,
            filterReason: `距最近門市 ${Math.round(minDist * 10) / 10} km，超過 ${maxDistanceKm} km 上限`,
          }
        }

        return {
          ...org,
          selected: true,
          nearestBranch: nearestName,
          nearestBranchDistance: Math.round(minDist * 10) / 10,
        }
      }

      // No distance filter or no branch coords
      if (branchesWithCoords.length > 0 && org.lat && org.lng) {
        let minDist = Infinity
        let nearestName = ''
        for (const b of branchesWithCoords) {
          const d = haversine(org.lat, org.lng, b.lat!, b.lng!)
          if (d < minDist) { minDist = d; nearestName = b.name }
        }
        return {
          ...org,
          selected: true,
          nearestBranch: nearestName,
          nearestBranchDistance: Math.round(minDist * 10) / 10,
        }
      }

      return { ...org, selected: true }
    })

    return NextResponse.json({ orgs })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
