import { redirect } from 'next/navigation'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { AssistantForm } from '@/components/assistants/AssistantForm'
import { getTranslations } from 'next-intl/server'

export default async function NewAssistantPage() {
  const t = await getTranslations('Assistants')
  const supabase = await createClient()
  const { data: { user } } = await getCachedUser()
  if (!user) redirect('/login')

  const { data: models } = await supabase
    .from('ai_models')
    .select('*')
    .eq('is_enabled', true)
    .order('sort_order')

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background px-6 py-6">
      <div className="max-w-2xl mx-auto mb-6">
        <h1 className="text-2xl font-bold">{t('newTitle')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('newSubtitle')}</p>
      </div>
      <AssistantForm models={models ?? []} />
    </div>
  )
}
