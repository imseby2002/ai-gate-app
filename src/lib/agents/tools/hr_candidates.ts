// HR 履歷篩選專員（hr-recruiter）專屬工具：agent_hr_candidates 是公司內部的應徵者
// 追蹤表，與既有 resume 模組（求職者端功能）完全獨立，不可混用。
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AgentToolDef } from '../types'

interface ListCandidatesInput {
  stages?: string[]
}

export const listCandidatesTool: AgentToolDef = {
  id: 'list_candidates',
  description: '列出目前追蹤中的應徵者名單，可依洽詢階段篩選。',
  inputSchema: {
    type: 'object',
    properties: {
      stages: {
        type: 'array',
        items: { type: 'string', enum: ['new', 'screening', 'interview_scheduled', 'interviewed', 'offered', 'rejected', 'hired'] },
        description: '限定階段，預設 [new, screening]',
      },
    },
    required: [],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as ListCandidatesInput
    const stages = input.stages?.length ? input.stages : ['new', 'screening']
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('agent_hr_candidates')
      .select('id, name, email, phone, position, stage, score, notes, created_at')
      .eq('user_id', ctx.userId)
      .in('stage', stages)
      .order('created_at', { ascending: false })
      .limit(30)
    if (error) return { error: error.message }
    return { candidates: data ?? [] }
  },
}

interface UpdateCandidateStageInput {
  candidateId: string
  stage?: string
  score?: number
  notes?: string
}

export const updateCandidateStageTool: AgentToolDef = {
  id: 'update_candidate_stage',
  description: '更新應徵者的洽詢階段、評分或備註（純內部紀錄，不會通知應徵者本人）。',
  inputSchema: {
    type: 'object',
    properties: {
      candidateId: { type: 'string' },
      stage: { type: 'string', enum: ['new', 'screening', 'interview_scheduled', 'interviewed', 'offered', 'rejected', 'hired'] },
      score: { type: 'number', description: '評分 1-5' },
      notes: { type: 'string' },
    },
    required: ['candidateId'],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as UpdateCandidateStageInput
    const admin = createAdminClient()
    const patch: Record<string, unknown> = {}
    if (input.stage) patch.stage = input.stage
    if (input.score != null) patch.score = input.score
    if (input.notes != null) patch.notes = input.notes
    const { error } = await admin
      .from('agent_hr_candidates')
      .update(patch)
      .eq('id', input.candidateId)
      .eq('user_id', ctx.userId)
    if (error) return { error: error.message }
    return { ok: true }
  },
}

interface SendCandidateEmailInput {
  candidateId: string
  subject: string
  body: string
}

export const sendCandidateEmailTool: AgentToolDef = {
  id: 'send_candidate_email',
  description: '寄送 email 給指定應徵者（如面試邀約、結果通知）。這是真的會送達應徵者信箱的動作，一律需要真人核准。',
  inputSchema: {
    type: 'object',
    properties: {
      candidateId: { type: 'string' },
      subject: { type: 'string' },
      body: { type: 'string' },
    },
    required: ['candidateId', 'subject', 'body'],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as SendCandidateEmailInput
    const admin = createAdminClient()
    const { data: candidate } = await admin
      .from('agent_hr_candidates')
      .select('email, name')
      .eq('id', input.candidateId)
      .eq('user_id', ctx.userId)
      .maybeSingle()
    if (!candidate?.email) return { error: '找不到此應徵者或缺少 email' }
    if (!process.env.RESEND_API_KEY) return { error: 'RESEND_API_KEY 未設定' }
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'AI Gate HR <hr@im-tourist.com>',
      to: [candidate.email],
      subject: input.subject,
      text: input.body,
    })
    if (error) return { error: error.message }
    return { ok: true, emailId: data?.id }
  },
}
