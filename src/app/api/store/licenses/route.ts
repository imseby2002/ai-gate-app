import { NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { AFFAIR_BUCKET, IMAGE_DOC_TYPES, docImages, signDocImages } from '@/lib/affairs/doc-images'

export const dynamic = 'force-dynamic'

// 門市證照（營業執照、衛生證）唯讀查看＋下載。
// 店長只看得到自己綁定的門市；管理者／總務可看全部；未綁定門市的帳號看不到任何資料。
export async function GET() {
  const ctx = await getUnitContextAny(['store', 'affairs'])
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })

  const seeAll = ctx.isAdmin || (ctx.units ?? []).includes('affairs')
  const stores = ctx.storeCodes ?? []
  if (!seeAll && !stores.length) return NextResponse.json({ documents: [], unbound: true })

  let q = ctx.admin.from('affair_documents')
    .select('id, doc_type, title, store_code, counterparty, effective_date, expiry_date, storage_path, file_name, mime, ai_extracted, status')
    .eq('owner_id', ctx.ownerId)
    .in('doc_type', [...IMAGE_DOC_TYPES])
    .neq('status', 'archived')
  if (!seeAll) q = q.in('store_code', stores)
  const { data, error } = await q.order('store_code').order('doc_type')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const admin = createAdminClient()
  const documents = await Promise.all((data ?? []).map(async d => {
    let file = null as null | { name: string; url: string; download_url: string }
    if (d.storage_path) {
      const name = d.file_name || 'document'
      const [{ data: v }, { data: dl }] = await Promise.all([
        admin.storage.from(AFFAIR_BUCKET).createSignedUrl(d.storage_path, 3600),
        admin.storage.from(AFFAIR_BUCKET).createSignedUrl(d.storage_path, 3600, { download: name }),
      ])
      file = { name, url: v?.signedUrl ?? '', download_url: dl?.signedUrl ?? '' }
    }
    return {
      id: d.id,
      doc_type: d.doc_type === 'license' ? 'sanitary_cert' : d.doc_type,
      title: d.title,
      store_code: d.store_code,
      counterparty: d.counterparty,
      effective_date: d.effective_date,
      expiry_date: d.expiry_date,
      file,
      images: await signDocImages(docImages(d.ai_extracted)),
    }
  }))
  return NextResponse.json({ documents, store_codes: seeAll ? null : stores })
}
