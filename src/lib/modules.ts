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
    id: 'roundtable',
    label: '智慧圓桌',
    desc: '多模型與多角色 AI 專家會議、論述與自動總結',
    href: '/roundtable',
    emoji: '🏛️',
    color: 'from-amber-500 to-orange-600',
    standalone: true,
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
    href: '/cs',
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
    label: '職場助手',
    desc: 'AI 全方位職場助理 — 求職 × 日常 × 進階',
    href: '/resume',
    emoji: '📄',
    color: 'from-rose-500 to-pink-600',
    standalone: true,
  },
  {
    id: 'booking',
    label: '訂房系統',
    desc: '房源、訂單、定價與線上訂房',
    href: '/booking',
    emoji: '🏨',
    color: 'from-cyan-500 to-sky-600',
    standalone: true,
  },
  {
    id: 'agent',
    label: 'AI Agent',
    desc: '全自動 AI 員工：自主研究、規劃、執行，重要動作交真人核准',
    href: '/agent',
    color: 'from-slate-600 to-zinc-800',
    standalone: true,
  },
  {
    id: 'legal',
    label: '法律合規 AI',
    desc: '越南法律公務文書、各國進口規定與門市設立合規',
    href: '/legal',
    emoji: '⚖️',
    color: 'from-amber-600 to-rose-600',
    standalone: true,
  },
] as const

export type ModuleId = typeof MODULES[number]['id']

export function getModule(id: string) {
  return MODULES.find(m => m.id === id)
}
