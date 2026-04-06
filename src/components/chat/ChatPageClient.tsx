'use client'

import { ChatInterface } from './ChatInterface'
import type { AIModel, Assistant } from '@/types/database'

interface ChatPageClientProps {
  models: AIModel[]
  assistant?: Assistant | null
}

export function ChatPageClient({ models, assistant }: ChatPageClientProps) {
  const handleConversationCreated = (id: string) => {
    window.history.replaceState(null, '', `/chat/${id}`)
  }

  return (
    <ChatInterface
      models={models}
      assistant={assistant}
      onConversationCreated={handleConversationCreated}
    />
  )
}
