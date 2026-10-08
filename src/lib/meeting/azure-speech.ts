import type * as SpeechSDKType from 'microsoft-cognitiveservices-speech-sdk'

export interface AzureSpeechToken {
  configured: boolean
  token?: string
  region?: string
}

export async function fetchAzureSpeechToken(): Promise<AzureSpeechToken> {
  try {
    const res = await fetch('/api/meeting/azure-token')
    if (!res.ok) return { configured: false }
    const data = await res.json()
    return data
  } catch (e) {
    console.warn('[AzureSpeech] Failed to fetch token:', e)
    return { configured: false }
  }
}

export interface AzureRecognitionController {
  stop: () => Promise<void>
}

export async function startAzureRecognition(options: {
  token: string
  region: string
  mode: 'online' | 'in_person'
  defaultLang: string
  onRecognized: (text: string, speakerLabel?: string, detectedLang?: string) => void
  onError?: (err: unknown) => void
}): Promise<AzureRecognitionController> {
  const SpeechSDK = await import('microsoft-cognitiveservices-speech-sdk')

  const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(options.token, options.region)
  speechConfig.enableDictation()

  // 支援越南文、繁體中文、英文即時自動語言偵測
  const autoDetectConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages([
    'vi-VN',
    'zh-TW',
    'en-US',
  ])

  const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput()

  function resolveLanguage(result: SpeechSDKType.SpeechRecognitionResult, fallback: string): string {
    try {
      const autoRes = SpeechSDK.AutoDetectSourceLanguageResult.fromResult(result)
      if (autoRes?.language) {
        if (autoRes.language.toLowerCase().startsWith('zh')) return 'zh-TW'
        if (autoRes.language.toLowerCase().startsWith('vi')) return 'vi'
        if (autoRes.language.toLowerCase().startsWith('en')) return 'en'
      }
    } catch {}
    return fallback
  }

  // 實體會議：啟用多人語音分離 (ConversationTranscriber Diarization)
  if (options.mode === 'in_person') {
    const transcriber = new SpeechSDK.ConversationTranscriber(speechConfig, audioConfig, autoDetectConfig)

    transcriber.transcribed = (_s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text?.trim()) {
        const text = e.result.text.trim()
        const speakerRaw = e.result.speakerId || 'Guest-1'
        const speakerLabel = formatSpeakerLabel(speakerRaw)
        const lang = resolveLanguage(e.result, options.defaultLang)
        options.onRecognized(text, speakerLabel, lang)
      }
    }

    transcriber.canceled = (_s, e) => {
      if (e.reason === SpeechSDK.CancellationReason.Error) {
        console.warn('[AzureSpeech] Transcriber error:', e.errorDetails)
        options.onError?.(e.errorDetails)
      }
    }

    await new Promise<void>((resolve, reject) => {
      transcriber.startTranscribingAsync(
        () => resolve(),
        (err) => reject(err),
      )
    })

    return {
      stop: async () => {
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
  const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, autoDetectConfig, audioConfig)

  recognizer.recognized = (_s, e) => {
    if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text?.trim()) {
      const text = e.result.text.trim()
      const lang = resolveLanguage(e.result, options.defaultLang)
      options.onRecognized(text, undefined, lang)
    }
  }

  recognizer.canceled = (_s, e) => {
    if (e.reason === SpeechSDK.CancellationReason.Error) {
      console.warn('[AzureSpeech] Recognizer error:', e.errorDetails)
      options.onError?.(e.errorDetails)
    }
  }

  await new Promise<void>((resolve, reject) => {
    recognizer.startContinuousRecognitionAsync(
      () => resolve(),
      (err) => reject(err),
    )
  })

  return {
    stop: async () => {
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
