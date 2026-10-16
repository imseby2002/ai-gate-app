// 公司知識庫（knowledge_docs）提供給其他模組使用：AI 對話助理、專家、短影音腳本…
// 一律以目前登入者的「目前公司」為範圍（全公司共用），只會讀到該公司的文件。
import { getDeptAccess } from '@/lib/company/dept-access'

export interface KnowledgeDocText {
  id: string
  title: string
  department: string
  content: string
}

const MAX_IDS = 50

export function sanitizeDocIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const ids = raw.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x))
  return [...new Set(ids)].slice(0, MAX_IDS)
}

/** 讀取目前登入者公司內指定的知識文件（不屬於該公司的 id 會被略過） */
export async function loadKnowledgeDocs(ids: string[]): Promise<KnowledgeDocText[]> {
  const docIds = sanitizeDocIds(ids)
  if (!docIds.length) return []
  const access = await getDeptAccess()
  if (!access.ok) return []
  const { data } = await access.admin.from('knowledge_docs')
    .select('id, title, department, content')
    .eq('company_id', access.companyId)
    .in('id', docIds)
  const byId = new Map((data ?? []).map(d => [d.id as string, d as KnowledgeDocText]))
  return docIds.map(id => byId.get(id)).filter((d): d is KnowledgeDocText => !!d)
}

/** 組成可注入 system prompt 的知識文字（依 maxChars 截斷） */
export function formatKnowledgeContext(docs: KnowledgeDocText[], maxChars: number, heading = '以下是公司知識庫內容（請優先依據這些資料回答，資料沒有的不要杜撰）：'): string {
  if (!docs.length) return ''
  const parts = [`---\n${heading}`]
  let total = parts[0].length
  for (const d of docs) {
    const remaining = maxChars - total
    if (remaining <= 200) { parts.push('\n\n[部分知識因長度限制未載入]'); break }
    const block = `\n\n### ${d.title}\n${d.content}`
    const clip = block.length > remaining ? `${block.slice(0, remaining)}\n[本文件其餘內容因長度限制未載入]` : block
    parts.push(clip)
    total += clip.length
  }
  return parts.join('')
}

export async function loadKnowledgeContext(ids: string[], maxChars: number, heading?: string): Promise<string> {
  return formatKnowledgeContext(await loadKnowledgeDocs(ids), maxChars, heading)
}
