/**
 * /gs/<id> — 個人 LINE／Zalo 群組一鍵帶入（公開頁，憑不可猜測的 id 開啟）
 * 持有人從官方帳號通知點進來：LINE 用分享連結帶入文案；Zalo 用手機分享選單或複製後開啟 Zalo
 */
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { lineShareUrl } from '@/lib/marketing/share-drafts'
import { ShareActions } from './ShareActions'

export const dynamic = 'force-dynamic'

async function loadDraft(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await createAdminClient().from('marketing_share_drafts')
    .select('app, group_name, text').eq('id', id).gt('expires_at', new Date().toISOString()).maybeSingle()
  return data
}

export default async function ShareDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await loadDraft(id)
  if (!data) notFound()
  const t = await getTranslations('DesktopConnector')
  const appName = data.app === 'line' ? 'LINE' : 'Zalo'

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md space-y-4">
        <div>
          <p className="text-xs text-slate-500">{t('share.to', { app: appName })}</p>
          <h1 className="text-lg font-bold text-slate-900">{data.group_name || t('share.anyGroup')}</h1>
        </div>
        <pre className="whitespace-pre-wrap break-words rounded-xl border bg-white p-4 text-sm text-slate-800 font-sans">{data.text}</pre>
        <ShareActions
          app={data.app as 'line' | 'zalo'}
          text={data.text as string}
          lineUrl={lineShareUrl(data.text as string)}
          labels={{
            line: t('share.openLine'),
            share: t('share.shareMenu'),
            copy: t('share.copy'),
            copied: t('share.copied'),
            openZalo: t('share.openZalo'),
            hint: t(`share.hint.${data.app}`),
          }}
        />
      </div>
    </main>
  )
}
