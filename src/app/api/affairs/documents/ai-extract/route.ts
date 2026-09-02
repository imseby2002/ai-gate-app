import { NextRequest, NextResponse } from 'next/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { getUnitContext } from '@/lib/auth/unit-access'

export const maxDuration = 120

function mediaTypeOf(name: string): string | null {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  return null
}

export async function POST(req: NextRequest) {
  const ctx = await getUnitContext('affairs')
  if (!ctx.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: '無效的 Form-Data' }, { status: 400 })

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: '請提供合約或證件掃描檔 (PDF 或圖片)' }, { status: 400 })
  }

  const mediaType = mediaTypeOf(file.name)
  if (!mediaType) {
    return NextResponse.json({ error: '不支援的檔案格式，請上傳 PDF 或圖片 (PNG, JPG, WEBP)' }, { status: 400 })
  }

  const buf = new Uint8Array(await file.arrayBuffer())

  const promptText = `你是一位專業的法律合約與商業證照審核專家。請仔細辨識這份掃描文件（可能是門市租約、門市衛生證、公司執照、專利證書或廠商合約），完整萃取其所有文字條款，並精確解析出以下欄位。

請務必以純 JSON 格式回傳，格式如下：
{
  "title": "文件或合約標題（例如：台南公園門市房屋租賃契約書）",
  "doc_type": "lease (若為門市租約) 或 sanitary_cert (門市衛生證) 或 company_license (公司執照/登記事項) 或 patent_cert (專利證書) 或 contract (廠商合約) 或 other",
  "counterparty": "簽約對方／出租人／房東／發證機關名稱（例如：王大明）",
  "deposit": 100000 (押金或保證金金額，數字；若無或無法辨識請回傳 null),
  "monthly_rent": 35000 (每月租金或管理費用，數字；若無或無法辨識請回傳 null),
  "payment_day": 5 (每月應繳租金之付款日 1-31 數字；若合約註明每月5日前付款請填 5；若無法辨識請回傳 null),
  "effective_date": "YYYY-MM-DD (合約起始日或發照日；無法辨識回傳 null)",
  "expiry_date": "YYYY-MM-DD (合約到期截止日或證照效期迄日；無法辨識回傳 null)",
  "contract_text": "合約之完整條款文字與詳細辨識內容（繁體中文）",
  "note": "重點備註（例如：押金兩個月、水電費由承租方自付、租金轉帳帳號等重點）"
}

只回傳 JSON 物件，不要包覆 markdown 語法或任何額外文字。`

  let jsonText = ''

  // 1. 優先使用 Anthropic Claude 3.5
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const res = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        maxOutputTokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              { type: 'file', data: buf, mediaType },
            ],
          },
        ],
      })
      jsonText = res.text
    } catch (e) {
      console.warn('[affairs/ai-extract] Anthropic failed, trying OpenAI:', e)
    }
  }

  // 2. 若 Anthropic 失敗或未設定，嘗試 OpenAI GPT-4o
  if (!jsonText && process.env.OPENAI_API_KEY) {
    try {
      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
      // OpenAI 圖片支援
      const base64 = Buffer.from(buf).toString('base64')
      const dataUri = `data:${mediaType};base64,${base64}`

      const res = await generateText({
        model: openai('gpt-4o'),
        maxOutputTokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              { type: 'image', image: dataUri },
            ],
          },
        ],
      })
      jsonText = res.text
    } catch (e) {
      console.error('[affairs/ai-extract] OpenAI failed:', e)
    }
  }

  if (!jsonText) {
    return NextResponse.json({ error: 'AI 辨識服務暫時不可用，請檢查 API 金鑰' }, { status: 500 })
  }

  try {
    // 清理可能的 markdown 圍欄
    const clean = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json({ ok: true, data: parsed })
  } catch (e) {
    return NextResponse.json({
      ok: true,
      data: {
        title: file.name.replace(/\.[^/.]+$/, ''),
        doc_type: 'lease',
        contract_text: jsonText,
        note: 'AI 辨識文字已擷取，請手動確認各欄位。',
      },
    })
  }
}
