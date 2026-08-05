// 官網模板：不只換一個強調色，四種模板要有各自真正的字體、色調、留白與陰影語言，
// 才不會變成「同一個網站換四種顏色」。中文標題字體選用有完整繁體中文字庫的 Google Fonts
// （一般裝飾字體多半只涵蓋拉丁字母，中文字還是會退回系統預設字型，等於沒換到字）。
export interface BnbTemplate {
  id: string
  name: string
  desc: string
  defaultAccent: string
  previewBg: string
  // 標題字體：Google Fonts CSS2 API 網址（僅該模板需要時才載入，避免每個網站都載入四套中文字型）
  headingFontHref: string
  headingFontFamily: string
  headingWeight: string
  headingClass: string          // 額外標題語感（字距、大小寫）
  // 色彩：取代單一 accent，補上文字墨色／輔助色，避免全站都是 Tailwind 預設灰階
  ink: string                   // 主要標題／內文墨色
  muted: string                 // 次要說明文字
  sectionBg: string             // 區塊底色（取代原本單一 Tailwind class）
  cardBg: string
  cardBorder: string
  heroLayout: 'overlay-left' | 'centered' | 'minimal'
  btnRadius: string
  cardClass: string
  shadow: string                // 卡片陰影（各模板深淺／有無不同，不是每個都套同一種）
  sectionPadding: string        // 區塊上下留白，精品系列留白要更大氣
}

export const TEMPLATES: BnbTemplate[] = [
  {
    id: 'natural',
    name: '自然山居',
    desc: '清新自然，適合山林民宿',
    defaultAccent: '#2d6a4f',
    previewBg: 'from-green-900 via-green-700 to-green-500',
    headingFontHref: 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@500;600;700&display=swap',
    headingFontFamily: "'Noto Serif TC', serif",
    headingWeight: '600',
    headingClass: '',
    ink: '#2b2621',
    muted: '#6b6459',
    sectionBg: '#faf6ee',
    cardBg: '#ffffff',
    cardBorder: '#eee7d9',
    heroLayout: 'overlay-left',
    btnRadius: 'rounded-full',
    cardClass: 'rounded-2xl',
    shadow: 'shadow-[0_1px_2px_rgba(43,38,33,0.06),0_8px_20px_-6px_rgba(43,38,33,0.12)] hover:shadow-[0_1px_2px_rgba(43,38,33,0.08),0_16px_32px_-8px_rgba(43,38,33,0.18)]',
    sectionPadding: 'py-14 sm:py-20',
  },
  {
    id: 'coastal',
    name: '海濱度假',
    desc: '海天一色，適合海邊民宿',
    defaultAccent: '#0369a1',
    previewBg: 'from-sky-800 via-sky-600 to-sky-400',
    headingFontHref: 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@600;700;800&display=swap',
    headingFontFamily: "'Noto Sans TC', sans-serif",
    headingWeight: '700',
    headingClass: 'tracking-wide',
    ink: '#1e293b',
    muted: '#64748b',
    sectionBg: '#f0f9ff',
    cardBg: '#ffffff',
    cardBorder: '#e0f2fe',
    heroLayout: 'centered',
    btnRadius: 'rounded-xl',
    cardClass: 'rounded-xl border',
    shadow: 'shadow-[0_1px_2px_rgba(3,105,161,0.06),0_6px_16px_-4px_rgba(3,105,161,0.12)] hover:shadow-[0_1px_2px_rgba(3,105,161,0.08),0_12px_28px_-6px_rgba(3,105,161,0.16)]',
    sectionPadding: 'py-12 sm:py-16',
  },
  {
    id: 'boutique',
    name: '精品時尚',
    desc: '簡約高端，適合精品旅館',
    defaultAccent: '#1c1c1c',
    previewBg: 'from-gray-900 via-gray-800 to-gray-700',
    headingFontHref: 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@700;900&display=swap',
    headingFontFamily: "'Noto Serif TC', serif",
    headingWeight: '800',
    headingClass: 'tracking-[0.15em] uppercase',
    ink: '#141414',
    muted: '#8a8a8a',
    sectionBg: '#ffffff',
    cardBg: '#ffffff',
    cardBorder: '#e5e5e5',
    heroLayout: 'centered',
    btnRadius: 'rounded-none',
    cardClass: 'rounded-none border',
    shadow: '',
    sectionPadding: 'py-20 sm:py-28',
  },
  {
    id: 'zen',
    name: '日式禪意',
    desc: '質樸寧靜，適合風格民宿',
    defaultAccent: '#78716c',
    previewBg: 'from-stone-700 via-stone-600 to-stone-400',
    headingFontHref: 'https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@400;500&display=swap',
    headingFontFamily: "'LXGW WenKai TC', serif",
    headingWeight: '500',
    headingClass: 'tracking-wide',
    ink: '#3d3833',
    muted: '#8c8479',
    sectionBg: '#f5f2ee',
    cardBg: '#faf9f7',
    cardBorder: '#e7e2da',
    heroLayout: 'minimal',
    btnRadius: 'rounded-lg',
    cardClass: 'rounded-xl border',
    shadow: '',
    sectionPadding: 'py-14 sm:py-20',
  },
]

export function getTemplate(id?: string | null): BnbTemplate {
  return TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0]
}
