import { createAdminClient } from '@/lib/supabase/admin'

// 證件圖片存檔（公司執照、門市衛生證）：存在 ai_extracted.images，檔案放 affair-docs bucket
export const AFFAIR_BUCKET = 'affair-docs'
export const IMAGE_DOC_TYPES = new Set(['company_license', 'sanitary_cert', 'license'])

export interface DocImage { path: string; name: string; mime: string; uploaded_at?: string }

export function docImages(aiExtracted: unknown): DocImage[] {
  const imgs = (aiExtracted as { images?: unknown } | null)?.images
  return Array.isArray(imgs) ? (imgs as DocImage[]).filter(i => i && typeof i.path === 'string') : []
}

// 產生檢視／下載用簽章網址
export async function signDocImages(images: DocImage[], expires = 3600) {
  if (!images.length) return []
  const admin = createAdminClient()
  return Promise.all(images.map(async img => {
    const [{ data: view }, { data: dl }] = await Promise.all([
      admin.storage.from(AFFAIR_BUCKET).createSignedUrl(img.path, expires),
      admin.storage.from(AFFAIR_BUCKET).createSignedUrl(img.path, expires, { download: img.name || true }),
    ])
    return { path: img.path, name: img.name, mime: img.mime, url: view?.signedUrl ?? '', download_url: dl?.signedUrl ?? '' }
  }))
}
