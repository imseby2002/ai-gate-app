// 門市稽核專員（edge-ai-audit）專屬工具。目前沒有現場攝影機/Jetson 裝置，
// 只處理「已上傳的影像」（真人手動上傳，或未來裝置串接同一支上傳 API）。
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AgentToolDef } from '../types'

interface ListRecentUploadsInput {
  onlyUnanalyzed?: boolean
  limit?: number
}

export const listRecentUploadsTool: AgentToolDef = {
  id: 'list_recent_uploads',
  description: '列出近期上傳的門市影像，可篩選只看尚未分析的。',
  inputSchema: {
    type: 'object',
    properties: {
      onlyUnanalyzed: { type: 'boolean', description: '只看尚未分析的，預設 true' },
      limit: { type: 'number', description: '筆數上限，預設 20' },
    },
    required: [],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as ListRecentUploadsInput
    const admin = createAdminClient()
    let query = admin
      .from('agent_compliance_uploads')
      .select('id, store_name, image_url, analyzed, severity, findings, uploaded_at')
      .eq('user_id', ctx.userId)
      .order('uploaded_at', { ascending: false })
      .limit(input.limit ?? 20)
    if (input.onlyUnanalyzed ?? true) query = query.eq('analyzed', false)
    const { data, error } = await query
    if (error) return { error: error.message }
    return { uploads: data ?? [] }
  },
}

interface AnalyzeComplianceImageInput {
  uploadId: string
  checklist?: string
}

export const analyzeComplianceImageTool: AgentToolDef = {
  id: 'analyze_compliance_image',
  description: '用視覺模型分析一張已上傳的門市影像，判斷是否有作業違規（如未戴帽子、環境清潔未落實），並把結果寫回紀錄。',
  inputSchema: {
    type: 'object',
    properties: {
      uploadId: { type: 'string' },
      checklist: { type: 'string', description: '要檢查的項目清單（選填，預設檢查衛生/服裝/環境整潔等常見門市稽核項目）' },
    },
    required: ['uploadId'],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as AnalyzeComplianceImageInput
    const admin = createAdminClient()
    const { data: upload } = await admin
      .from('agent_compliance_uploads')
      .select('id, image_url, user_id')
      .eq('id', input.uploadId)
      .eq('user_id', ctx.userId)
      .maybeSingle()
    if (!upload) return { error: '找不到此上傳紀錄' }

    if (!process.env.GOOGLE_AI_API_KEY) return { error: 'GOOGLE_AI_API_KEY 未設定' }
    const imgRes = await fetch(upload.image_url)
    if (!imgRes.ok) return { error: '影像下載失敗' }
    const buf = await imgRes.arrayBuffer()
    const base64 = Buffer.from(buf).toString('base64')
    const mimeType = imgRes.headers.get('content-type') ?? 'image/jpeg'

    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY })
    const checklist = input.checklist?.trim() || '員工是否穿戴規定服裝/帽子、環境是否整潔、是否有明顯違規行為'
    // messages 型別在 image part 上與這個 ai SDK 版本的 ImagePart 定義對不太起來
    // （同樣的作法在 src/lib/ai/providers/gemini.ts 也是用 as any 繞過），故比照處理。
    const res = await generateText({
      model: google('gemini-2.5-flash'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `你是門市稽核員，請檢查這張照片是否有以下項目的違規：${checklist}。\n請輸出：①嚴重程度（none/low/medium/high）②具體發現（若無違規請明確說明「未發現違規」）。` },
            { type: 'image', image: base64, mimeType },
          ],
        },
      ] as any,
      maxOutputTokens: 800,
    })

    const text = res.text
    const severityMatch = text.match(/none|low|medium|high/i)
    const severity = (severityMatch?.[0].toLowerCase() ?? 'none') as 'none' | 'low' | 'medium' | 'high'

    await admin
      .from('agent_compliance_uploads')
      .update({ analyzed: true, severity, findings: text })
      .eq('id', input.uploadId)

    return { severity, findings: text }
  },
}
