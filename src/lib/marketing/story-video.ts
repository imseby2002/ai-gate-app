/**
 * 多分鏡配音影片（Story Video）共用邏輯。
 * 流程：分鏡旁白（LLM）→ 每段產圖（Nano Banana Pro）＋ ElevenLabs 配音 → worker 套版型、合成、加背景音樂。
 * 分鏡流程與版型概念參考 Pixelle-Video（AIDC-AI，Apache-2.0）。
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { NANO_BANANA_PRO_FAL_COST, ttsCost } from '@/lib/marketing/billing'

/** 功能開關：worker VM 建好後於 Vercel 設 STORY_VIDEO_ENABLED=true 才開放 */
export const storyVideoEnabled = () => process.env.STORY_VIDEO_ENABLED === 'true'
export const STORY_DISABLED_MSG = '多分鏡配音影片尚未開放'

export const STORY_TEMPLATES = ['classic', 'fullbleed', 'card'] as const
export type StoryTemplate = (typeof STORY_TEMPLATES)[number]

export const STORY_ASPECTS = ['9:16', '16:9', '1:1'] as const
export type StoryAspect = (typeof STORY_ASPECTS)[number]

export const STORY_MAX_SCENES = 12
export const STORY_MAX_NARRATION = 300
export const STORY_TTS_MODEL = 'eleven_multilingual_v2'

export interface StoryScene {
  narration: string
  visual_prompt: string
  image_url?: string | null
  audio_url?: string | null
}

/** 預估成本（美元）：未附圖的分鏡各產一張圖，全部旁白配音 */
export function estimateStoryCost(scenes: StoryScene[]): number {
  return scenes.reduce(
    (sum, s) => sum + (s.image_url ? 0 : NANO_BANANA_PRO_FAL_COST) + ttsCost(s.narration, STORY_TTS_MODEL),
    0,
  )
}

/** ElevenLabs 配音 → 上傳 marketing-assets，回傳公開網址 */
export async function synthesizeNarration(
  admin: SupabaseClient,
  userId: string,
  text: string,
  voiceId: string,
  key: string,
): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY 未設定')

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: STORY_TTS_MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.detail?.message ?? `ElevenLabs TTS 失敗 (${res.status})`)
  }

  const path = `${userId}/story-${key}.mp3`
  const { error } = await admin.storage
    .from('marketing-assets')
    .upload(path, await res.arrayBuffer(), { contentType: 'audio/mpeg', upsert: true })
  if (error) throw new Error(`Storage 上傳失敗：${error.message}`)
  return admin.storage.from('marketing-assets').getPublicUrl(path).data.publicUrl
}

/** 分鏡畫面提示詞：加上直式／橫式構圖與「不要文字」，避免畫面文字和字幕打架 */
export function sceneImagePrompt(visualPrompt: string, aspect: StoryAspect): string {
  const framing = aspect === '9:16' ? 'vertical composition' : aspect === '16:9' ? 'wide horizontal composition' : 'square composition'
  return `${visualPrompt.trim()}, ${framing}, high quality, cinematic lighting, no text, no letters, no watermark`
}
