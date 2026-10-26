/**
 * 意見反映「AI 驗收」：由 AI 比對提案內容與提案之後合併到 main 的 PR，
 * 判斷需求是否已實作完成。判定完成時改為 verify_pending，交由管理者確認處理成功；
 * 管理者只負責確認，不自行判斷是否完成。
 */
import { generateText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { ghFetch, getClaudeSonnetModel } from '@/lib/feedback/autofix'
import { trackAiUsage } from '@/lib/ai/universal-tracker'

export interface AiVerdict {
  done: boolean
  pr_number: number | null
  pr_url: string | null
  evidence: string
  checked_at: string
}

interface GhPull { number: number; title: string; body: string | null; html_url: string; merged_at: string | null }

/** 提案描述可能是 JSON（辦公室提案），取出可讀的需求文字 */
export function readableRequest(description: string | null): string {
  const raw = description ?? ''
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object') {
      return [p.department_label && `部門：${p.department_label}`, p.content && `內容：${p.content}`, p.expected_solution && `期望：${p.expected_solution}`]
        .filter(Boolean).join('\n') || raw
    }
  } catch { /* 純文字 */ }
  return raw
}

function extractJson(text: string) {
  let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const s = t.indexOf('{'); const e = t.lastIndexOf('}')
  if (s >= 0 && e > s) t = t.slice(s, e + 1)
  return JSON.parse(t)
}

export async function verifyFeedbackCompletion(feedbackId: string): Promise<{ ok: true; verdict: AiVerdict; status: string } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const { data: fb } = await admin.from('user_feedback').select('id, title, description, status, created_at').eq('id', feedbackId).single()
  if (!fb) return { ok: false, error: '找不到回饋' }
  if (['merged', 'completed', 'rejected'].includes(fb.status)) return { ok: false, error: '此案已結案' }

  // 提案建立之後合併到 main 的 PR
  let pulls: GhPull[] = []
  try {
    const list = (await ghFetch('/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=50')) as GhPull[]
    const since = new Date(fb.created_at).getTime()
    pulls = list.filter(p => p.merged_at && new Date(p.merged_at).getTime() >= since).slice(0, 30)
  } catch (e) {
    return { ok: false, error: `讀取 GitHub 失敗：${e instanceof Error ? e.message : String(e)}` }
  }

  const checkedAt = new Date().toISOString()
  let verdict: AiVerdict
  if (pulls.length === 0) {
    verdict = { done: false, pr_number: null, pr_url: null, evidence: '提案之後尚無任何已合併的程式修改。', checked_at: checkedAt }
  } else {
    const prText = pulls.map(p => `#${p.number}：${p.title}\n${(p.body ?? '').slice(0, 800)}`).join('\n\n---\n\n')
    const prompt = `你是軟體專案驗收人員。判斷下列「使用者提案」是否已被某個已合併的程式修改（PR）實作完成。

【提案標題】${fb.title}
【提案內容】
${readableRequest(fb.description)}

【提案之後已合併的 PR】
${prText}

規則：
- 只有當某個 PR 明確實作了提案要求的功能或修正，才判定 done=true，並給出該 PR 編號
- 只是相關但沒有解決提案需求，判定 done=false
- evidence 用繁體中文一到兩句說明判斷依據（引用 PR 內容）

只輸出 JSON：{"done": true/false, "pr_number": 數字或 null, "evidence": "..."}`
    try {
      const res = await generateText({ model: getClaudeSonnetModel(), maxOutputTokens: 600, messages: [{ role: 'user', content: prompt }] })
      const j = extractJson(res.text)
      const pr = pulls.find(p => p.number === Number(j.pr_number)) ?? null
      verdict = {
        done: !!j.done && !!pr,
        pr_number: pr?.number ?? null,
        pr_url: pr?.html_url ?? null,
        evidence: String(j.evidence ?? '').slice(0, 500),
        checked_at: checkedAt,
      }
      const usage = res.usage as { inputTokens?: number; outputTokens?: number } | undefined
      void trackAiUsage({
        feature: 'autofix', modelId: 'claude-sonnet-4-6',
        inputTokens: Number(usage?.inputTokens ?? 0), outputTokens: Number(usage?.outputTokens ?? 0),
        sourceChannel: 'anthropic',
      })
    } catch (e) {
      return { ok: false, error: `AI 驗收失敗：${e instanceof Error ? e.message : String(e)}` }
    }
  }

  const update: Record<string, unknown> = { ai_verdict: verdict, updated_at: checkedAt }
  if (verdict.done) {
    update.status = 'verify_pending'
    update.pr_url = verdict.pr_url
  }
  await admin.from('user_feedback').update(update).eq('id', feedbackId)
  return { ok: true, verdict, status: verdict.done ? 'verify_pending' : fb.status }
}
