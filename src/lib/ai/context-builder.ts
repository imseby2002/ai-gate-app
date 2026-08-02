import type { Assistant, AssistantFile } from '@/types/database'

const MAX_CONTEXT_CHARS = 200_000 // ~80K tokens rough estimate

// 沒有選助理／知識庫時 buildSystemPrompt 過去回傳空字串，模型完全沒有任何
// 規則約束，遇到問「哪家民宿」這類具體事實的問題就會憑訓練記憶編造。
// 這條規則對所有對話（不管有沒有助理、有沒有知識庫）一律生效。
const ANTI_HALLUCINATION_RULE =
  '若被問到你不確定、缺乏依據或超出你所知範圍的具體事實（例如特定店家、民宿、商品、人物、數據），必須明確告知使用者你沒有相關資料或不確定，禁止編造、猜測或憑印象杜撰答案。'

export function buildSystemPrompt(
  assistant: Assistant | null,
  files: AssistantFile[]
): string {
  const parts: string[] = [ANTI_HALLUCINATION_RULE]

  if (assistant?.system_prompt) {
    parts.push(`\n\n${assistant.system_prompt}`)
  }

  if (files.length > 0) {
    parts.push('\n\n---\n以下是你的知識庫檔案內容（Knowledge Base）：')

    let totalChars = parts.join('').length
    for (const file of files) {
      if (!file.extracted_text) continue
      const fileContent = `\n\n### 檔案：${file.file_name}\n${file.extracted_text}`
      if (totalChars + fileContent.length > MAX_CONTEXT_CHARS) {
        parts.push('\n\n[部分檔案因長度限制未載入]')
        break
      }
      parts.push(fileContent)
      totalChars += fileContent.length
    }
  }

  return parts.join('')
}

export function formatMessagesForContext(
  messages: Array<{ role: string; content: string }>,
  maxMessages = 20
): Array<{ role: 'user' | 'assistant'; content: string }> {
  // Keep last N messages, always starting with user message
  const recent = messages.slice(-maxMessages)
  const filtered = recent.filter(m => m.role === 'user' || m.role === 'assistant')
  return filtered as Array<{ role: 'user' | 'assistant'; content: string }>
}
