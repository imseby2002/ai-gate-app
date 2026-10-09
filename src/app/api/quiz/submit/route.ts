import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { QUIZZES } from '@/lib/quiz'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as
    { quiz_id?: unknown; name?: unknown; answers?: unknown } | null
  const quiz = typeof body?.quiz_id === 'string' ? QUIZZES[body.quiz_id] : undefined
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 50) : ''
  const raw = body?.answers && typeof body.answers === 'object' ? body.answers as Record<string, unknown> : null
  if (!quiz || !name || !raw) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const answers: Record<string, string> = {}
  const keys = Object.keys(quiz.answers)
  for (const k of keys) {
    const v = raw[k]
    if (typeof v !== 'string' || !['A', 'B', 'C'].includes(v)) {
      return NextResponse.json({ error: 'incomplete' }, { status: 400 })
    }
    answers[k] = v
  }
  const score = keys.filter(k => answers[k] === quiz.answers[k]).length

  const { error } = await createAdminClient().from('quiz_submissions').insert({
    quiz_id: body!.quiz_id,
    name,
    answers,
    score,
    total: keys.length,
    user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
  })
  if (error) {
    console.error('[quiz-submit]', error)
    return NextResponse.json({ error: 'save_failed' }, { status: 500 })
  }

  return NextResponse.json({ score, total: keys.length })
}
