import type * as SpeechSDKType from 'microsoft-cognitiveservices-speech-sdk'

export interface AzureSpeechToken {
  configured: boolean
  token?: string
  region?: string
}

export async function fetchAzureSpeechToken(): Promise<AzureSpeechToken> {
  try {
    const res = await fetch('/api/meeting/azure-token', { cache: 'no-store' })
    if (!res.ok) return { configured: false }
    const data = await res.json()
    return data
  } catch (e) {
    console.warn('[AzureSpeech] Failed to fetch token:', e)
    return { configured: false }
  }
}

// SDK 體積大，進入會議時先預載，按「開始錄音」才不會卡數十秒
let sdkPromise: Promise<typeof SpeechSDKType> | null = null
export function preloadAzureSpeechSdk(): Promise<typeof SpeechSDKType> {
  if (!sdkPromise) {
    sdkPromise = import('microsoft-cognitiveservices-speech-sdk').catch(e => {
      sdkPromise = null
      throw e
    })
  }
  return sdkPromise
}

export interface AzureRecognitionController {
  stop: () => Promise<void>
}

// Azure 授權 token 有效 10 分鐘，提前更新避免重連時以過期 token 失敗
const TOKEN_REFRESH_MS = 8 * 60 * 1000

export async function startAzureRecognition(options: {
  token: string
  region: string
  mode: 'online' | 'in_person'
  /** 辨識語言（app 代碼 zh-TW / vi / en），第一個為主要語言；只有一個時不做自動偵測 */
  languages: string[]
  onRecognized: (text: string, speakerLabel?: string, detectedLang?: string) => void
  onInterim?: (text: string, speakerLabel?: string) => void
  onError?: (err: unknown) => void
}): Promise<AzureRecognitionController> {
  const SpeechSDK = await preloadAzureSpeechSdk()

  const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(options.token, options.region)
  const LOCALES: Record<string, string> = { 'zh-TW': 'zh-TW', vi: 'vi-VN', en: 'en-US' }
  const locales = options.languages.map(l => LOCALES[l]).filter(Boolean)
  if (!locales.length) locales.push('zh-TW')
  const primaryLang = options.languages.find(l => LOCALES[l]) ?? 'zh-TW'

  // 只有一種語言時不做自動偵測，避免誤判
  let autoDetectConfig: SpeechSDKType.AutoDetectSourceLanguageConfig | null = null
  if (locales.length === 1) {
    speechConfig.speechRecognitionLanguage = locales[0]
  } else {
    autoDetectConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(locales)
    // 持續語言偵測：每句重新判斷中/越/英（預設 AtStart 只在開頭判斷一次，之後整段鎖定同一語言）
    autoDetectConfig.mode = SpeechSDK.LanguageIdMode.Continuous
  }

  const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput()

  // 偵測不出語言時以主要語言為準
  function resolveLanguage(result: SpeechSDKType.SpeechRecognitionResult): string {
    try {
      const autoRes = SpeechSDK.AutoDetectSourceLanguageResult.fromResult(result)
      if (autoRes?.language) {
        if (autoRes.language.toLowerCase().startsWith('zh')) return 'zh-TW'
        if (autoRes.language.toLowerCase().startsWith('vi')) return 'vi'
        if (autoRes.language.toLowerCase().startsWith('en')) return 'en'
      }
    } catch {}
    return primaryLang
  }

  let stopped = false
  let refreshTimer: ReturnType<typeof setInterval> | null = null
  const fail = (err: unknown) => {
    if (stopped) return
    stopped = true
    if (refreshTimer) clearInterval(refreshTimer)
    options.onError?.(err)
  }

  const startRefresh = (target: { authorizationToken: string }) => {
    refreshTimer = setInterval(async () => {
      const t = await fetchAzureSpeechToken()
      if (!stopped && t.configured && t.token) target.authorizationToken = t.token
    }, TOKEN_REFRESH_MS)
  }

  // 實體會議：啟用多人語音分離 (ConversationTranscriber Diarization)
  if (options.mode === 'in_person') {
    const transcriber = autoDetectConfig
      ? SpeechSDK.ConversationTranscriber.FromConfig(speechConfig, autoDetectConfig, audioConfig)
      : new SpeechSDK.ConversationTranscriber(speechConfig, audioConfig)

    transcriber.transcribing = (_s, e) => {
      if (e.result.text?.trim()) {
        options.onInterim?.(e.result.text.trim(), e.result.speakerId ? formatSpeakerLabel(e.result.speakerId) : undefined)
      }
    }

    transcriber.transcribed = (_s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text?.trim()) {
        const text = e.result.text.trim()
        const speakerRaw = e.result.speakerId || 'Guest-1'
        const speakerLabel = formatSpeakerLabel(speakerRaw)
        const lang = resolveLanguage(e.result as unknown as SpeechSDKType.SpeechRecognitionResult)
        options.onRecognized(text, speakerLabel, lang)
      }
    }

    transcriber.canceled = (_s, e) => {
      console.warn('[AzureSpeech] Transcriber canceled:', e.reason, e.errorDetails)
      fail(e.errorDetails || 'canceled')
    }
    transcriber.sessionStopped = () => fail('session stopped')

    await new Promise<void>((resolve, reject) => {
      transcriber.startTranscribingAsync(
        () => resolve(),
        (err) => reject(err),
      )
    })
    startRefresh(transcriber)

    return {
      stop: async () => {
        stopped = true
        if (refreshTimer) clearInterval(refreshTimer)
        try {
          await new Promise<void>((resolve) => {
            transcriber.stopTranscribingAsync(() => resolve(), () => resolve())
          })
          transcriber.close()
        } catch (e) {
          console.warn('[AzureSpeech] Transcriber stop error:', e)
        }
      },
    }
  }

  // 線上會議：單人獨立收音辨識 (SpeechRecognizer)
  const recognizer = autoDetectConfig
    ? SpeechSDK.SpeechRecognizer.FromConfig(speechConfig, autoDetectConfig, audioConfig)
    : new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig)

  recognizer.recognizing = (_s, e) => {
    if (e.result.text?.trim()) options.onInterim?.(e.result.text.trim())
  }

  recognizer.recognized = (_s, e) => {
    if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text?.trim()) {
      const text = e.result.text.trim()
      const lang = resolveLanguage(e.result)
      options.onRecognized(text, undefined, lang)
    }
  }

  recognizer.canceled = (_s, e) => {
    console.warn('[AzureSpeech] Recognizer canceled:', e.reason, e.errorDetails)
    fail(e.errorDetails || 'canceled')
  }
  recognizer.sessionStopped = () => fail('session stopped')

  await new Promise<void>((resolve, reject) => {
    recognizer.startContinuousRecognitionAsync(
      () => resolve(),
      (err) => reject(err),
    )
  })
  startRefresh(recognizer)

  return {
    stop: async () => {
      stopped = true
      if (refreshTimer) clearInterval(refreshTimer)
      try {
        await new Promise<void>((resolve) => {
          recognizer.stopContinuousRecognitionAsync(() => resolve(), () => resolve())
        })
        recognizer.close()
      } catch (e) {
        console.warn('[AzureSpeech] Recognizer stop error:', e)
      }
    },
  }
}

function formatSpeakerLabel(rawId: string): string {
  // Guest-1 -> 講者 1 / Speaker 1
  const match = rawId.match(/Guest-(\d+)/i)
  if (match) {
    return `講者 ${match[1]}`
  }
  return rawId
}
