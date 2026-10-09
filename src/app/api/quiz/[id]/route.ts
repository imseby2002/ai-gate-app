import { NextResponse } from 'next/server'
import { QUIZZES } from '@/lib/quiz'

// 公開：回傳題目與選項（三語），不含正確答案與解說
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const quiz = QUIZZES[id]
  if (!quiz) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({
    title: quiz.title,
    questions: quiz.questions.map(q => ({ id: q.id, question: q.question, options: q.options })),
  })
}
