// 自動排班建議：在每個（日期×時段）於「可上班」者中挑人，並平衡各員工被指派的總班數。
import type { Slot } from './util'

export interface AvailRow { employee_id: string; work_date: string; slot_code: string }
export interface Assign { employee_id: string; work_date: string; slot_code: string }

// need：每格需要的人數（預設 1）。回傳建議指派清單。
export function computeSuggestion(dates: string[], slots: Slot[], availability: AvailRow[], need = 1): Assign[] {
  // 可上班索引：`date|slot` → 員工清單
  const availByCell = new Map<string, string[]>()
  for (const a of availability) {
    const k = `${a.work_date}|${a.slot_code}`
    ;(availByCell.get(k) ?? availByCell.set(k, []).get(k)!).push(a.employee_id)
  }
  const load = new Map<string, number>() // 員工 → 已指派班數
  const out: Assign[] = []

  for (const d of dates) {
    for (const slot of slots) {
      const k = `${d}|${slot.code}`
      const pool = availByCell.get(k) ?? []
      if (pool.length === 0) continue
      // 依目前負載升冪挑人（負載相同者維持穩定順序），挑 need 位
      const picked = [...pool]
        .sort((x, y) => (load.get(x) ?? 0) - (load.get(y) ?? 0))
        .slice(0, Math.max(1, need))
      for (const emp of picked) {
        out.push({ employee_id: emp, work_date: d, slot_code: slot.code })
        load.set(emp, (load.get(emp) ?? 0) + 1)
      }
    }
  }
  return out
}
