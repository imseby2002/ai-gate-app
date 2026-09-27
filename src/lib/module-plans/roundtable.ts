// 智慧圓桌依方案收斂請求參數：超出方案的選項改回預設值（不整筆拒絕，
// 因為前端每次都會帶上目前畫面的席位／字數等設定，拒絕會讓低方案完全無法開會）。
import type { RoundtablePlanFeatures } from './definitions'

type Body = Record<string, unknown>

export function clampRoundtableBody<T extends Body>(body: T, f: RoundtablePlanFeatures): T {
  const out: Body = { ...body }
  if (!f.chooseDomain && 'domain' in out) out.domain = 'auto'
  if (!f.customSeats) {
    delete out.seats
    delete out.seatExpertIds
  }
  if (!f.rebuttal && 'rebuttal' in out) out.rebuttal = false
  if (!f.synthesisStyles && 'synthesisStyle' in out) out.synthesisStyle = 'default'
  if (!f.customModerator) {
    delete out.moderator
    delete out.moderatorModel
  }
  if (typeof out.verbosity === 'string' && !(f.verbosity as string[]).includes(out.verbosity)) {
    out.verbosity = f.verbosity.includes('standard_300') ? 'standard_300' : f.verbosity[0]
  }
  return out as T
}
