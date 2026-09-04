// 品項模糊比對：以字元 bigram（2-gram）計算 Dice 係數，中英文/越南文皆適用，不需外部套件。
// 用於「同一品項不同廠商歷史採購價」比對——採購紀錄的品項是自由輸入文字，
// 不同人打字習慣不同（例如「台灣茶葉」vs「茶葉」），需要模糊比對才抓得到同一品項。
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[\s,，。.\-_/()（）]/g, '')
}

function bigrams(s: string): Set<string> {
  const n = normalize(s)
  if (n.length < 2) return new Set(n ? [n] : [])
  const set = new Set<string>()
  for (let i = 0; i < n.length - 1; i++) set.add(n.slice(i, i + 2))
  return set
}

// 回傳 0~1 的相似度分數（Dice 係數）。
export function similarity(a: string, b: string): number {
  const A = bigrams(a), B = bigrams(b)
  if (A.size === 0 || B.size === 0) return 0
  let overlap = 0
  for (const g of A) if (B.has(g)) overlap++
  return (2 * overlap) / (A.size + B.size)
}

export const FUZZY_MATCH_THRESHOLD = 0.34
