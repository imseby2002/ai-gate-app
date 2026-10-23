'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Download, ExternalLink, FileBadge, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface FileLink { name: string; url: string; download_url: string }
interface LicenseDoc {
  id: string
  doc_type: 'company_license' | 'sanitary_cert'
  title: string
  store_code: string
  counterparty: string
  effective_date: string | null
  expiry_date: string | null
  file: FileLink | null
  images: (FileLink & { path: string })[]
}

const TYPE_BADGE: Record<string, string> = {
  company_license: 'bg-violet-50 text-violet-700 border-violet-200',
  sanitary_cert: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export default function StoreLicensesPage() {
  const t = useTranslations('StoreLicenses')
  const [docs, setDocs] = useState<LicenseDoc[]>([])
  const [stores, setStores] = useState<{ code: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unbound, setUnbound] = useState(false)
  const [type, setType] = useState<'all' | 'company_license' | 'sanitary_cert'>('all')

  useEffect(() => {
    fetch('/api/store/licenses')
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || String(r.status))
        setDocs(d.documents ?? [])
        setUnbound(!!d.unbound)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
    fetch('/api/fin/stores').then(r => (r.ok ? r.json() : { stores: [] })).then(d => setStores(d.stores ?? [])).catch(() => {})
  }, [])

  const storeName = (code: string) => stores.find(s => s.code === code)?.name || code
  const groups = useMemo(() => {
    const m = new Map<string, LicenseDoc[]>()
    for (const d of docs) {
      if (type !== 'all' && d.doc_type !== type) continue
      const k = d.store_code || ''
      m.set(k, [...(m.get(k) ?? []), d])
    }
    return [...m.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])))
  }, [docs, type])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
            <FileBadge className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t('title')}</h1>
            <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <Link href="/store"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />{t('back')}</Button></Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', 'company_license', 'sanitary_cert'] as const).map(k => (
          <button key={k} onClick={() => setType(k)}
            className={`text-xs px-3 py-1.5 rounded-full border ${type === k ? 'bg-teal-600 text-white border-teal-600' : 'bg-background hover:bg-muted'}`}>
            {t(`type_${k}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <Card className="p-4 text-sm text-red-600 flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</Card>
      ) : unbound ? (
        <Card className="p-6 text-sm text-amber-700 bg-amber-50 border-amber-200">{t('unbound')}</Card>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground border-2 border-dashed rounded-xl">{t('empty')}</div>
      ) : (
        groups.map(([code, list]) => (
          <section key={code || '_'} className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">{code ? storeName(code) : t('noStore')}</h2>
            <div className="grid gap-2.5">
              {list.map(d => (
                <Card key={d.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${TYPE_BADGE[d.doc_type] ?? ''}`}>{t(`type_${d.doc_type}`)}</span>
                        <span className="font-bold text-sm">{d.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        {d.counterparty && <span>{t('issuer')}: {d.counterparty}</span>}
                        {d.effective_date && <span>{t('effective')}: {d.effective_date}</span>}
                        {d.expiry_date && <span>{t('expiry')}: {d.expiry_date}</span>}
                      </div>
                    </div>
                    {d.file?.url && (
                      <div className="flex gap-1.5 shrink-0">
                        <a href={d.file.url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" className="h-8 text-xs"><ExternalLink className="h-3.5 w-3.5 mr-1" />{t('viewOriginal')}</Button></a>
                        <a href={d.file.download_url}><Button size="sm" variant="outline" className="h-8 text-xs"><Download className="h-3.5 w-3.5 mr-1" />{t('download')}</Button></a>
                      </div>
                    )}
                  </div>
                  {d.images.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {d.images.map(img => (
                        <div key={img.path} className="w-24 space-y-1">
                          <a href={img.url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt={img.name} className="h-24 w-24 object-cover rounded border bg-muted" />
                          </a>
                          <a href={img.download_url} className="flex items-center justify-center gap-1 text-[11px] text-teal-700 hover:underline">
                            <Download className="h-3 w-3" />{t('download')}
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1"><ImageIcon className="h-3 w-3" />{t('noImages')}</div>
                  )}
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
