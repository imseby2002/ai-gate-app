// 養號進度：系統不會自動操作社群帳號，每天產生一份「今日養號任務」供使用者以綁定 IP 的瀏覽器手動完成，
// 並推進天數。同一帳號同一天（台北時間）只推進一次。
import type { SocialAccount, SocialLog } from './types'

export const MATURE_DAY = 12

function taipeiDate(d: Date): string {
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

export function alreadyAdvancedToday(account: Pick<SocialAccount, 'last_action_at'>, now = new Date()): boolean {
  return !!account.last_action_at && taipeiDate(new Date(account.last_action_at)) === taipeiDate(now)
}

export function healthForDay(day: number): number {
  return day >= MATURE_DAY ? 90 : Math.min(89, 50 + day * 3)
}

export function planWarmup(account: Pick<SocialAccount, 'warmup_day'>): {
  actionType: SocialLog['action_type']
  details: string
  nextDay: number
} {
  const day = account.warmup_day
  if (day <= 3) {
    return { actionType: 'warmup_scroll', nextDay: day + 1,
      details: `【今日養號任務・階段一 靜默期 Day ${day}】請以綁定 IP 的瀏覽器登入，滑動態 15–30 分鐘、瀏覽 5–10 則熱門貼文；不發文、不私訊。` }
  }
  if (day <= 7) {
    return { actionType: 'warmup_like', nextDay: day + 1,
      details: `【今日養號任務・階段二 輕互動期 Day ${day}】瀏覽同業話題，按讚 2–4 則相關貼文、追蹤 1–2 個優質專頁、看完 1–2 支短影片。` }
  }
  if (day < MATURE_DAY) {
    return { actionType: 'warmup_comment', nextDay: day + 1,
      details: `【今日養號任務・階段三 社交融入期 Day ${day}】在目標社群留 1 則真實心得留言，參與 1 個話題討論；仍避免貼連結。` }
  }
  return { actionType: 'warmup_scroll', nextDay: Math.min(30, day + 1),
    details: `【今日養號任務・成熟期 Day ${day}】維持每日自然使用；可開始以方案 A（Copilot）發文，每日不超過帳號上限。` }
}
