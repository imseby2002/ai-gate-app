import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { QUIZZES, isQuizLang } from '@/lib/quiz'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as
    { quiz_id?: unknown; name?: unknown; lang?: unknown; answers?: unknown } | null
  const quiz = typeof body?.quiz_id === 'string' ? QUIZZES[body.quiz_id] : undefined
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 50) : ''
  const lang = isQuizLang(body?.lang) ? body.lang : null
  const raw = body?.answers && typeof body.answers === 'object' ? body.answers as Record<string, unknown> : null
  if (!quiz || !name || !raw) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const answers: Record<string, string> = {}
  for (const q of quiz.questions) {
    const v = raw[q.id]
    if (typeof v !== 'string' || !['A', 'B', 'C'].includes(v)) {
      return NextResponse.json({ error: 'incomplete' }, { status: 400 })
    }
    answers[q.id] = v
  }
  const total = quiz.questions.length
  const score = quiz.questions.filter(q => answers[q.id] === q.answer).length

  const { error } = await createAdminClient().from('quiz_submissions').insert({
    quiz_id: body!.quiz_id,
    name,
    lang,
    answers,
    score,
    total,
    user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
  })
  if (error) {
    console.error('[quiz-submit]', error)
    return NextResponse.json({ error: 'save_failed' }, { status: 500 })
  }

  // 交卷後回傳正確答案與三語解說，前端依目前選擇的語言顯示
  const key = Object.fromEntries(quiz.questions.map(q => [q.id, { answer: q.answer, explanation: q.explanation }]))
  return NextResponse.json({ score, total, key })
}
