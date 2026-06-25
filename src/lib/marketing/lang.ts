/**
 * 行銷模組共用：語言代碼 → 語言名稱 + 輸出語言指示。
 * 規則：用哪種語言就以哪種語言回應，除非使用者指示中另有指定。
 */
const LANG_NAMES: Record<string, string> = {
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  'en': 'English',
  'vi': 'Tiếng Việt',
}

export function langName(code?: string): string {
  return LANG_NAMES[code ?? ''] ?? '繁體中文'
}

/** 給 prompt 用的輸出語言強制指示（含標題一律使用該語言）。 */
export function langInstruction(code?: string): string {
  const name = langName(code)
  return `請務必「全部」以 ${name} 輸出，包含所有標題、欄位與內容；即使來源資料是其他語言也要翻譯成 ${name}。`
}
