// FEELING TEA (啡靈茶飲) 門市標準清單
// 依照門市營運需求，門市名稱一律使用完整門市地址（不使用簡稱或代碼簡寫），便於員工在各系統下拉選單中直覺識別與選取。

export interface FeelingTeaStore {
  code: string
  name: string
  address: string
  aliases: string[]
}

export const FEELING_TEA_STORES: FeelingTeaStore[] = [
  { code: 'YL', name: '61 Yên Lãng', address: '61 Yên Lãng', aliases: ['61 Yên Lãng', 'Yên Lãng', 'YL', '怡朗', '怡朗店'] },
  { code: 'DC', name: '20 Đội Cấn', address: '20 Đội Cấn', aliases: ['20 Đội Cấn', 'Đội Cấn', 'DC'] },
  { code: 'NL', name: '162 Ngọc Lâm', address: '162 Ngọc Lâm', aliases: ['162 Ngọc Lâm', 'Ngọc Lâm', 'NL'] },
  { code: 'HBT', name: '53C Hai Bà Trưng', address: '53C Hai Bà Trưng', aliases: ['53C Hai Bà Trưng', 'Hai Bà Trưng', 'HBT'] },
  { code: 'MK', name: '406 Minh Khai', address: '406 Minh Khai', aliases: ['406 Minh Khai', 'Minh Khai', 'MK'] },
  { code: 'RNT', name: 'Royal Nguyễn Trãi', address: 'Royal Nguyễn Trãi', aliases: ['Royal Nguyễn Trãi', 'Royal', 'Nguyễn Trãi', 'RNT', 'RN', 'Roy'] },
  { code: 'TTT', name: '4 Trần Thái Tông', address: '4 Trần Thái Tông', aliases: ['4 Trần Thái Tông', 'Trần Thái Tông', 'TTT'] },
  { code: 'QT', name: '169 Quang Trung', address: '169 Quang Trung', aliases: ['169 Quang Trung', 'Quang Trung', 'QT'] },
  { code: 'KH', name: '22 Khương Hạ', address: '22 Khương Hạ', aliases: ['22 Khương Hạ', 'Khương Hạ', 'KH'] },
  { code: 'HTM', name: '217 Hồ Tùng Mậu', address: '217 Hồ Tùng Mậu', aliases: ['217 Hồ Tùng Mậu', 'Hồ Tùng Mậu', 'HTM'] },
  { code: 'GV', name: '155 Giảng Võ', address: '155 Giảng Võ', aliases: ['155 Giảng Võ', 'Giảng Võ', 'GV'] },
  { code: 'KT', name: '219C Khâm Thiên', address: '219C Khâm Thiên', aliases: ['219C Khâm Thiên', 'Khâm Thiên', 'KT'] },
  { code: 'CL', name: '163 Chùa Láng', address: '163 Chùa Láng', aliases: ['163 Chùa Láng', 'Chùa Láng', 'CL'] },
  { code: 'TKC', name: '422 Trần Khát Chân', address: '422 Trần Khát Chân', aliases: ['422 Trần Khát Chân', 'Trần Khát Chân', 'TKC'] },
  { code: 'NH', name: '137 Ngọc Hồi', address: '137 Ngọc Hồi', aliases: ['137 Ngọc Hồi', 'Ngọc Hồi', 'NH'] },
  { code: 'TM', name: '128 Tân Mai', address: '128 Tân Mai', aliases: ['128 Tân Mai', 'Tân Mai', 'TM'] },
  { code: 'TN', name: '11 Thanh Niên', address: '11 Thanh Niên', aliases: ['11 Thanh Niên', 'Thanh Niên', 'TN'] },
  { code: 'CG', name: '45 Cầu Gỗ', address: '45 Cầu Gỗ', aliases: ['45 Cầu Gỗ', 'Cầu Gỗ', 'CG', 'CGO'] },
  { code: 'BM', name: '307C Bạch Mai', address: '307C Bạch Mai', aliases: ['307C Bạch Mai', 'Bạch Mai', 'BM'] },
  { code: 'PNT', name: '100 Phạm Ngọc Thạch', address: '100 Phạm Ngọc Thạch', aliases: ['100 Phạm Ngọc Thạch', 'Phạm Ngọc Thạch', 'PNT'] },
  { code: 'HĐ', name: '106 Phố Xốm (Hà Đông)', address: '106 Phố Xốm (Hà Đông)', aliases: ['106 Phố Xốm (Hà Đông)', '106 Phố Xốm', 'Phố Xốm', 'Hà Đông', 'HĐ', 'HD'] },
  { code: 'KN', name: '491 Kim Ngưu', address: '491 Kim Ngưu', aliases: ['491 Kim Ngưu', 'Kim Ngưu', 'KN'] },
  { code: 'NPS', name: '8 Nguyễn Phong Sắc', address: '8 Nguyễn Phong Sắc', aliases: ['8 Nguyễn Phong Sắc', 'Nguyễn Phong Sắc', 'NPS'] },
  { code: 'NH CH', name: '137 Ngọc Hồi (CH)', address: '137 Ngọc Hồi (CH)', aliases: ['137 Ngọc Hồi (CH)', 'NH CH', 'NHCH', 'Ngọc Hồi CH'] },
]

export const FEELING_TEA_STORE_NAMES: string[] = FEELING_TEA_STORES.map(s => s.name)

/**
 * 依據代碼、簡寫、舊名稱或帶前綴名稱比對出標準地址門市名稱
 * 全面過濾代碼前綴（如 BM · 、CL · ），一律回傳乾淨完整地址
 */
export function getFeelingTeaStoreName(codeOrName: string | undefined | null): string {
  if (!codeOrName) return ''
  let trimmed = codeOrName.trim()
  if (!trimmed) return ''

  // 1. 去除 "Feeling Tea - " 等品牌前綴
  trimmed = trimmed.replace(/^\s*feeling\s*tea\s*[-–:·・]\s*/i, '').trim()

  const lower = trimmed.toLowerCase()
  let matched = FEELING_TEA_STORES.find(s =>
    s.code.toLowerCase() === lower ||
    s.name.toLowerCase() === lower ||
    s.aliases.some(a => a.toLowerCase() === lower)
  )
  if (matched) return matched.name

  // 2. 若含有代碼分隔符號（如 "BM · Bạch Mai", "CL - Chùa Láng", "HĐ · 106 Phố Xốm"）
  // 嘗試分別比對第一段（代碼）與第二段（名稱）
  const parts = trimmed.split(/\s*[·•・\-–:]\s*/).map(p => p.trim()).filter(Boolean)
  if (parts.length > 1) {
    for (const part of parts) {
      const pLower = part.toLowerCase()
      matched = FEELING_TEA_STORES.find(s =>
        s.code.toLowerCase() === pLower ||
        s.name.toLowerCase() === pLower ||
        s.aliases.some(a => a.toLowerCase() === pLower)
      )
      if (matched) return matched.name
    }
  }

  // 3. 子字串比對（例如名稱中包含 "bạch mai", "chùa láng", "yên lãng", "phố xốm" 等）
  for (const s of FEELING_TEA_STORES) {
    for (const a of s.aliases) {
      if (a.length >= 3 && lower.includes(a.toLowerCase())) {
        return s.name
      }
    }
  }

  // 4. 若仍未比對出，但前面有代碼前綴（如 "ABC · 某某門市"），去掉代碼前綴回傳乾淨名稱
  if (parts.length > 1 && parts[1]) {
    return parts.slice(1).join(' ')
  }

  return trimmed
}
