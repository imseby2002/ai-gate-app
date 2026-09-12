// 組合行銷專家知識庫（與行銷中心「專家模式」同源）：
//   內建精煉知識（getSkillKnowledge）＋ 帳號在「訓練這位專家」上傳的自訂知識（builtin_expert_knowledge）。
// 供行銷部門一鍵產出等內部功能重用，讓產出品質對齊專家模式。
import { createAdminClient } from '@/lib/supabase/admin'
import { getSkillKnowledge } from './knowledge'

type Admin = ReturnType<typeof createAdminClient>

// userId：知識歸屬帳號（行銷部門用公司 owner，讓全公司共用同一批訓練知識）。
export async function assembleExpertKnowledge(
  admin: Admin, userId: string, skillIds: string[], maxChars = 16000,
): Promise<string> {
  const parts: string[] = []
  for (const id of skillIds) {
    const builtin = getSkillKnowledge(id)
    if (builtin) parts.push(builtin)
  }

  const { data } = await admin.from('builtin_expert_knowledge')
    .select('name, extracted_text, skill_id')
    .eq('user_id', userId)
    .in('skill_id', skillIds)
    .order('created_at', { ascending: true })

  let used = parts.join('').length
  const blocks: string[] = []
  for (const row of data ?? []) {
    const text = String(row.extracted_text ?? '').trim()
    if (!text) continue
    const remaining = maxChars - used
    if (remaining <= 0) break
    const clip = text.slice(0, remaining)
    blocks.push(`【${row.name || '知識來源'}】\n${clip}`)
    used += clip.length
  }
  if (blocks.length) {
    parts.push(`以下是公司在「行銷專家模式」累積的專屬參考資料，請優先參考其風格、案例與方法論：\n\n${blocks.join('\n\n---\n\n')}`)
  }
  return parts.join('\n\n')
}
