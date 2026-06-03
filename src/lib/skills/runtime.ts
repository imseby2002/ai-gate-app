// Skill 執行環境：提供 LLM 呼叫與 fal-ai 圖片生成，注入給各 skill 的 run()。
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { fal } from '@fal-ai/client'
import type { SkillRunContext } from './registry'

const FAL_IMAGE_SIZES: Record<string, { width: number; height: number }> = {
  '1:1':  { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
}

// fal TTS 模型與音色（如需更換模型/音色，調整此處即可）
const FAL_TTS_ENDPOINT = 'fal-ai/playai/tts/v3'
const FAL_TTS_VOICES: Record<string, string> = {
  default: 'Jennifer (English (US)/American)',
  female: 'Jennifer (English (US)/American)',
  male: 'Dexter (English (US)/American)',
}

export function createSkillContext(): SkillRunContext {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY 未設定')
  }
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  return {
    async callModel({ system, prompt, maxOutputTokens = 2000 }) {
      const res = await generateText({
        model: anthropic('claude-sonnet-4-6'),
        system,
        messages: [{ role: 'user', content: prompt }],
        maxOutputTokens,
      })
      const usage = (res.usage ?? {}) as unknown as Record<string, number | undefined>
      return {
        text: res.text,
        inputTokens: usage.inputTokens ?? usage.promptTokens ?? 0,
        outputTokens: usage.outputTokens ?? usage.completionTokens ?? 0,
      }
    },

    async generateImage(prompt, aspectRatio = '16:9') {
      if (!process.env.FAL_AI_API_KEY) throw new Error('FAL_AI_API_KEY 未設定')
      const res = await fetch('https://fal.run/fal-ai/flux/dev', {
        method: 'POST',
        headers: {
          Authorization: `Key ${process.env.FAL_AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          image_size: FAL_IMAGE_SIZES[aspectRatio] ?? FAL_IMAGE_SIZES['16:9'],
          num_inference_steps: 28,
          num_images: 1,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'fal image error')
      return data.images?.[0]?.url ?? ''
    },

    async generateAudio(text, voice = 'default') {
      if (!process.env.FAL_AI_API_KEY) throw new Error('FAL_AI_API_KEY 未設定')
      fal.config({ credentials: process.env.FAL_AI_API_KEY })
      const result = await fal.subscribe(FAL_TTS_ENDPOINT, {
        input: {
          input: text.slice(0, 5000),
          voice: FAL_TTS_VOICES[voice] ?? FAL_TTS_VOICES.default,
        },
      })
      const data = (result?.data ?? result) as Record<string, unknown>
      const audio = data.audio as { url?: string } | undefined
      return audio?.url ?? (data.audio_url as string) ?? (data.url as string) ?? ''
    },
  }
}
