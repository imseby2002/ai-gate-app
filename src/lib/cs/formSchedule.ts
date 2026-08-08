/**
 * 表單的「哪幾天開放」判斷 —— 公開表單頁、CS 對話觸發、cron 共用。
 * 0=週日...6=週六，跟 JS Date.getDay() 慣例一致。
 */
const WEEKDAY_NAMES = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

export function taiwanWeekday(): number {
  const short = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Taipei', weekday: 'short' })
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(short)
}

export function isFormAvailableToday(availableWeekdays: number[] | null | undefined): boolean {
  if (!availableWeekdays || !availableWeekdays.length) return true
  return availableWeekdays.includes(taiwanWeekday())
}

export function weekdayLabel(n: number): string {
  return WEEKDAY_NAMES[n] ?? ''
}
