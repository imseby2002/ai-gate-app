/**
 * 電話/簡訊 provider 抽象層。
 * 撥打與發送都走此介面，實作可在 Bird / Stringee 間切換（依成本）。
 * 由 TELEPHONY_PROVIDER 環境變數選擇，預設 'bird'。
 */

export interface VoiceCallParams {
  phone: string
  audioUrl: string        // 要播放的語音檔（ElevenLabs TTS 產生）
  callerId: string        // 顯示號碼
  collectDtmf?: boolean    // 播完是否收 1 碼按鍵（按鍵加入社群）
}

export interface SmsParams {
  phone: string
  text: string
}

export interface TelephonyProvider {
  /** provider 識別名，寫入 ivr_calls.provider */
  readonly name: string
  /** 是否已具備必要環境變數 */
  isConfigured(): boolean
  /** 外撥語音；回傳供應商 call id（失敗回 null） */
  call(p: VoiceCallParams): Promise<{ callId: string | null }>
  /** 發送 SMS；回傳是否成功 */
  sendSms(p: SmsParams): Promise<boolean>
}
