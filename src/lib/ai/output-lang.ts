/**
 * 依介面 locale 產生「AI 輸出語言」指令，附加到 prompt 末端，
 * 讓 AI 生成內容跟隨使用者目前介面語言，而非預設中文。
 */
const LANG_NAME: Record<string, string> = {
  'zh-TW': '繁體中文',
  zh: '繁體中文',
  en: 'English',
  vi: 'Tiếng Việt',
}

export function outputLangInstruction(locale?: string): string {
  const name = LANG_NAME[locale ?? 'zh-TW'] ?? '繁體中文'
  return `\n\n【輸出語言要求】所有人類可讀的文字內容（標題、文案、描述、說明等）一律使用「${name}」輸出。JSON 的 key 名稱與英文圖片生成提示詞（visual_prompt_en / image_prompts 等標明為英文者）維持英文不變。`
}
