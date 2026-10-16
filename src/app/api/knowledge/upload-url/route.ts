/**
 * POST /api/knowledge/upload-url — 取得知識檔案直傳 Storage 的 signed upload URL
 * body: { department, fileName }；回傳 { path, token }，前端以 uploadToSignedUrl 上傳後再呼叫 POST /api/knowledge { storagePath }
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getDeptAccess, canManageDept } from '@/lib/company/dept-access'
import { isSupportedKnowledgeFile } from '@/lib/knowledge/extract'
import { KNOWLEDGE_BUCKET } from '@/lib/knowledge/constants'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: access.status })

  const body = await req.json().catch(() => null) as { department?: string; fileName?: string } | null
  const department = String(body?.department ?? '').trim()
  const fileName = String(body?.fileName ?? '').trim()
  if (!department || !fileName) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  if (!canManageDept(access, department)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isSupportedKnowledgeFile(fileName)) return NextResponse.json({ error: 'unsupported_type' }, { status: 400 })

  const ext = fileName.toLowerCase().split('.').pop()
  const path = `${access.companyId}/${randomUUID()}.${ext}`
  const { data, error } = await access.admin.storage.from(KNOWLEDGE_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[knowledge/upload-url]', error)
    return NextResponse.json({ error: error?.message ?? 'failed' }, { status: 500 })
  }
  return NextResponse.json({ path: data.path, token: data.token })
}
