/**
 * Temporal Validity Engine (法律時態時效性判定引擎)
 *
 * 嚴格以特定基準日（Target Date / Current Date）動態計算法律文件與條文之有效性：
 * - 判斷是否尚未生效 (NOT_YET_EFFECTIVE)
 * - 判斷是否現行有效 (ACTIVE)
 * - 判斷是否已被修改 (AMENDED)
 * - 判斷是否已被廢止 (REPEALED)
 * - 判斷是否已屆期失效 (EXPIRED)
 */

import { LegalStatus, LegalDocument, LegalNode } from './types'

export interface TemporalEvaluationResult {
  status: LegalStatus
  is_currently_effective: boolean
  effective_date: string
  expiry_date?: string | null
  notice_vi: string
  notice_zh: string
  days_until_effective?: number
  days_since_expired?: number
}

export class TemporalValidityEngine {
  /**
   * 評估法規或條文在特定日期的時效狀態
   * @param effectiveDate 生效日 (YYYY-MM-DD)
   * @param expiryDate 失效日 (YYYY-MM-DD, 可為 null)
   * @param explicitStatus 資料庫記錄的狀態
   * @param targetDate 查詢基準日 (預設為當前日期)
   */
  public evaluateValidity(
    effectiveDate: string,
    expiryDate?: string | null,
    explicitStatus: LegalStatus = 'ACTIVE',
    targetDate: string = new Date().toISOString().slice(0, 10)
  ): TemporalEvaluationResult {
    const tDate = new Date(targetDate).getTime()
    const effDate = new Date(effectiveDate).getTime()
    const expDate = expiryDate ? new Date(expiryDate).getTime() : null

    // 1. 若查詢日期小於生效日期：尚未生效
    if (tDate < effDate) {
      const diffDays = Math.ceil((effDate - tDate) / (1000 * 60 * 60 * 24))
      return {
        status: 'NOT_YET_EFFECTIVE',
        is_currently_effective: false,
        effective_date: effectiveDate,
        expiry_date: expiryDate,
        days_until_effective: diffDays,
        notice_vi: `Văn bản đã được ban hành nhưng CHƯA CÓ HIỆU LỰC thi hành. Có hiệu lực từ ngày ${effectiveDate} (còn ${diffDays} ngày nữa).`,
        notice_zh: `🕒 本法規已發布，但【尚未生效】。正式生效日期為 ${effectiveDate}（距今尚有 ${diffDays} 天）。在生效日前仍應以既有法規為準。`,
      }
    }

    // 2. 若有失效日且查詢日期大於失效日期：已失效 / 廢止
    if (expDate && tDate >= expDate) {
      const diffDays = Math.floor((tDate - expDate) / (1000 * 60 * 60 * 24))
      const isRepealed = explicitStatus === 'REPEALED'
      return {
        status: isRepealed ? 'REPEALED' : 'EXPIRED',
        is_currently_effective: false,
        effective_date: effectiveDate,
        expiry_date: expiryDate,
        days_since_expired: diffDays,
        notice_vi: isRepealed
          ? `Văn bản đã BỊ BÃI BỎ từ ngày ${expiryDate}. Hiện tại không còn giá trị áp dụng.`
          : `Văn bản đã HẾT HIỆU LỰC từ ngày ${expiryDate}.`,
        notice_zh: isRepealed
          ? `❌ 本法規已於 ${expiryDate}【明令廢止】（已廢止 ${diffDays} 天），目前不再具備法律效力。`
          : `⚠️ 本法規已於 ${expiryDate}【屆期失效】（已失效 ${diffDays} 天）。`,
      }
    }

    // 3. 被修改狀態
    if (explicitStatus === 'AMENDED' || explicitStatus === 'PARTIALLY_AMENDED') {
      return {
        status: explicitStatus,
        is_currently_effective: true,
        effective_date: effectiveDate,
        expiry_date: expiryDate,
        notice_vi: `Văn bản ĐÃ ĐƯỢC SỬA ĐỔI, BỔ SUNG. Cần đối chiếu với văn bản sửa đổi mới nhất hoặc Văn bản hợp nhất.`,
        notice_zh: `⚠️ 本法規部分條文【已被修改或補充】。適用時必須對照最新修法條文或官方統一彙編版（Văn bản hợp nhất）。`,
      }
    }

    // 4. 現行有效
    return {
      status: 'ACTIVE',
      is_currently_effective: true,
      effective_date: effectiveDate,
      expiry_date: expiryDate,
      notice_vi: `Văn bản ĐANG CÓ HIỆU LỰC thi hành tại thời điểm ${targetDate}.`,
      notice_zh: `✅ 本法規於基準日（${targetDate}）【現行有效】。`,
    }
  }

  /**
   * 格式化條文時態標籤與警告訊息
   */
  public formatTemporalNotice(evalResult: TemporalEvaluationResult): string {
    if (!evalResult.is_currently_effective) {
      return `\n> [!WARNING]\n> ${evalResult.notice_zh}\n`
    }
    if (evalResult.status === 'AMENDED' || evalResult.status === 'PARTIALLY_AMENDED') {
      return `\n> [!NOTE]\n> ${evalResult.notice_zh}\n`
    }
    return ''
  }
}
