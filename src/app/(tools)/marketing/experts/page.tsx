'use client'

import { useState } from 'react'
import { Sparkles, Brain } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { SkillRunner } from '@/components/skills/SkillRunner'
import { CustomExperts } from '@/components/marketing/CustomExperts'

// AI 專家：內建專家（skill 模式）＋ 自製專家 合併，預設進「內建專家」
export default function AiExpertsPage() {
  const t = useTranslations('Marketing')
  const [tab, setTab] = useState<'builtin' | 'mine'>('builtin')

  const TabBtn = ({ id, icon: Icon, label }: { id: 'builtin' | 'mine'; icon: React.ElementType; label: string }) => {
    const active = tab === id
    return (
      <button onClick={() => setTab(id)}
        className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors
          ${active ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
        <Icon className="h-4 w-4" />{label}
      </button>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-1 px-4 pt-2 border-b bg-white shrink-0">
        <TabBtn id="builtin" icon={Sparkles} label={t('expertsPage.builtin')} />
        <TabBtn id="mine" icon={Brain} label={t('expertsPage.mine')} />
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === 'builtin'
          ? <SkillRunner module="marketing" title={t('expertsPage.builtin')} />
          : <CustomExperts />}
      </div>
    </div>
  )
}
