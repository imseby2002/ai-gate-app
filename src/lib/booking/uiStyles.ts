// 官網風格庫：完整收錄 joshhu/uitest（MIT License）的 57 種 UI 風格。
// https://github.com/joshhu/uitest
//
// 原稿是整頁靜態 HTML + Tailwind CDN，無法直接塞進官網；這裡把每頁實際用到的配色（原稿 hex 或
// Tailwind 色）、字體調性、圓角、陰影、留白、動態轉成 CustomDesignInput（同 AI 自由生成設計的格式），
// 走 sanitizeCustomDesign() 驗證後套用。
// - 深色風格用 pageBg 深色底，官網外層會把寫死的淺色 class 一併換成深色（templates.ts siteThemeVars）
// - 漸層底（Glassmorphism、Aurora、Y2K…）取漸層中段的單一色當底色，毛玻璃、發光等特效不會帶過來
// - BI 儀表板類（#28–37）不是網站版型，只取配色（category 'bi'）
// - 動態：依原稿的動畫特徵設定進場動畫（fade/rise/zoom/slide/blur/spring）、大圖視差、標題逐字浮現，由 Motion 執行
// - 原稿色太淺／太暗導致文字對比不足時才調整，並逐筆註明；全部通過 WCAG AA（見 scripts 驗證說明於 PR）
// 中文標題字體只能從 CUSTOM_HEADING_FONTS 三選一（0 襯線、1 黑體、2 楷體），以原稿英文字體的調性對應。

import type { CustomDesignInput } from './templates'

export const UI_STYLES_REPO = 'https://github.com/joshhu/uitest'

export type UiStyleCategory = 'general' | 'landing' | 'bi' | 'modern'

type PresetDesign = Required<CustomDesignInput>

export interface UiStylePreset {
  id: string
  no: number
  name: string
  desc: string
  file: string
  category: UiStyleCategory
  dark: boolean
  design: PresetDesign
}

type Radius = PresetDesign['cardRadius']
type Tuple = [
  font: 0 | 1 | 2, weight: string, spacing: PresetDesign['headingLetterSpacing'], upper: boolean,
  accent: string, ink: string, muted: string,
  page: string, section: string, card: string, border: string,
  cardR: Radius, btnR: Radius, shadow: PresetDesign['shadow'],
  hero: PresetDesign['heroLayout'], pad: PresetDesign['sectionPaddingScale'], anim: PresetDesign['animation'],
]

interface Fx { parallax?: boolean; textReveal?: boolean }

function d(t: Tuple, fx: Fx = {}): PresetDesign {
  const [headingFontIndex, headingWeight, headingLetterSpacing, headingUppercase, accent, ink, muted,
    pageBg, sectionBg, cardBg, cardBorder, cardRadius, btnRadius, shadow, heroLayout, sectionPaddingScale, animation] = t
  return {
    headingFontIndex, headingWeight, headingLetterSpacing, headingUppercase, accent, ink, muted,
    pageBg, sectionBg, cardBg, cardBorder, cardRadius, btnRadius, shadow, heroLayout, sectionPaddingScale, animation,
    parallax: fx.parallax ?? false, textReveal: fx.textReveal ?? false,
  }
}

function p(no: number, id: string, name: string, desc: string, category: UiStyleCategory, dark: boolean, t: Tuple, fx?: Fx): UiStylePreset {
  return { id, no, name, desc, file: `${String(no).padStart(2, '0')}-${id}.html`, category, dark, design: d(t, fx) }
}

export const UI_STYLE_PRESETS: UiStylePreset[] = [
  // ── General（1–19）──────────────────────────────────────────────
  p(1, 'minimalism', 'Minimalism', '極簡主義，少即是多', 'general', false,
    [1, '600', 'normal', false, '#1a1a1a', '#1a1a1a', '#4b5563', '#ffffff', '#F5F1E8', '#ffffff', '#e5e7eb', 'sm', 'sm', 'none', 'centered', 'spacious', 'fade']),
  // 原稿點綴色 blue-500 白字對比不足改 blue-600；次要文字 gray-500 在灰底偏淡改 gray-600
  p(2, 'neumorphism', 'Neumorphism', '新擬態，柔和陰影與凸起效果', 'general', false,
    [1, '600', 'normal', false, '#2563eb', '#374151', '#4b5563', '#E8E8E8', '#E0E0E0', '#FAFAFA', '#D1D1D1', 'lg', 'full', 'medium', 'centered', 'comfortable', 'zoom']),
  // 原稿是 #667EEA→#764BA2 漸層＋白色毛玻璃卡；底色取漸層中段並調深，卡片用半透明感的深紫；
  // 原稿點綴 #FF1493 在紫底上對比不足，提亮為 #FFB3DE
  p(3, 'glassmorphism', 'Glassmorphism', '玻璃擬態，毛玻璃透明效果', 'general', true,
    [1, '700', 'normal', false, '#FFB3DE', '#ffffff', '#E4DDF7', '#4B3F8F', '#554A99', '#5E54A3', '#8279C2', 'lg', 'lg', 'medium', 'centered', 'comfortable', 'blur']),
  // 原稿黃底黑粗框；主色取原稿純藍 #0000FF
  p(4, 'brutalism', 'Brutalism', '粗獷主義，黑框原色', 'general', false,
    [1, '900', 'normal', true, '#0000FF', '#000000', '#1f1f1f', '#FACC15', '#FDE047', '#ffffff', '#000000', 'none', 'none', 'none', 'overlay-left', 'compact', 'slide']),
  p(5, '3d-hyperrealism', '3D Hyperrealism', '超寫實 3D，金屬質感', 'general', true,
    [0, '700', 'normal', false, '#FFD700', '#ffffff', '#94a3b8', '#0f172a', '#172033', '#1e293b', '#334155', 'lg', 'lg', 'medium', 'centered', 'spacious', 'spring'], { parallax: true }),
  p(6, 'vibrant-block', 'Vibrant Block', '鮮豔色塊，高飽和', 'general', true,
    [1, '800', 'normal', false, '#00FFFF', '#ffffff', '#d4d4d4', '#000000', '#111111', '#171717', '#BF00FF', 'lg', 'lg', 'none', 'centered', 'comfortable', 'spring']),
  p(7, 'dark-mode-oled', 'Dark Mode (OLED)', '深色模式，OLED 純黑', 'general', true,
    [1, '700', 'normal', false, '#39FF14', '#ffffff', '#a3a3a3', '#000000', '#0a0a0a', '#121212', '#2a2a2a', 'md', 'md', 'none', 'overlay-left', 'comfortable', 'fade']),
  p(8, 'accessible', 'Accessible', '無障礙設計，高對比易讀', 'general', false,
    [1, '700', 'normal', false, '#0066CC', '#111827', '#4b5563', '#ffffff', '#f3f4f6', '#ffffff', '#9ca3af', 'sm', 'sm', 'none', 'overlay-left', 'comfortable', 'none']),
  // 原稿主色 #F5A69C 太淺，白字按鈕看不清，調深為 #B5503F
  p(9, 'claymorphism', 'Claymorphism', '黏土擬態，圓潤立體', 'general', false,
    [2, '600', 'normal', false, '#B5503F', '#3f3a4a', '#6b6478', '#ffffff', '#FEF3F2', '#ffffff', '#FDBCB4', 'lg', 'full', 'medium', 'centered', 'comfortable', 'spring']),
  // 原稿是 aurora 漸層動畫底；底色取深紫，主色取原稿 #F093FB
  p(10, 'aurora-ui', 'Aurora UI', '極光效果，夢幻漸層', 'general', true,
    [1, '700', 'normal', false, '#F093FB', '#ffffff', '#d8d0f0', '#1E1B4B', '#27235C', '#312C6B', '#4C4596', 'lg', 'full', 'soft', 'centered', 'spacious', 'blur'], { parallax: true }),
  p(11, 'retro-futurism', 'Retro Futurism', '復古未來，霓虹格線', 'general', true,
    [1, '800', 'wider', true, '#00FFFF', '#ffffff', '#9ca3af', '#1A1A2E', '#20203A', '#26264A', '#5D34D0', 'sm', 'sm', 'none', 'centered', 'comfortable', 'rise'], { textReveal: true }),
  // 原稿 Flat UI 藍 #3498DB 白字對比不足，調深為 #1F74B0
  p(12, 'flat-design', 'Flat Design 2.0', '扁平設計進化版', 'general', false,
    [1, '700', 'normal', false, '#1F74B0', '#2c3e50', '#4b5563', '#ffffff', '#f5f7fa', '#ffffff', '#e5e7eb', 'none', 'sm', 'none', 'overlay-left', 'comfortable', 'rise']),
  // 原稿點綴色 #DEB887（burlywood）太淺，調深為 #8B6B3E 當主色
  p(13, 'skeuomorphism', 'Skeuomorphism', '擬物化設計，皮革木紋質感', 'general', false,
    [0, '700', 'normal', false, '#8B6B3E', '#1f2937', '#4b5563', '#ffffff', '#E8E8E8', '#FFFEF0', '#C0C0C0', 'sm', 'md', 'medium', 'overlay-left', 'comfortable', 'fade']),
  // 原稿是 #667EEA→#764BA2 漸層上的液態玻璃；底色取漸層深端
  p(14, 'liquid-glass', 'Liquid Glass', '液態玻璃，流動光澤', 'general', true,
    [1, '600', 'normal', false, '#22D3EE', '#ffffff', '#E0DDF5', '#3F3685', '#4A4192', '#554C9E', '#7D74C0', 'lg', 'full', 'soft', 'centered', 'spacious', 'blur'], { parallax: true }),
  // 原稿動畫主題（fadeIn / scaleIn / float），進場動畫用 rise
  p(15, 'motion-driven', 'Motion-Driven', '動態驅動，豐富進場動畫', 'general', true,
    [1, '700', 'normal', false, '#3b82f6', '#ffffff', '#94a3b8', '#0f172a', '#131c31', '#1e293b', '#334155', 'lg', 'full', 'soft', 'centered', 'comfortable', 'spring'], { parallax: true, textReveal: true }),
  // 原稿 blue-500 白字對比不足改 blue-600
  p(16, 'micro-interactions', 'Micro-interactions', '微互動，細節回饋', 'general', false,
    [1, '600', 'normal', false, '#2563eb', '#0f172a', '#475569', '#ffffff', '#f1f5f9', '#ffffff', '#e2e8f0', 'md', 'full', 'soft', 'centered', 'comfortable', 'spring']),
  p(17, 'inclusive-design', 'Inclusive Design', '包容性設計，人人可用', 'general', false,
    [1, '700', 'normal', false, '#003366', '#111827', '#4b5563', '#ffffff', '#f3f4f6', '#ffffff', '#9ca3af', 'sm', 'sm', 'none', 'overlay-left', 'comfortable', 'none']),
  // 原稿 gray-400 次要文字對比不足改 gray-600；主色取原稿漸層 purple-500 調深為 purple-600
  p(18, 'zero-interface', 'Zero Interface', '零介面，輕量對話式', 'general', false,
    [1, '500', 'normal', false, '#9333ea', '#1f2937', '#4b5563', '#FAFAFA', '#F5F1E8', '#ffffff', '#E5E5E5', 'lg', 'full', 'none', 'minimal', 'spacious', 'blur'], { textReveal: true }),
  // 原稿點綴色 #87CEEB 太淺，調深為 #276C8F；次要文字 slate-500 在淺藍底偏淡改 slate-600
  p(19, 'soft-ui-evolution', 'Soft UI Evolution', '柔和 UI，粉嫩清爽', 'general', false,
    [1, '600', 'normal', false, '#276C8F', '#334155', '#475569', '#ffffff', '#F0F9FF', '#ffffff', '#E6E6FA', 'lg', 'full', 'soft', 'centered', 'comfortable', 'rise']),

  // ── Landing Page（20–27）────────────────────────────────────────
  p(20, 'hero-centric', 'Hero-Centric', '大圖主視覺為中心', 'landing', false,
    [1, '800', 'normal', false, '#4f46e5', '#111827', '#4b5563', '#ffffff', '#f9fafb', '#ffffff', '#e5e7eb', 'lg', 'full', 'soft', 'overlay-left', 'spacious', 'rise'], { parallax: true, textReveal: true }),
  // 原稿 green-600 白字對比不足，調深為 green-700
  p(21, 'conversion-optimized', 'Conversion-Optimized', '轉換率優化，行動按鈕突出', 'landing', false,
    [1, '700', 'normal', false, '#15803d', '#111827', '#4b5563', '#ffffff', '#f9fafb', '#ffffff', '#f3f4f6', 'md', 'full', 'soft', 'overlay-left', 'comfortable', 'rise']),
  p(22, 'feature-rich', 'Feature-Rich', '功能豐富，資訊完整', 'landing', false,
    [1, '700', 'normal', false, '#2563eb', '#0f172a', '#475569', '#ffffff', '#f8fafc', '#ffffff', '#e2e8f0', 'md', 'md', 'soft', 'centered', 'comfortable', 'rise']),
  // 原稿次要文字 gray-400 對比不足改 gray-500
  p(23, 'minimal-direct', 'Minimal & Direct', '極簡直述，重點直給', 'landing', false,
    [1, '700', 'normal', false, '#111827', '#111827', '#6b7280', '#ffffff', '#fafafa', '#ffffff', '#f3f4f6', 'none', 'none', 'none', 'minimal', 'spacious', 'fade']),
  // 主色取原稿星等 yellow-400，白字對比不足調深為 amber-700
  p(24, 'social-proof', 'Social Proof', '社群口碑，評價見證', 'landing', false,
    [1, '700', 'normal', false, '#b45309', '#111827', '#4b5563', '#ffffff', '#f9fafb', '#ffffff', '#e5e7eb', 'lg', 'full', 'soft', 'centered', 'comfortable', 'rise']),
  p(25, 'interactive-demo', 'Interactive Demo', '互動式展示', 'landing', false,
    [1, '700', 'normal', false, '#2563eb', '#0f172a', '#475569', '#ffffff', '#f8fafc', '#ffffff', '#e2e8f0', 'md', 'full', 'soft', 'centered', 'comfortable', 'spring']),
  p(26, 'trust-authority', 'Trust & Authority', '信任感與權威，沉穩專業', 'landing', false,
    [0, '700', 'normal', false, '#111827', '#111827', '#6b7280', '#ffffff', '#f9fafb', '#ffffff', '#e5e7eb', 'sm', 'sm', 'soft', 'centered', 'spacious', 'fade']),
  p(27, 'storytelling', 'Storytelling', '故事敘事，適合有故事的品牌', 'landing', false,
    [0, '700', 'normal', false, '#2563eb', '#111827', '#4b5563', '#ffffff', '#f9fafb', '#ffffff', '#e5e7eb', 'md', 'md', 'soft', 'overlay-left', 'spacious', 'rise'], { parallax: true, textReveal: true }),

  // ── BI / Analytics（28–37，儀表板版型搬不過來，只取配色）────────────
  // 原稿 blue-600 在深色卡片上對比不足，提亮為 blue-400
  p(28, 'data-dense-dashboard', 'Data-Dense Dashboard', '高密度數據儀表板（僅配色）', 'bi', true,
    [1, '700', 'normal', false, '#60a5fa', '#ffffff', '#94a3b8', '#0f172a', '#131c31', '#1e293b', '#334155', 'sm', 'sm', 'none', 'overlay-left', 'compact', 'none']),
  p(29, 'heatmap-density', 'Heatmap & Density', '熱力圖與密度（僅配色）', 'bi', true,
    [1, '700', 'normal', false, '#38BDF8', '#ffffff', '#94a3b8', '#020617', '#0b1225', '#0f172a', '#1e293b', 'sm', 'sm', 'none', 'overlay-left', 'compact', 'fade']),
  // 原稿 green-600 白字對比不足，調深為 green-700
  p(30, 'executive-summary', 'Executive Summary', '高管摘要報表（僅配色）', 'bi', false,
    [1, '700', 'normal', false, '#15803d', '#111827', '#4b5563', '#f9fafb', '#f3f4f6', '#ffffff', '#e5e7eb', 'lg', 'full', 'soft', 'centered', 'comfortable', 'fade']),
  p(31, 'real-time-monitoring', 'Real-time Monitoring', '即時監控儀表板（僅配色）', 'bi', true,
    [1, '700', 'normal', false, '#22c55e', '#ffffff', '#9ca3af', '#030712', '#0b0f19', '#111827', '#1f2937', 'sm', 'full', 'none', 'overlay-left', 'compact', 'fade']),
  p(32, 'drill-down-analytics', 'Drill-Down Analytics', '層級式數據探索（僅配色）', 'bi', false,
    [1, '700', 'normal', false, '#2563eb', '#0f172a', '#475569', '#f1f5f9', '#e2e8f0', '#ffffff', '#cbd5e1', 'md', 'full', 'soft', 'overlay-left', 'comfortable', 'rise']),
  p(33, 'comparative-analytics', 'Comparative Analytics', '比較分析 YoY（僅配色）', 'bi', false,
    [1, '700', 'normal', false, '#2563eb', '#111827', '#4b5563', '#f9fafb', '#f3f4f6', '#ffffff', '#e5e7eb', 'sm', 'full', 'none', 'overlay-left', 'comfortable', 'rise']),
  p(34, 'predictive-analytics', 'Predictive Analytics', 'AI 預測分析（僅配色）', 'bi', true,
    [1, '700', 'normal', false, '#A855F7', '#ffffff', '#94a3b8', '#0f172a', '#131c31', '#1e293b', '#334155', 'lg', 'full', 'soft', 'centered', 'comfortable', 'fade']),
  p(35, 'user-behavior-analytics', 'User Behavior Analytics', '用戶行為分析（僅配色）', 'bi', false,
    [1, '700', 'normal', false, '#15803d', '#111827', '#4b5563', '#f3f4f6', '#e5e7eb', '#ffffff', '#e5e7eb', 'lg', 'full', 'soft', 'overlay-left', 'comfortable', 'rise']),
  p(36, 'financial-analytics', 'Financial Analytics', '金融投資分析（僅配色）', 'bi', true,
    [1, '700', 'normal', false, '#10B981', '#ffffff', '#94a3b8', '#020617', '#0b1225', '#0f172a', '#334155', 'md', 'md', 'none', 'overlay-left', 'compact', 'fade']),
  p(37, 'sales-intelligence', 'Sales Intelligence', '銷售智慧儀表板（僅配色）', 'bi', false,
    [1, '700', 'normal', false, '#15803d', '#111827', '#4b5563', '#f9fafb', '#f3f4f6', '#ffffff', '#e5e7eb', 'lg', 'full', 'soft', 'overlay-left', 'comfortable', 'rise']),

  // ── Modern（38–57）──────────────────────────────────────────────
  // 原稿主色 #FF6B6B 白字對比不足，調深為 #C73E3E；黑色粗框改用黑色邊框色
  p(38, 'neubrutalism', 'Neubrutalism', '新野獸派，粗框高對比', 'modern', false,
    [1, '800', 'normal', false, '#C73E3E', '#000000', '#27272a', '#FFF8E7', '#FFE66D', '#ffffff', '#000000', 'none', 'none', 'none', 'overlay-left', 'comfortable', 'slide']),
  p(39, 'bento-box', 'Bento Box', '便當盒網格，整齊俐落', 'modern', false,
    [1, '700', 'normal', false, '#171717', '#171717', '#525252', '#f5f5f5', '#ebebeb', '#ffffff', '#e5e5e5', 'lg', 'full', 'none', 'centered', 'comfortable', 'zoom']),
  // 原稿是紫→粉→青漸層；底色取深紫端；點綴 #FF00FF 在紫底上對比不足，提亮為 #FF8CFF
  p(40, 'y2k-revival', 'Y2K Revival', '千禧年復古，亮面漸層', 'modern', true,
    [1, '800', 'wide', true, '#FF8CFF', '#ffffff', '#f0d6f5', '#581C87', '#6B2196', '#7A2BA6', '#A855F7', 'lg', 'full', 'medium', 'centered', 'comfortable', 'zoom'], { textReveal: true }),
  p(41, 'cyberpunk', 'Cyberpunk', '賽博龐克，霓虹未來', 'modern', true,
    [1, '800', 'wider', true, '#00FFFF', '#ffffff', '#9ca3af', '#000000', '#0a0a0a', '#111827', '#FF00FF', 'none', 'none', 'none', 'overlay-left', 'comfortable', 'slide'], { textReveal: true }),
  // 原稿卡片底 #E8E0D0 與區塊底太接近，卡片改近白 #FFFDF8；次要文字 #8A9A7B 偏淡，調深為 #5F6C51
  p(42, 'organic-biophilic', 'Organic / Biophilic', '有機自然，大地色系', 'modern', false,
    [0, '500', 'wide', false, '#5D6B4D', '#3E4A32', '#5F6C51', '#F5F1E8', '#EDE6D6', '#FFFDF8', '#E0D8C8', 'lg', 'full', 'soft', 'centered', 'spacious', 'fade']),
  // 原稿漸層 #667EEA→#764BA2 取 #5B4BC4 當主色（白字可讀）
  p(43, 'ai-native', 'AI-Native', 'AI 原生介面', 'modern', false,
    [1, '600', 'normal', false, '#5B4BC4', '#0f172a', '#475569', '#f8fafc', '#f1f5f9', '#ffffff', '#e2e8f0', 'lg', 'full', 'soft', 'centered', 'comfortable', 'blur'], { textReveal: true }),
  // 原稿主色 #FF6B6B 白字對比不足，調深為 #C73E3E
  p(44, 'memphis-revival', 'Memphis Revival', '80s 曼菲斯，活潑繽紛', 'modern', false,
    [1, '900', 'normal', false, '#C73E3E', '#2d2d2d', '#5f5f5f', '#FFF5E6', '#FFEBCC', '#ffffff', '#FFE66D', 'md', 'full', 'medium', 'centered', 'comfortable', 'spring']),
  // 原稿紫→粉→青漸層；底色取深紫端，主色取原稿 #FF71CE
  p(45, 'vaporwave', 'Vaporwave', '蒸氣波美學', 'modern', true,
    [1, '700', 'wider', true, '#FF71CE', '#ffffff', '#e9d5ff', '#3B0764', '#4A0D7A', '#000000', '#22D3EE', 'none', 'none', 'none', 'centered', 'comfortable', 'slide'], { textReveal: true }),
  p(46, 'dimensional-layering', 'Dimensional Layering', '多層次景深，立體分層', 'modern', false,
    [1, '700', 'normal', false, '#0f172a', '#0f172a', '#475569', '#f1f5f9', '#e2e8f0', '#ffffff', '#e2e8f0', 'lg', 'lg', 'medium', 'overlay-left', 'comfortable', 'zoom'], { parallax: true }),
  // 原稿次要文字 gray-400 在白底對比不足，改用 gray-500
  p(47, 'exaggerated-minimalism', 'Exaggerated Minimalism', '極端極簡，大字留白', 'modern', false,
    [1, '900', 'wider', true, '#141414', '#141414', '#6b7280', '#ffffff', '#fafafa', '#ffffff', '#e5e7eb', 'none', 'none', 'none', 'minimal', 'spacious', 'fade'], { textReveal: true }),
  // 原稿紅色點綴 red-500 白字對比不足，調深為 red-600
  p(48, 'kinetic-typography', 'Kinetic Typography', '動態字體，大字標題', 'modern', true,
    [1, '900', 'wider', true, '#dc2626', '#ffffff', '#9ca3af', '#000000', '#0a0a0a', '#111111', '#1f2937', 'none', 'none', 'none', 'minimal', 'spacious', 'slide'], { textReveal: true }),
  p(49, 'parallax-storytelling', 'Parallax Storytelling', '視差滾動敘事', 'modern', true,
    [0, '700', 'normal', false, '#FB7185', '#ffffff', '#cbd5e1', '#0f172a', '#131c31', '#1e293b', '#334155', 'lg', 'full', 'soft', 'overlay-left', 'spacious', 'rise'], { parallax: true, textReveal: true }),
  // 原稿框線是黑色粗框；此設計系統的 cardBorder 只做分隔，改用 neutral-300
  p(50, 'swiss-modernism', 'Swiss Modernism 2.0', '瑞士現代主義，紅黑網格', 'modern', false,
    [1, '800', 'normal', false, '#dc2626', '#111111', '#4b5563', '#ffffff', '#f5f5f5', '#ffffff', '#d4d4d4', 'none', 'none', 'none', 'overlay-left', 'compact', 'slide']),
  // 原稿文字 cyan-400、主色 cyan-500
  p(51, 'hud-scifi', 'HUD / Sci-Fi', '科幻 HUD 介面', 'modern', true,
    [1, '700', 'wider', true, '#06b6d4', '#67e8f9', '#22d3ee', '#020617', '#061020', '#0a1628', '#164e63', 'sm', 'sm', 'none', 'overlay-left', 'comfortable', 'fade']),
  // 原稿 Game Boy 四色：#0F380F / #306230 / #8BAC0F / #9BBC0F；原稿卡片 #306230 上的綠字對比不足，
  // 卡片改用比底色更深的 #0B2E0B，#306230 只當邊框
  p(52, 'pixel-art', 'Pixel Art', '像素復古遊戲風', 'modern', true,
    [1, '800', 'wide', true, '#8BAC0F', '#9BBC0F', '#8BAC0F', '#0F380F', '#133F13', '#0B2E0B', '#306230', 'none', 'none', 'none', 'centered', 'comfortable', 'none']),
  // 原稿 violet-500 按鈕字對比略不足，改 violet-600
  p(53, 'bento-grids', 'Bento Grids', '便當格網格系統（深色）', 'modern', true,
    [1, '700', 'normal', false, '#7c3aed', '#ffffff', '#a3a3a3', '#0a0a0a', '#111111', '#171717', '#262626', 'lg', 'full', 'none', 'centered', 'comfortable', 'zoom']),
  // 原稿主色 #FF6B6B 白字對比不足，調深為 #C73E3E
  p(54, 'neubrutalism-v2', 'Neubrutalism v2', '新野獸派進化版', 'modern', false,
    [1, '800', 'normal', false, '#C73E3E', '#000000', '#27272a', '#FFFBF0', '#FFE156', '#ffffff', '#000000', 'none', 'none', 'none', 'overlay-left', 'comfortable', 'slide']),
  // 原稿 slate-900→purple-900 漸層；底色取中段深紫
  p(55, 'spatial-ui', 'Spatial UI', '空間運算介面（Vision Pro）', 'modern', true,
    [1, '600', 'normal', false, '#C084FC', '#ffffff', '#d4d4f5', '#1E1333', '#261A40', '#2F2150', '#4C3A73', 'lg', 'full', 'soft', 'centered', 'spacious', 'blur'], { parallax: true }),
  p(56, 'e-ink-paper', 'E-Ink / Paper', '電子紙質感，文青書卷氣', 'modern', false,
    [0, '500', 'normal', false, '#1A1A1A', '#1A1A1A', '#5c5a55', '#F5F1EB', '#EDE7DC', '#FBF9F5', '#E2DCD2', 'none', 'none', 'none', 'minimal', 'spacious', 'fade']),
  p(57, 'gen-z-chaos', 'Gen Z Chaos', 'Z 世代混亂美學', 'modern', true,
    [1, '900', 'normal', false, '#4ECDC4', '#ffffff', '#c9c9d6', '#1A1A2E', '#22223A', '#2A2A46', '#FF6B6B', 'lg', 'full', 'medium', 'centered', 'comfortable', 'spring'], { textReveal: true }),
]

export function getUiStyle(id: string) {
  return UI_STYLE_PRESETS.find(s => s.id === id)
}

// 給 AI 系統提示用的風格庫清單
export function uiStylesPromptList() {
  return UI_STYLE_PRESETS
    .map(s => `  * "${s.id}"：#${s.no} ${s.name}，${s.desc}${s.dark ? '（深色）' : ''}`)
    .join('\n')
}
