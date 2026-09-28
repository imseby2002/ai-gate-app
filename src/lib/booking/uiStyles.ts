// 官網風格庫：取自 joshhu/uitest（MIT License，57 種 UI 風格展示頁）。
// https://github.com/joshhu/uitest
//
// 原稿是整頁靜態 HTML + Tailwind CDN，無法直接塞進民宿官網；這裡只挑適合民宿官網、
// 淺色底可閱讀的風格，把每頁實際用到的配色、字體調性、圓角、陰影、留白轉成
// CustomDesignInput（同 AI 自由生成設計的格式），走 sanitizeCustomDesign() 驗證後套用。
// 儀表板類（#28–37）、深色／霓虹類（#06、#07、#41、#45、#51、#53…）不適合民宿官網，未收錄。
//
// 色碼優先用原稿 hex 或 Tailwind 對應值；原稿主色太淺、白字按鈕看不清時才調深，
// 並在該筆註明。中文標題字體只能從 CUSTOM_HEADING_FONTS 三選一（0 襯線、1 黑體、2 楷體），
// 以原稿英文字體的調性對應。

import type { CustomDesignInput } from './templates'

export const UI_STYLES_REPO = 'https://github.com/joshhu/uitest'

export interface UiStylePreset {
  id: string
  no: number
  name: string
  desc: string
  file: string
  design: Required<CustomDesignInput>
}

export const UI_STYLE_PRESETS: UiStylePreset[] = [
  {
    id: 'minimalism', no: 1, name: 'Minimalism', desc: '極簡主義，少即是多', file: '01-minimalism.html',
    design: {
      headingFontIndex: 1, headingWeight: '600', headingLetterSpacing: 'normal', headingUppercase: false,
      accent: '#1a1a1a', ink: '#1a1a1a', muted: '#4b5563',
      sectionBg: '#F5F1E8', cardBg: '#ffffff', cardBorder: '#e5e7eb',
      cardRadius: 'sm', btnRadius: 'sm', shadow: 'none', heroLayout: 'centered', sectionPaddingScale: 'spacious',
    },
  },
  {
    // 原稿點綴色 blue-500 白字對比不足，改 blue-600；次要文字 gray-500 在灰底偏淡，改 gray-600
    id: 'neumorphism', no: 2, name: 'Neumorphism', desc: '新擬態，柔和陰影與凸起效果', file: '02-neumorphism.html',
    design: {
      headingFontIndex: 1, headingWeight: '600', headingLetterSpacing: 'normal', headingUppercase: false,
      accent: '#2563eb', ink: '#374151', muted: '#4b5563',
      sectionBg: '#E8E8E8', cardBg: '#FAFAFA', cardBorder: '#D1D1D1',
      cardRadius: 'lg', btnRadius: 'full', shadow: 'medium', heroLayout: 'centered', sectionPaddingScale: 'comfortable',
    },
  },
  {
    id: 'accessible', no: 8, name: 'Accessible', desc: '無障礙設計，高對比易讀', file: '08-accessible.html',
    design: {
      headingFontIndex: 1, headingWeight: '700', headingLetterSpacing: 'normal', headingUppercase: false,
      accent: '#0066CC', ink: '#111827', muted: '#4b5563',
      sectionBg: '#f3f4f6', cardBg: '#ffffff', cardBorder: '#9ca3af',
      cardRadius: 'sm', btnRadius: 'sm', shadow: 'none', heroLayout: 'overlay-left', sectionPaddingScale: 'comfortable',
    },
  },
  {
    // 原稿主色 #F5A69C 太淺，白字按鈕看不清，調深為 #B5503F
    id: 'claymorphism', no: 9, name: 'Claymorphism', desc: '黏土擬態，圓潤立體', file: '09-claymorphism.html',
    design: {
      headingFontIndex: 2, headingWeight: '600', headingLetterSpacing: 'normal', headingUppercase: false,
      accent: '#B5503F', ink: '#3f3a4a', muted: '#6b6478',
      sectionBg: '#FEF3F2', cardBg: '#ffffff', cardBorder: '#FDBCB4',
      cardRadius: 'lg', btnRadius: 'full', shadow: 'medium', heroLayout: 'centered', sectionPaddingScale: 'comfortable',
    },
  },
  {
    // 原稿點綴色 #DEB887（burlywood）太淺，調深為 #8B6B3E 當主色
    id: 'skeuomorphism', no: 13, name: 'Skeuomorphism', desc: '擬物化設計，皮革木紋質感', file: '13-skeuomorphism.html',
    design: {
      headingFontIndex: 0, headingWeight: '700', headingLetterSpacing: 'normal', headingUppercase: false,
      accent: '#8B6B3E', ink: '#1f2937', muted: '#4b5563',
      sectionBg: '#E8E8E8', cardBg: '#FFFEF0', cardBorder: '#C0C0C0',
      cardRadius: 'sm', btnRadius: 'md', shadow: 'medium', heroLayout: 'overlay-left', sectionPaddingScale: 'comfortable',
    },
  },
  {
    // 原稿點綴色 #87CEEB 太淺，調深為 #276C8F
    id: 'soft-ui', no: 19, name: 'Soft UI Evolution', desc: '柔和 UI，粉嫩清爽', file: '19-soft-ui-evolution.html',
    design: {
      headingFontIndex: 1, headingWeight: '600', headingLetterSpacing: 'normal', headingUppercase: false,
      accent: '#276C8F', ink: '#334155', muted: '#64748b',
      sectionBg: '#F0F9FF', cardBg: '#ffffff', cardBorder: '#E6E6FA',
      cardRadius: 'lg', btnRadius: 'full', shadow: 'soft', heroLayout: 'centered', sectionPaddingScale: 'comfortable',
    },
  },
  {
    id: 'trust-authority', no: 26, name: 'Trust & Authority', desc: '信任感與權威，沉穩專業', file: '26-trust-authority.html',
    design: {
      headingFontIndex: 0, headingWeight: '700', headingLetterSpacing: 'normal', headingUppercase: false,
      accent: '#111827', ink: '#111827', muted: '#6b7280',
      sectionBg: '#f9fafb', cardBg: '#ffffff', cardBorder: '#e5e7eb',
      cardRadius: 'sm', btnRadius: 'sm', shadow: 'soft', heroLayout: 'centered', sectionPaddingScale: 'spacious',
    },
  },
  {
    id: 'storytelling', no: 27, name: 'Storytelling', desc: '故事敘事，適合有故事的民宿', file: '27-storytelling.html',
    design: {
      headingFontIndex: 0, headingWeight: '700', headingLetterSpacing: 'normal', headingUppercase: false,
      accent: '#2563eb', ink: '#111827', muted: '#4b5563',
      sectionBg: '#f9fafb', cardBg: '#ffffff', cardBorder: '#e5e7eb',
      cardRadius: 'md', btnRadius: 'md', shadow: 'soft', heroLayout: 'overlay-left', sectionPaddingScale: 'spacious',
    },
  },
  {
    id: 'bento-box', no: 39, name: 'Bento Box', desc: '便當盒網格，整齊俐落', file: '39-bento-box.html',
    design: {
      headingFontIndex: 1, headingWeight: '700', headingLetterSpacing: 'normal', headingUppercase: false,
      accent: '#171717', ink: '#171717', muted: '#525252',
      sectionBg: '#f5f5f5', cardBg: '#ffffff', cardBorder: '#e5e5e5',
      cardRadius: 'lg', btnRadius: 'full', shadow: 'none', heroLayout: 'centered', sectionPaddingScale: 'comfortable',
    },
  },
  {
    // 原稿卡片底 #E8E0D0 與區塊底太接近，卡片改近白 #FFFDF8；次要文字 #8A9A7B 在淺底偏淡，調深為 #5F6C51
    id: 'organic-biophilic', no: 42, name: 'Organic / Biophilic', desc: '有機自然，大地色系', file: '42-organic-biophilic.html',
    design: {
      headingFontIndex: 0, headingWeight: '500', headingLetterSpacing: 'wide', headingUppercase: false,
      accent: '#5D6B4D', ink: '#3E4A32', muted: '#5F6C51',
      sectionBg: '#F5F1E8', cardBg: '#FFFDF8', cardBorder: '#E0D8C8',
      cardRadius: 'lg', btnRadius: 'full', shadow: 'soft', heroLayout: 'centered', sectionPaddingScale: 'spacious',
    },
  },
  {
    // 原稿主色 #FF6B6B 白字對比不足，調深為 #C73E3E
    id: 'memphis', no: 44, name: 'Memphis Revival', desc: '80s 曼菲斯，活潑繽紛', file: '44-memphis-revival.html',
    design: {
      headingFontIndex: 1, headingWeight: '900', headingLetterSpacing: 'normal', headingUppercase: false,
      accent: '#C73E3E', ink: '#2d2d2d', muted: '#5f5f5f',
      sectionBg: '#FFF5E6', cardBg: '#ffffff', cardBorder: '#FFE66D',
      cardRadius: 'md', btnRadius: 'full', shadow: 'medium', heroLayout: 'centered', sectionPaddingScale: 'comfortable',
    },
  },
  {
    id: 'dimensional-layering', no: 46, name: 'Dimensional Layering', desc: '多層次景深，立體分層', file: '46-dimensional-layering.html',
    design: {
      headingFontIndex: 1, headingWeight: '700', headingLetterSpacing: 'normal', headingUppercase: false,
      accent: '#0f172a', ink: '#0f172a', muted: '#475569',
      sectionBg: '#f1f5f9', cardBg: '#ffffff', cardBorder: '#e2e8f0',
      cardRadius: 'lg', btnRadius: 'lg', shadow: 'medium', heroLayout: 'overlay-left', sectionPaddingScale: 'comfortable',
    },
  },
  {
    // 原稿次要文字 gray-400 在白底對比不足，改用 gray-500
    id: 'exaggerated-minimalism', no: 47, name: 'Exaggerated Minimalism', desc: '極端極簡，大字留白', file: '47-exaggerated-minimalism.html',
    design: {
      headingFontIndex: 1, headingWeight: '900', headingLetterSpacing: 'wider', headingUppercase: true,
      accent: '#141414', ink: '#141414', muted: '#6b7280',
      sectionBg: '#fafafa', cardBg: '#ffffff', cardBorder: '#e5e7eb',
      cardRadius: 'none', btnRadius: 'none', shadow: 'none', heroLayout: 'minimal', sectionPaddingScale: 'spacious',
    },
  },
  {
    // 原稿框線是黑色粗框；此設計系統的 cardBorder 只做淺色分隔，改用 neutral-300
    id: 'swiss-modernism', no: 50, name: 'Swiss Modernism 2.0', desc: '瑞士現代主義，紅黑網格', file: '50-swiss-modernism.html',
    design: {
      headingFontIndex: 1, headingWeight: '800', headingLetterSpacing: 'normal', headingUppercase: false,
      accent: '#dc2626', ink: '#111111', muted: '#4b5563',
      sectionBg: '#f5f5f5', cardBg: '#ffffff', cardBorder: '#d4d4d4',
      cardRadius: 'none', btnRadius: 'none', shadow: 'none', heroLayout: 'overlay-left', sectionPaddingScale: 'compact',
    },
  },
  {
    id: 'e-ink-paper', no: 56, name: 'E-Ink / Paper', desc: '電子紙質感，文青書卷氣', file: '56-e-ink-paper.html',
    design: {
      headingFontIndex: 0, headingWeight: '500', headingLetterSpacing: 'normal', headingUppercase: false,
      accent: '#1A1A1A', ink: '#1A1A1A', muted: '#5c5a55',
      sectionBg: '#F5F1EB', cardBg: '#FBF9F5', cardBorder: '#E2DCD2',
      cardRadius: 'none', btnRadius: 'none', shadow: 'none', heroLayout: 'minimal', sectionPaddingScale: 'spacious',
    },
  },
]

export function getUiStyle(id: string) {
  return UI_STYLE_PRESETS.find(s => s.id === id)
}

// 給 AI 系統提示用的風格庫清單
export function uiStylesPromptList() {
  return UI_STYLE_PRESETS
    .map(s => `  * "${s.id}"（#${s.no} ${s.name}：${s.desc}）custom_design = ${JSON.stringify(s.design)}`)
    .join('\n')
}
