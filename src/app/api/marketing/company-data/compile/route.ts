/**
 * POST /api/marketing/company-data/compile
 * Compiles all company data fields + uploaded file text into a single Markdown string
 * and stores it in company_data.compiled_md for token-efficient AI prompts.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Branch {
  id: string
  name: string
  address: string
  phone?: string
  lat?: number
  lng?: number
  notes?: string
}

interface UploadedFile {
  url: string
  name: string
  category: 'logo' | 'image' | 'document' | 'faq'
  mimeType: string
  sizeKb: number
  textContent?: string
}

interface CompanyData {
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
  branches?: Branch[]
  files?: UploadedFile[]
}

function buildMarkdown(d: CompanyData): string {
  const lines: string[] = ['# 公司資料（編譯版）', '']

  // Basic info
  lines.push('## 基本資料')
  if (d.companyName)  lines.push(`- **公司名稱**：${d.companyName}`)
  if (d.industry)     lines.push(`- **產業別**：${d.industry}`)
  if (d.employees)    lines.push(`- **員工人數**：${d.employees}`)
  if (d.capital)      lines.push(`- **資本額**：${d.capital}`)
  if (d.founded)      lines.push(`- **成立年份**：${d.founded}`)
  if (d.website)      lines.push(`- **官方網站**：${d.website}`)
  if (d.address)      lines.push(`- **公司地址**：${d.address}`)
  lines.push('')

  // Business description
  lines.push('## 業務描述')
  if (d.description)          lines.push(`### 公司簡介\n${d.description}\n`)
  if (d.products)             lines.push(`### 主要產品 / 服務\n${d.products}\n`)
  if (d.targetAudience)       lines.push(`### 目標客群\n${d.targetAudience}\n`)
  if (d.competitiveAdvantage) lines.push(`### 核心競爭優勢\n${d.competitiveAdvantage}\n`)

  // Brand
  if (d.brandTone) {
    lines.push('## 品牌設定')
    lines.push(`- **品牌語調**：${d.brandTone}`)
    lines.push('')
  }

  // Branches
  if (d.branches && d.branches.length > 0) {
    lines.push('## 門市 / 分公司')
    for (const b of d.branches) {
      lines.push(`### ${b.name}`)
      lines.push(`- 地址：${b.address}`)
      if (b.phone) lines.push(`- 電話：${b.phone}`)
      if (b.lat && b.lng) lines.push(`- 座標：${b.lat}, ${b.lng}`)
      if (b.notes) lines.push(`- 備註：${b.notes}`)
      lines.push('')
    }
  }

  // Uploaded file text content
  const textFiles = (d.files ?? []).filter(f => f.textContent)
  if (textFiles.length > 0) {
    lines.push('## 素材文字內容')
    for (const f of textFiles) {
      const categoryLabel = { logo: 'Logo', image: '圖片', document: '文件', faq: 'FAQ' }[f.category] ?? f.category
      lines.push(`### ${categoryLabel}：${f.name}`)
      lines.push(f.textContent!)
      lines.push('')
    }
  }

  // File list (non-text)
  const allFiles = d.files ?? []
  if (allFiles.length > 0) {
    lines.push('## 上傳素材清單')
    for (const f of allFiles) {
      const label = { logo: 'Logo', image: '圖片', document: '文件', faq: 'FAQ' }[f.category] ?? f.category
      lines.push(`- [${label}] ${f.name} (${f.sizeKb}KB)`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row } = await supabase
    .from('company_data')
    .select('data')
    .eq('user_id', user.id)
    .single()

  if (!row?.data) {
    return NextResponse.json({ error: '尚無公司資料可編譯' }, { status: 400 })
  }

  const compiled_md = buildMarkdown(row.data as CompanyData)

  const { error } = await supabase
    .from('company_data')
    .update({ compiled_md })
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, compiled_md, chars: compiled_md.length })
}
