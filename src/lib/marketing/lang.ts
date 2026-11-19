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

/**
 * 依客人訊息文字與客戶裝置/LINE Locale 智慧偵測客人語言。
 */
export function detectMessageLanguage(text: string, clientLocale?: string): string {
  const trimmed = text.trim()

  // 1. 若包含中文字元（漢字），判斷為中文（以繁體為優先）
  if (/[\u4e00-\u9fa5]/.test(trimmed)) {
    return '繁體中文'
  }

  // 2. 日文假名
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(trimmed)) {
    return '日本語'
  }

  // 3. 韓文字元
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(trimmed)) {
    return '한국어'
  }

  // 4. 泰文字元
  if (/[\u0E00-\u0E7F]/.test(trimmed)) {
    return 'ภาษาไทย'
  }

  // 5. 越文聲調符號
  if (/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(trimmed)) {
    return 'Tiếng Việt'
  }

  // 6. 包含英文字母（且無中文字元）→ 判定為英文（或參考裝置語系）
  if (/[a-zA-Z]/.test(trimmed)) {
    if (clientLocale) {
      const loc = clientLocale.toLowerCase()
      if (loc.startsWith('fr')) return 'Français'
      if (loc.startsWith('de')) return 'Deutsch'
      if (loc.startsWith('es')) return 'Español'
      if (loc.startsWith('vi')) return 'Tiếng Việt'
      if (loc.startsWith('ja')) return '日本語'
      if (loc.startsWith('ko')) return '한국어'
      if (loc.startsWith('th')) return 'ภาษาไทย'
    }
    return 'English'
  }

  // 7. 純數字、符號或空字串（例如只傳訂單編號或圖片）→ 參考裝置語系，若無則預設繁中
  if (clientLocale) {
    const loc = clientLocale.toLowerCase()
    if (loc.startsWith('en')) return 'English'
    if (loc.startsWith('ja')) return '日本語'
    if (loc.startsWith('ko')) return '한국어'
    if (loc.startsWith('vi')) return 'Tiếng Việt'
    if (loc.startsWith('th')) return 'ภาษาไทย'
    if (loc.startsWith('zh-cn')) return '简体中文'
    if (loc.startsWith('zh')) return '繁體中文'
    if (loc.startsWith('fr')) return 'Français'
    if (loc.startsWith('de')) return 'Deutsch'
    if (loc.startsWith('es')) return 'Español'
  }

  return '繁體中文'
}
