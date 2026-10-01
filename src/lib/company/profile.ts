// 公司資料單一來源（Single Source of Truth）
//   公司 / 品牌 → mkt_brand（一家公司一筆，owner_id = 公司 owner）
//   門市 / 分公司 → fin_stores（OFFICE 門市主檔）＋ mkt_store_profiles（對外行銷擴充）
//   產品 / 服務 → mkt_product_profiles（行銷產品庫，可關聯 pos_items / inv_recipes）
// 設定頁、行銷中心、辦公室 /mkt、客服、行銷流水線、AI Agent 一律從這裡讀，
// 不再各自維護一份 company_data JSON。company_data 只保留 compiled_md 作為舊讀取端相容快取。
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveCompanyId, resolveCompanyOwner } from '@/lib/company/activeCompany'

type Admin = ReturnType<typeof createAdminClient>

export interface CompanyFile {
  url: string
  name: string
  category: 'logo' | 'image' | 'document' | 'faq'
  mimeType: string
  sizeKb: number
  textContent?: string
}

export interface CompanyBranch {
  id: string
  name: string
  address: string
  phone?: string
  lat?: number
  lng?: number
  notes?: string
}

export interface CompanyProduct {
  id: string
  name: string
  category: string
  price: number
  slogan: string
  description: string
}

/** 與舊版 company_data.data（Unit2Data）相同欄位，讓既有讀取端不必改 */
export interface CompanyProfile {
  legalName?: string
  companyName?: string
  industry?: string
  employees?: string
  capital?: string
  founded?: string
  address?: string
  website?: string
  description?: string
  products?: string
  targetAudience?: string
  brandTone?: string
  competitiveAdvantage?: string
  branches?: CompanyBranch[]
  files?: CompanyFile[]
  productList?: CompanyProduct[]
}

/** 公司基本資料中可由「公司資料」表單寫入 mkt_brand 的欄位對照 */
export const PROFILE_TO_BRAND: Record<string, string> = {
  legalName: 'legal_name',
  companyName: 'name',
  industry: 'industry',
  employees: 'employees',
  capital: 'capital',
  founded: 'founded',
  address: 'address',
  description: 'brand_story',
  targetAudience: 'audience',
  brandTone: 'tone',
  competitiveAdvantage: 'selling_points',
}

/** 目前登入者操作中的公司 owner（資料歸屬帳號）；個人帳號＝自己 */
export async function currentDataOwner(): Promise<{ admin: Admin; userId: string; ownerId: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('user_type, company_id').eq('id', user.id).maybeSingle()
  const companyId = await resolveActiveCompanyId(admin, user.id, profile?.user_type === 'admin', (profile?.company_id as string | null) ?? null)
  const ownerId = (await resolveCompanyOwner(admin, companyId)) ?? user.id
  return { admin, userId: user.id, ownerId }
}

/** 由任一成員帳號推回公司 owner（無 cookie 的背景流程用，例如 webhook / agent） */
export async function dataOwnerOf(admin: Admin, userId: string): Promise<string> {
  const { data: profile } = await admin.from('profiles').select('company_id').eq('id', userId).maybeSingle()
  return (await resolveCompanyOwner(admin, (profile?.company_id as string | null) ?? null)) ?? userId
}

export async function loadCompanyProfile(admin: Admin, ownerId: string): Promise<CompanyProfile> {
  const [brandRes, storesRes, storeProfRes, productsRes] = await Promise.all([
    admin.from('mkt_brand').select('*').eq('owner_id', ownerId).maybeSingle(),
    admin.from('fin_stores').select('id, name, address, unit_type, active').eq('owner_id', ownerId).order('code'),
    admin.from('mkt_store_profiles').select('store_id, story, opening_hours').eq('owner_id', ownerId),
    admin.from('mkt_product_profiles').select('id, name, category, price, slogan, description').eq('owner_id', ownerId).order('created_at'),
  ])
  const b = (brandRes.data ?? {}) as Record<string, string | undefined> & { platforms?: Record<string, string>; files?: unknown }
  const storeProf = new Map((storeProfRes.data ?? []).map(p => [p.store_id as string, p]))

  const branches: CompanyBranch[] = (storesRes.data ?? [])
    .filter(s => s.active !== false && (s.unit_type ?? 'store') === 'store')
    .map(s => {
      const p = storeProf.get(s.id)
      const notes = [p?.opening_hours ? `營業時間：${p.opening_hours}` : '', p?.story ?? ''].filter(Boolean).join('；')
      return { id: s.id, name: s.name, address: s.address ?? '', notes: notes || undefined }
    })

  const productList: CompanyProduct[] = (productsRes.data ?? []).map(p => ({
    id: p.id, name: p.name, category: p.category ?? '', price: Number(p.price) || 0,
    slogan: p.slogan ?? '', description: p.description ?? '',
  }))
  const products = productList
    .map(p => `- ${p.name}${p.category ? `（${p.category}）` : ''}${p.price ? ` $${p.price}` : ''}${p.slogan ? `：${p.slogan}` : ''}`)
    .join('\n')

  const platforms: Record<string, string> = (b.platforms && typeof b.platforms === 'object') ? b.platforms : {}
  return {
    legalName: b.legal_name || undefined,
    companyName: b.name || undefined,
    industry: b.industry || undefined,
    employees: b.employees || undefined,
    capital: b.capital || undefined,
    founded: b.founded || undefined,
    address: b.address || undefined,
    website: platforms.website || undefined,
    description: b.brand_story || undefined,
    products: products || undefined,
    targetAudience: b.audience || undefined,
    brandTone: b.tone || undefined,
    competitiveAdvantage: b.selling_points || undefined,
    branches,
    files: Array.isArray(b.files) ? (b.files as CompanyFile[]) : [],
    productList,
  }
}

export function buildCompanyMd(d: CompanyProfile, brand?: { slogan?: string | null; tagline?: string | null; banned_words?: string | null } | null): string {
  const lines: string[] = ['# 公司資料（編譯版）', '']

  lines.push('## 基本資料')
  if (d.legalName)   lines.push(`- **公司名稱**：${d.legalName}`)
  if (d.companyName && d.companyName !== d.legalName) lines.push(`- **品牌名稱**：${d.companyName}`)
  if (d.industry)    lines.push(`- **產業別**：${d.industry}`)
  if (d.employees)   lines.push(`- **員工人數**：${d.employees}`)
  if (d.capital)     lines.push(`- **資本額**：${d.capital}`)
  if (d.founded)     lines.push(`- **成立年份**：${d.founded}`)
  if (d.website)     lines.push(`- **官方網站**：${d.website}`)
  if (d.address)     lines.push(`- **公司地址**：${d.address}`)
  lines.push('')

  lines.push('## 業務描述')
  if (d.description)          lines.push(`### 公司簡介\n${d.description}\n`)
  if (d.targetAudience)       lines.push(`### 目標客群\n${d.targetAudience}\n`)
  if (d.competitiveAdvantage) lines.push(`### 核心競爭優勢\n${d.competitiveAdvantage}\n`)

  if (d.brandTone || brand?.slogan || brand?.tagline || brand?.banned_words) {
    lines.push('## 品牌設定')
    if (brand?.slogan)       lines.push(`- **標語**：${brand.slogan}`)
    if (brand?.tagline)      lines.push(`- **一句話定位**：${brand.tagline}`)
    if (d.brandTone)         lines.push(`- **品牌語調**：${d.brandTone}`)
    if (brand?.banned_words) lines.push(`- **禁用詞**：${brand.banned_words}`)
    lines.push('')
  }

  if (d.productList && d.productList.length > 0) {
    lines.push('## 主要產品 / 服務')
    for (const p of d.productList) {
      lines.push(`### ${p.name}`)
      if (p.category) lines.push(`- 分類：${p.category}`)
      if (p.price)    lines.push(`- 售價：${p.price}`)
      if (p.slogan)   lines.push(`- 賣點：${p.slogan}`)
      if (p.description) lines.push(p.description)
      lines.push('')
    }
  }

  if (d.branches && d.branches.length > 0) {
    lines.push('## 門市 / 分公司')
    for (const b of d.branches) {
      lines.push(`### ${b.name}`)
      if (b.address) lines.push(`- 地址：${b.address}`)
      if (b.phone)   lines.push(`- 電話：${b.phone}`)
      if (b.notes)   lines.push(`- 備註：${b.notes}`)
      lines.push('')
    }
  }

  const label = { logo: 'Logo', image: '圖片', document: '文件', faq: 'FAQ' } as const
  const textFiles = (d.files ?? []).filter(f => f.textContent)
  if (textFiles.length > 0) {
    lines.push('## 素材文字內容')
    for (const f of textFiles) {
      lines.push(`### ${label[f.category] ?? f.category}：${f.name}`)
      lines.push(f.textContent!)
      lines.push('')
    }
  }
  if ((d.files ?? []).length > 0) {
    lines.push('## 上傳素材清單')
    for (const f of d.files!) lines.push(`- [${label[f.category] ?? f.category}] ${f.name} (${f.sizeKb}KB)`)
    lines.push('')
  }

  return lines.join('\n')
}

/** 即時從主檔組出 AI 用 Markdown，並寫回 company_data.compiled_md 供舊讀取端相容 */
export async function compileCompanyMd(admin: Admin, ownerId: string): Promise<string> {
  const [profile, { data: brand }] = await Promise.all([
    loadCompanyProfile(admin, ownerId),
    admin.from('mkt_brand').select('slogan, tagline, banned_words').eq('owner_id', ownerId).maybeSingle(),
  ])
  const md = buildCompanyMd(profile, brand)
  await admin.from('company_data').upsert({ user_id: ownerId, compiled_md: md }, { onConflict: 'user_id' })
  return md
}

/** AI 讀取公司知識庫：一律即時組出，避免快取過期 */
export async function getCompanyContextMd(admin: Admin, ownerId: string): Promise<string> {
  const [profile, { data: brand }] = await Promise.all([
    loadCompanyProfile(admin, ownerId),
    admin.from('mkt_brand').select('slogan, tagline, banned_words').eq('owner_id', ownerId).maybeSingle(),
  ])
  const hasAny = profile.legalName || profile.companyName || profile.description || profile.productList?.length || profile.branches?.length || profile.files?.length
  return hasAny ? buildCompanyMd(profile, brand) : ''
}
