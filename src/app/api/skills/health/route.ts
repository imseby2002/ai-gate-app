// GET /api/skills/health — 探測當前 runtime 對各能力的支援度
// 目前主要檢查 pptxgenjs 能否在此環境產出 .pptx（Cloudflare Workers 可能不支援）。
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import pptxgen from 'pptxgenjs'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // pptx 產檔探測
  let pptx: { ok: boolean; bytes?: number; error?: string }
  try {
    const p = new pptxgen()
    p.addSlide().addText('health check', { x: 1, y: 1, w: 4, h: 1 })
    const out = await p.write({ outputType: 'nodebuffer' })
    const bytes = out instanceof Uint8Array ? out.length : (out as ArrayBuffer).byteLength
    pptx = { ok: bytes > 0, bytes }
  } catch (err) {
    pptx = { ok: false, error: String(err) }
  }

  const env = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    fal: !!process.env.FAL_AI_API_KEY,
  }

  return NextResponse.json({ pptx, env, runtime: process.env.NEXT_RUNTIME ?? 'nodejs' })
}
