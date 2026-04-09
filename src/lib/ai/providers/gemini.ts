import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText } from 'ai'
import type { ChatParams } from './deepseek'

const MODEL_MAP: Record<string, string> = {
  'gemini-2.0-flash':          'gemini-2.5-flash',
  'gemini-2.0-flash-thinking': 'gemini-2.5-flash',
  'gemini-2.0-flash-vision':   'gemini-2.5-flash',
  'gemini-2.5-flash':          'gemini-2.5-flash',
}

export async function streamGemini(params: ChatParams & { imageBase64?: string }) {
  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_AI_API_KEY!,
  })

  const geminiModel = MODEL_MAP[params.modelId] ?? 'gemini-2.0-flash'
  const maxOut = params.maxTokens ?? 4096

  const baseMessages = params.systemPrompt
    ? [{ role: 'system' as const, content: params.systemPrompt }, ...params.messages]
    : params.messages

  if (params.imageBase64) {
    const lastMsg = baseMessages[baseMessages.length - 1]
    if (lastMsg.role === 'user') {
      const prior = baseMessages.slice(0, -1)
      const imageData = params.imageBase64.replace(/^data:image\/\w+;base64,/, '')

      const multiMessages = [
        ...prior,
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: lastMsg.content as string },
            { type: 'image' as const, image: imageData, mimeType: 'image/jpeg' as const },
          ],
        },
      ]

      return streamText({
        model: google(geminiModel),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: multiMessages as any,
        maxOutputTokens: maxOut,
      })
    }
  }

  return streamText({
    model: google(geminiModel),
    messages: baseMessages,
    maxOutputTokens: maxOut,
  })
}
