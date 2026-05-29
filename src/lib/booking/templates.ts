export interface BnbTemplate {
  id: string
  name: string
  desc: string
  defaultAccent: string
  previewBg: string
  sectionAlt: string
  heroLayout: 'overlay-left' | 'centered' | 'minimal'
  btnRadius: string
  cardClass: string
}

export const TEMPLATES: BnbTemplate[] = [
  {
    id: 'natural',
    name: '自然山居',
    desc: '清新自然，適合山林民宿',
    defaultAccent: '#2d6a4f',
    previewBg: 'from-green-900 via-green-700 to-green-500',
    sectionAlt: 'bg-green-50',
    heroLayout: 'overlay-left',
    btnRadius: 'rounded-full',
    cardClass: 'rounded-2xl shadow-sm hover:shadow-md',
  },
  {
    id: 'coastal',
    name: '海濱度假',
    desc: '海天一色，適合海邊民宿',
    defaultAccent: '#0369a1',
    previewBg: 'from-sky-800 via-sky-600 to-sky-400',
    sectionAlt: 'bg-sky-50',
    heroLayout: 'centered',
    btnRadius: 'rounded-xl',
    cardClass: 'rounded-xl border-2 border-gray-100',
  },
  {
    id: 'boutique',
    name: '精品時尚',
    desc: '簡約高端，適合精品旅館',
    defaultAccent: '#1c1c1c',
    previewBg: 'from-gray-900 via-gray-800 to-gray-700',
    sectionAlt: 'bg-gray-50',
    heroLayout: 'centered',
    btnRadius: 'rounded-none',
    cardClass: 'rounded-none shadow-lg',
  },
  {
    id: 'zen',
    name: '日式禪意',
    desc: '質樸寧靜，適合風格民宿',
    defaultAccent: '#78716c',
    previewBg: 'from-stone-700 via-stone-600 to-stone-400',
    sectionAlt: 'bg-stone-50',
    heroLayout: 'minimal',
    btnRadius: 'rounded-lg',
    cardClass: 'rounded-xl bg-stone-50 border border-stone-200',
  },
]

export function getTemplate(id?: string | null): BnbTemplate {
  return TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0]
}
