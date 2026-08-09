import { createAdminClient } from '@/lib/supabase/admin'

// 給定 expertIds，回傳可注入 system prompt 的知識文字（只有 status=ready 的才會被納入）
export async function loadExpertContext(expertIds: string[]): Promise<string> {
  if (!expertIds.length) return ''
  const admin = createAdminClient()

  const { data } = await admin
    .from('experts')
    .select('name, domain, expert_knowledge(structured, status)')
    .in('id', expertIds)

  if (!data?.length) return ''

  const parts: string[] = ['---\n以下是本次對話引用的專家知識庫：']
  for (const expert of data) {
    type KnowledgeRow = { structured: string | null; status: string }
    const knowledge = (expert.expert_knowledge as KnowledgeRow[] | null)?.[0]
    if (knowledge?.status !== 'ready' || !knowledge.structured) continue
    parts.push(`\n### 專家：${expert.name}${expert.domain ? `（${expert.domain}）` : ''}\n${knowledge.structured}`)
  }

  if (parts.length === 1) return '' // 沒有 ready 的知識可注入
  return parts.join('\n')
}
