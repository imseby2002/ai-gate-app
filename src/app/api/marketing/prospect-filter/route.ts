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
import { getCronOrUserAuth } from '@/lib/cron-auth'
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
  email?: string
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
  // keep leading + before stripping
  const hasPlus = raw.trimStart().startsWith('+')
  let p = raw.replace(/[\s\-().]/g, '').replace(/^\+/, '')
  if (!p || p.length < 7) return undefined

  // already has country code (e.g. 84xxxxxxxxx for Vietnam, 886xxxxxxxx for Taiwan)
  if (hasPlus && /^\d{10,15}$/.test(p)) return `+${p}`

  // Taiwan mobile: 09xxxxxxxx → +8869xxxxxxxx
  if (/^09\d{8}$/.test(p)) return `+886${p.slice(1)}`
  // Taiwan landline: 0x-xxxxxxx
  if (/^0\d{1,3}\d{6,8}$/.test(p)) return `+886${p.slice(1)}`

  // Vietnam: 0xxxxxxxxx (10 digits) → +840xxxxxxxxx or strip leading 0 → +84xxxxxxxxx
  if (/^0\d{9}$/.test(p)) return `+84${p.slice(1)}`

  // Generic: if looks like a valid international number (10-15 digits)
  if (/^\d{10,15}$/.test(p)) return `+${p}`

  return undefined
}

// ─── AI parse + filter + classify ─────────────────────────────────────────────

// 單批次 AI 解析（每批最多 CHUNK_SIZE 字元）
// 抽取／分類屬機械任務，改用 Haiku 4.5（約 Sonnet 的 1/3 成本）
const EXTRACT_MODEL = 'claude-haiku-4-5'
const CHUNK_SIZE = 15000

async function aiParseChunk(
  anthropic: ReturnType<typeof createAnthropic>,
  chunk: string,
  filterCriteria: string,
  minEmployees: number,
): Promise<Array<{
  name: string; phone?: string; address?: string
  lat?: number | null; lng?: number | null
  rawCategory?: string; aiCategory: string
  employeeHint?: string; rating?: number | null; website?: string
  passFilter: boolean; filterReason?: string
}>> {
  const systemPrompt = `你是資料萃取助理。從原始文字中提取組織/公司資料並分類。
只回傳純 JSON 陣列，不加任何說明文字或 markdown。

格式：
[{"name":"","phone":"","email":"","address":"","lat":null,"lng":null,"rawCategory":"","aiCategory":"restaurant","employeeHint":"","rating":null,"website":"","passFilter":true,"filterReason":""}]

說明：
- phone：電話號碼（含國碼更佳，如 +84...）
- email：電子郵件（若文字中有出現，如 xxx@xxx.com，務必萃取）
- website：官方網址
- aiCategory 只能是：factory|hotel|restaurant|financial|retail|healthcare|education|realestate|logistics|other`

  const userPrompt = `原始資料：
${chunk}

篩選條件：${filterCriteria || '無特殊條件'}
最低員工：${minEmployees > 0 ? `${minEmployees}人以上` : '不限'}

萃取所有組織，回傳 JSON 陣列。`

  const { text } = await generateText({
    model: anthropic(EXTRACT_MODEL),
    system: systemPrompt,
    prompt: userPrompt,
    maxOutputTokens: 16000,
  })

  // 嘗試提取 JSON 陣列（支援 markdown code block）
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const match = clean.match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    return JSON.parse(match[0])
  } catch {
    // 嘗試修復截斷的 JSON（移除最後一個不完整的物件）
    const partial = match[0].replace(/,\s*\{[^}]*$/, ']')
    try { return JSON.parse(partial) } catch { return [] }
  }
}

async function aiParseOrgs(
  rawText: string,
  filterCriteria: string,
  minEmployees: number,
): Promise<Omit<ProspectOrg, 'nearestBranch' | 'nearestBranchDistance' | 'selected' | 'filterReason'>[]> {

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  // 分批處理：每批 CHUNK_SIZE 字元，避免 AI 輸出超過 token 上限
  const chunks: string[] = []
  for (let i = 0; i < rawText.length; i += CHUNK_SIZE) {
    chunks.push(rawText.slice(i, i + CHUNK_SIZE))
  }

  type ParsedOrg = { name: string; phone?: string; email?: string; address?: string; lat?: number | null; lng?: number | null; rawCategory?: string; aiCategory: string; employeeHint?: string; rating?: number | null; website?: string; passFilter: boolean; filterReason?: string }
  const allParsed: ParsedOrg[] = []
  for (const chunk of chunks) {
    const parsed = await aiParseChunk(anthropic, chunk, filterCriteria, minEmployees)
    allParsed.push(...parsed)
  }

  // 去重（同名組織只保留第一筆）
  const seen = new Set<string>()
  const deduped = allParsed.filter(o => {
    if (seen.has(o.name)) return false
    seen.add(o.name)
    return true
  })

  if (deduped.length === 0) throw new Error('AI 未能從原始資料中萃取任何組織，請確認蒐集資料格式')

  return deduped.map((o, i) => ({
    id: `org-${Date.now()}-${i}`,
    name: o.name,
    phone: o.phone || undefined,
    phoneNormalized: normalizePhone(o.phone),
    email: o.email?.trim() || undefined,
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
  const user = await getCronOrUserAuth(req)
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
