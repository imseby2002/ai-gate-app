'use client'

import { useTranslations } from 'next-intl'
import { SkillRunner } from '@/components/skills/SkillRunner'

export default function SkillsPage() {
  const t = useTranslations('Marketing')
  return <SkillRunner module="marketing" title={t('nav.expert')} />
}
