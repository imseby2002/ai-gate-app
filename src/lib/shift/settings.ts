// 排班邏輯設定：公司預設（store='*'）＋各門市覆寫。AI 排班與人數需求估算都依此設定。
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export interface ShiftSettings {
  openStart: number        // 營業開始（分鐘）
  openEnd: number          // 營業結束（分鐘）
  partMinHours: number     // 工讀每班最短時數
  partMaxHours: number     // 工讀每班最長時數
  fullShiftHours: number   // 正職每班時數
  fullDaysMin: number      // 正職每週最少上班天數
  fullDaysMax: number      // 正職每週最多上班天數
  maxConsecutiveDays: number // 最多連續上班天數
  minRestHours: number     // 兩班之間最少休息時數
  minStaff: number         // 營業中最少人數
  maxStaff: number         // 同一時段最多人數
  cupsPerStaffHour: number // 每人每小時可做杯數（估算需求用）
  holidayFactor: number    // 假日業績倍數（歷史資料不足時使用）
  aiNotes: string          // 其他給 AI 的排班規則（自由輸入）
}

export const DEFAULT_SETTINGS: ShiftSettings = {
  openStart: 7 * 60, openEnd: 23 * 60,
  partMinHours: 3, partMaxHours: 5, fullShiftHours: 8, fullDaysMin: 5, fullDaysMax: 6,
  maxConsecutiveDays: 6, minRestHours: 10, minStaff: 1, maxStaff: 6,
  cupsPerStaffHour: 40, holidayFactor: 1.3, aiNotes: '',
}

const NUM_LIMITS: Record<Exclude<keyof ShiftSettings, 'aiNotes'>, [number, number]> = {
  openStart: [0, 1440], openEnd: [0, 1440], partMinHours: [1, 12], partMaxHours: [1, 12], fullShiftHours: [4, 12],
  fullDaysMin: [1, 7], fullDaysMax: [1, 7], maxConsecutiveDays: [1, 14], minRestHours: [0, 24],
  minStaff: [0, 20], maxStaff: [1, 50], cupsPerStaffHour: [1, 1000], holidayFactor: [0.3, 5],
}

/** 清理使用者輸入：只留認得的欄位，數字限制在合理範圍 */
export function sanitizeSettings(raw: unknown): Partial<ShiftSettings> {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: Partial<ShiftSettings> = {}
  for (const [k, [lo, hi]] of Object.entries(NUM_LIMITS) as [keyof typeof NUM_LIMITS, [number, number]][]) {
    if (src[k] === '' || src[k] == null) continue
    const n = Number(src[k])
    if (Number.isFinite(n)) (out as Record<string, number>)[k] = Math.min(hi, Math.max(lo, k === 'holidayFactor' ? Math.round(n * 100) / 100 : Math.round(n)))
  }
  if (typeof src.aiNotes === 'string') out.aiNotes = src.aiNotes.trim().slice(0, 1000)
  return out
}

/** 公司預設＋門市覆寫，合併成實際使用的設定 */
export async function loadSettings(db: Admin, owner: string, store: string) {
  const { data } = await db.from('shift_settings').select('store, settings').eq('owner_id', owner).in('store', ['*', store])
  const company = sanitizeSettings(data?.find(r => r.store === '*')?.settings)
  const own = store === '*' ? {} : sanitizeSettings(data?.find(r => r.store === store)?.settings)
  const merged: ShiftSettings = { ...DEFAULT_SETTINGS, ...company, ...own }
  if (merged.openEnd <= merged.openStart) merged.openEnd = Math.min(1440, merged.openStart + 60)
  if (merged.partMaxHours < merged.partMinHours) merged.partMaxHours = merged.partMinHours
  if (merged.fullDaysMax < merged.fullDaysMin) merged.fullDaysMax = merged.fullDaysMin
  if (merged.maxStaff < merged.minStaff) merged.maxStaff = merged.minStaff
  return { merged, company, own }
}

export async function holidaysBetween(db: Admin, owner: string, from: string, to: string) {
  const { data } = await db.from('shift_holidays').select('date, name').eq('owner_id', owner).gte('date', from).lte('date', to).order('date')
  return (data ?? []) as { date: string; name: string }[]
}

/** 越南勞動法固定日期的國定假日（陽曆）；農曆年、雄王忌日每年日期不同，請自行新增 */
export function vnFixedHolidays(year: number) {
  return [
    { date: `${year}-01-01`, name: 'Tết Dương lịch / 元旦' },
    { date: `${year}-04-30`, name: 'Ngày Giải phóng miền Nam / 南方解放日' },
    { date: `${year}-05-01`, name: 'Quốc tế Lao động / 勞動節' },
    { date: `${year}-09-02`, name: 'Quốc khánh / 國慶日' },
  ]
}
