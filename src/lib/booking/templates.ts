// 官網設計系統：四種預設模板 + AI 自由生成的自訂設計，最終都收斂成同一份
// BnbDesign token，頁面元件只認 token、不用管來源。所有變動值一律用 inline style
// 套用（顏色、圓角、陰影、留白），不用 Tailwind arbitrary-value class ——
// 因為 custom_design 是 runtime 從資料庫來的動態字串，Tailwind build-time 掃描
// 不到，若寫成 class 會直接沒有效果。
//
// 中文標題字體只從 CUSTOM_HEADING_FONTS 白名單挑，因為一般裝飾字體多半只涵蓋
// 拉丁字母，中文字還是會退回系統預設字型，等於沒換到字。

export interface BnbDesign {
  headingFontHref: string
  headingFontFamily: string
  headingWeight: string
  headingLetterSpacing: string
  headingUppercase: boolean
  accent: string
  ink: string
  muted: string
  sectionBg: string
  cardBg: string
  cardBorder: string
  cardRadius: string
  btnRadius: string
  shadow: string
  heroLayout: 'overlay-left' | 'centered' | 'minimal'
  sectionPaddingY: string
}

export interface BnbTemplate extends BnbDesign {
  id: string
  name: string
  desc: string
  previewBg: string
}

export const TEMPLATES: BnbTemplate[] = [
  {
    id: 'natural', name: '自然山居', desc: '清新自然，適合山林民宿',
    previewBg: 'from-green-900 via-green-700 to-green-500',
    headingFontHref: 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@500;600;700&display=swap',
    headingFontFamily: "'Noto Serif TC', serif", headingWeight: '600',
    headingLetterSpacing: '0', headingUppercase: false,
    accent: '#2d6a4f', ink: '#2b2621', muted: '#6b6459',
    sectionBg: '#faf6ee', cardBg: '#ffffff', cardBorder: '#eee7d9',
    cardRadius: '16px', btnRadius: '9999px',
    shadow: '0 1px 2px rgba(43,38,33,0.06), 0 8px 20px -6px rgba(43,38,33,0.12)',
    heroLayout: 'overlay-left', sectionPaddingY: 'clamp(3.5rem, 7vw, 5rem)',
  },
  {
    id: 'coastal', name: '海濱度假', desc: '海天一色，適合海邊民宿',
    previewBg: 'from-sky-800 via-sky-600 to-sky-400',
    headingFontHref: 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@600;700;800&display=swap',
    headingFontFamily: "'Noto Sans TC', sans-serif", headingWeight: '700',
    headingLetterSpacing: '0.025em', headingUppercase: false,
    accent: '#0369a1', ink: '#1e293b', muted: '#64748b',
    sectionBg: '#f0f9ff', cardBg: '#ffffff', cardBorder: '#e0f2fe',
    cardRadius: '12px', btnRadius: '12px',
    shadow: '0 1px 2px rgba(3,105,161,0.06), 0 6px 16px -4px rgba(3,105,161,0.12)',
    heroLayout: 'centered', sectionPaddingY: 'clamp(3rem, 5vw, 4rem)',
  },
  {
    id: 'boutique', name: '精品時尚', desc: '簡約高端，適合精品旅館',
    previewBg: 'from-gray-900 via-gray-800 to-gray-700',
    headingFontHref: 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@700;900&display=swap',
    headingFontFamily: "'Noto Serif TC', serif", headingWeight: '800',
    headingLetterSpacing: '0.15em', headingUppercase: true,
    accent: '#1c1c1c', ink: '#141414', muted: '#8a8a8a',
    sectionBg: '#ffffff', cardBg: '#ffffff', cardBorder: '#e5e5e5',
    cardRadius: '0px', btnRadius: '0px',
    shadow: '',
    heroLayout: 'centered', sectionPaddingY: 'clamp(5rem, 9vw, 7rem)',
  },
  {
    id: 'zen', name: '日式禪意', desc: '質樸寧靜，適合風格民宿',
    previewBg: 'from-stone-700 via-stone-600 to-stone-400',
    headingFontHref: 'https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@400;500&display=swap',
    headingFontFamily: "'LXGW WenKai TC', serif", headingWeight: '500',
    headingLetterSpacing: '0.025em', headingUppercase: false,
    accent: '#78716c', ink: '#3d3833', muted: '#8c8479',
    sectionBg: '#f5f2ee', cardBg: '#faf9f7', cardBorder: '#e7e2da',
    cardRadius: '12px', btnRadius: '8px',
    shadow: '',
    heroLayout: 'minimal', sectionPaddingY: 'clamp(3.5rem, 7vw, 5rem)',
  },
]

export function getTemplate(id?: string | null): BnbTemplate {
  return TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0]
}

// ── AI 自由生成的自訂設計：只接受受限的語意選項 + hex 色碼，
// 不接受任意 CSS 字串，避免 AI 產生壞掉的樣式或格式不明的值。
export const CUSTOM_HEADING_FONTS = [
  { family: "'Noto Serif TC', serif", href: 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;500;600;700;800;900&display=swap', label: 'Noto Serif TC（襯線・穩重典雅）' },
  { family: "'Noto Sans TC', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700;800;900&display=swap', label: 'Noto Sans TC（黑體・現代簡潔）' },
  { family: "'LXGW WenKai TC', serif", href: 'https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@400;500;600&display=swap', label: 'LXGW WenKai TC（手寫楷體・溫暖質感）' },
] as const

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const HEADING_WEIGHTS = new Set(['400', '500', '600', '700', '800', '900'])
const HERO_LAYOUTS = new Set(['overlay-left', 'centered', 'minimal'])

const RADIUS_SCALE: Record<string, string> = { none: '0px', sm: '8px', md: '16px', lg: '24px', full: '9999px' }
const BTN_RADIUS_SCALE: Record<string, string> = { none: '0px', sm: '8px', md: '12px', lg: '16px', full: '9999px' }
const PADDING_SCALE: Record<string, string> = {
  compact: 'clamp(2.5rem, 5vw, 3.5rem)',
  comfortable: 'clamp(3.5rem, 7vw, 5rem)',
  spacious: 'clamp(4.5rem, 9vw, 7rem)',
}
const LETTER_SPACING_SCALE: Record<string, string> = { normal: '0', wide: '0.025em', wider: '0.15em' }

export interface CustomDesignInput {
  headingFontIndex?: number
  headingWeight?: string
  headingLetterSpacing?: 'normal' | 'wide' | 'wider'
  headingUppercase?: boolean
  accent?: string
  ink?: string
  muted?: string
  sectionBg?: string
  cardBg?: string
  cardBorder?: string
  cardRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full'
  btnRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full'
  shadow?: 'none' | 'soft' | 'medium'
  heroLayout?: 'overlay-left' | 'centered' | 'minimal'
  sectionPaddingScale?: 'compact' | 'comfortable' | 'spacious'
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function shadowFromInk(ink: string, level: 'none' | 'soft' | 'medium'): string {
  if (level === 'none') return ''
  const { r, g, b } = hexToRgb(ink)
  return level === 'soft'
    ? `0 1px 2px rgba(${r},${g},${b},0.06), 0 8px 20px -6px rgba(${r},${g},${b},0.12)`
    : `0 2px 4px rgba(${r},${g},${b},0.08), 0 16px 32px -8px rgba(${r},${g},${b},0.18)`
}

// 驗證並轉換 AI 產出的自訂設計；任何一個必要色碼格式不對就整體視為無效，
// 讓呼叫端 fallback 回預設模板，而不是套用半殘的設計。
export function sanitizeCustomDesign(input: unknown): BnbDesign | null {
  if (!input || typeof input !== 'object') return null
  const d = input as CustomDesignInput

  const font = CUSTOM_HEADING_FONTS[d.headingFontIndex ?? -1]
  if (!font) return null

  const ink        = d.ink && HEX_RE.test(d.ink) ? d.ink : null
  const accent      = d.accent && HEX_RE.test(d.accent) ? d.accent : null
  const muted       = d.muted && HEX_RE.test(d.muted) ? d.muted : null
  const sectionBg    = d.sectionBg && HEX_RE.test(d.sectionBg) ? d.sectionBg : null
  const cardBg       = d.cardBg && HEX_RE.test(d.cardBg) ? d.cardBg : null
  const cardBorder   = d.cardBorder && HEX_RE.test(d.cardBorder) ? d.cardBorder : null
  if (!ink || !accent || !muted || !sectionBg || !cardBg || !cardBorder) return null

  const heroLayout = d.heroLayout && HERO_LAYOUTS.has(d.heroLayout) ? d.heroLayout : 'centered'
  const headingWeight = d.headingWeight && HEADING_WEIGHTS.has(d.headingWeight) ? d.headingWeight : '700'

  return {
    headingFontHref: font.href,
    headingFontFamily: font.family,
    headingWeight,
    headingLetterSpacing: LETTER_SPACING_SCALE[d.headingLetterSpacing ?? 'normal'] ?? LETTER_SPACING_SCALE.normal,
    headingUppercase: !!d.headingUppercase,
    accent, ink, muted, sectionBg, cardBg, cardBorder,
    cardRadius: RADIUS_SCALE[d.cardRadius ?? 'md'] ?? RADIUS_SCALE.md,
    btnRadius: BTN_RADIUS_SCALE[d.btnRadius ?? 'md'] ?? BTN_RADIUS_SCALE.md,
    shadow: shadowFromInk(ink, d.shadow ?? 'soft'),
    heroLayout,
    sectionPaddingY: PADDING_SCALE[d.sectionPaddingScale ?? 'comfortable'] ?? PADDING_SCALE.comfortable,
  }
}

// 解析某民宿目前該用的設計 token：template_id === 'custom' 且 custom_design
// 驗證通過時用 AI 自訂設計，否則 fallback 回四種預設模板之一。
// theme_color（設定頁的顏色選擇器）永遠可覆蓋 accent，不論來源是哪一種。
export function resolveDesign(profile: {
  template_id?: string | null
  custom_design?: unknown
  theme_color?: string | null
}): BnbDesign {
  const base = profile.template_id === 'custom'
    ? sanitizeCustomDesign(profile.custom_design) ?? getTemplate('natural')
    : getTemplate(profile.template_id)
  return profile.theme_color ? { ...base, accent: profile.theme_color } : base
}

// 標題文字的共用 style：色彩、字體、字距、大小寫，各頁面統一使用避免各寫一套
export function headingCss(d: BnbDesign, colorOverride?: string) {
  return {
    color: colorOverride ?? d.ink,
    fontFamily: d.headingFontFamily,
    fontWeight: d.headingWeight,
    letterSpacing: d.headingLetterSpacing,
    textTransform: (d.headingUppercase ? 'uppercase' : 'none') as 'uppercase' | 'none',
  }
}
