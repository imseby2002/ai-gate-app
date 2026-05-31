import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const REPO_OWNER    = 'imseby2002'
const REPO_NAME     = 'ai-gate-app'
const WORKFLOW_FILE = 'traiwan-checkin.yml'

async function ghFetch(path: string, opts: RequestInit = {}) {
  const pat = process.env.GITHUB_PAT
  if (!pat) throw new Error('GITHUB_PAT 未設定')
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub ${path}: ${res.status} ${err.slice(0, 200)}`)
  }
  return res
}

// POST — 觸發 traiwan-checkin.yml workflow
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await ghFetch(`/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ ref: 'main' }),
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// GET — 查詢最近一次執行狀態
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res  = await ghFetch(`/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1`)
    const data = await res.json()
    const run  = data.workflow_runs?.[0]
    if (!run) return NextResponse.json({ status: 'none' })

    return NextResponse.json({
      id:         run.id,
      status:     run.status,      // queued | in_progress | completed
      conclusion: run.conclusion,  // success | failure | cancelled | null
      started_at: run.run_started_at,
      html_url:   run.html_url,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
