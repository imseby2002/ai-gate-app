import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { Bot, Plus } from 'lucide-react'
import { AssistantCard } from '@/components/assistants/AssistantCard'
import { getTranslations } from 'next-intl/server'

export default async function AssistantsPage() {
  const t = await getTranslations('Assistants')
  const supabase = await createClient()
  const { data: { user } } = await getCachedUser()
  if (!user) redirect('/login')

  const { data: assistants } = await supabase
    .from('assistants')
    .select('*, assistant_files(id, file_name, file_type, file_size_bytes, processing_status)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
        </div>
        <Link
          href="/assistants/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          {t('new')}
        </Link>
      </div>

      {(!assistants || assistants.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Bot className="h-16 w-16 mb-4 opacity-30" />
          <h2 className="text-lg font-medium mb-2">{t('empty')}</h2>
          <p className="text-sm mb-6">{t('emptyHint')}</p>
          <Link
            href="/assistants/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            {t('createFirst')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assistants.map(assistant => (
            <AssistantCard key={assistant.id} assistant={assistant} />
          ))}
        </div>
      )}
    </div>
  )
}
