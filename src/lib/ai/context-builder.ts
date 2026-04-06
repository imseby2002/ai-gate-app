import type { Assistant, AssistantFile } from '@/types/database'

const MAX_CONTEXT_CHARS = 200_000 // ~80K tokens rough estimate

export function buildSystemPrompt(
  assistant: Assistant | null,
  files: AssistantFile[]
): string {
  const parts: string[] = []

  if (assistant?.system_prompt) {
    parts.push(assistant.system_prompt)
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
