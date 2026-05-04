export const MODULES = [
  {
    id: 'chat',
    label: 'AI 對話',
    desc: '文字對話、畫圖、影片生成、RAG 助理',
    href: '/chat',
    emoji: '💬',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'marketing',
    label: '行銷自動化',
    desc: '內容生成、圖片影片、流程自動化',
    href: '/marketing-auto',
    emoji: '🚀',
    color: 'from-emerald-500 to-teal-600',
    standalone: true,
  },
  {
    id: 'cs',
    label: '客服系統',
    desc: 'LINE / WhatsApp / Telegram 智能客服',
    href: '/marketing-auto?module=cs',
    emoji: '🎧',
    color: 'from-orange-500 to-amber-600',
    standalone: true,
  },
  {
    id: 'leads',
    label: '潛在客戶',
    desc: '行銷電話腳本、潛客分析',
    href: '/prospect-call',
    emoji: '📞',
    color: 'from-purple-500 to-violet-600',
    standalone: true,
  },
  {
    id: 'resume',
    label: '履歷優化',
    desc: 'AI 履歷潤稿與職缺媒合',
    href: '/resume',
    emoji: '📄',
    color: 'from-rose-500 to-pink-600',
    standalone: true,
  },
] as const

export type ModuleId = typeof MODULES[number]['id']

export function getModule(id: string) {
  return MODULES.find(m => m.id === id)
}
