// Skill 執行環境：提供 LLM 呼叫與 fal-ai 圖片生成，注入給各 skill 的 run()。
import { generateTextByChain } from '@/lib/ai/proxy-fallback'
import { fal } from '@fal-ai/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateNanoBanana } from '@/lib/ai/nano-banana'
import type { SkillRunContext } from './registry'

const STORAGE_BUCKET = 'marketing-assets'

// fal TTS 模型與音色（如需更換模型/音色，調整此處即可）
const FAL_TTS_ENDPOINT = 'fal-ai/playai/tts/v3'
const FAL_TTS_VOICES: Record<string, string> = {
  default: 'Jennifer (English (US)/American)',
  female: 'Jennifer (English (US)/American)',
  male: 'Dexter (English (US)/American)',
}

export function createSkillContext(userId?: string, knowledge?: string): SkillRunContext {
  return {
    knowledge,
    async callModel({ system, prompt, maxOutputTokens = 2000 }) {
      // 內建專家「知識附掛」：PRO+ 使用者為該專家掛載的知識，於此統一注入 system prompt，
      // 讓每個 skill 皆可套用；knowledge 為空時行為不變（見 /api/skills/run）。
      const finalSystem = knowledge ? `${system}\n\n${knowledge}` : system
      // 免費優先（CLIProxy → FreeLLM → Claude Haiku 5.5 → Sonnet 5.5），用量由 fallback 自動記錄
      const { result: res } = await generateTextByChain('content', {
        system: finalSystem,
        messages: [{ role: 'user', content: prompt }],
        maxOutputTokens,
      }, { feature: 'skills', timeoutMs: 120000 })
      const usage = (res.usage ?? {}) as unknown as Record<string, number | undefined>
      const inTokens = usage.inputTokens ?? 0
      const outTokens = usage.outputTokens ?? 0

      return {
        text: res.text,
        inputTokens: inTokens,
        outputTokens: outTokens,
      }
    },

    async generateImage(prompt, aspectRatio = '16:9') {
      // 文字生圖統一使用 Nano Banana Pro（FLUX 僅用於修圖）
      return generateNanoBanana({ prompt, aspectRatio })
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

    async storeFile(bytes, filename, contentType) {
      const admin = createAdminClient()
      const path = `${userId ?? 'skills'}/${filename}`
      const { error } = await admin.storage
        .from(STORAGE_BUCKET)
        .upload(path, bytes, { contentType, upsert: false })
      if (error) throw new Error(`檔案上傳失敗：${error.message}`)
      const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path)
      return data.publicUrl
    },
  }
}
