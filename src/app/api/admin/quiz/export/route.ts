import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildXlsx, type XlsxCell } from '@/lib/hr/xlsx'
import { QUIZZES, QUIZ_LANG_LABEL, attemptNumbers, type QuizLang } from '@/lib/quiz'

export const dynamic = 'force-dynamic'

// 測驗成績匯出（.xlsx，僅 admin）：每份交卷一列，含首次／重考、語言、每題作答與對錯
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const quizId = req.nextUrl.searchParams.get('quiz') ?? ''
  const quiz = QUIZZES[quizId]
  if (!quiz) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data, error } = await createAdminClient()
    .from('quiz_submissions')
    .select('id, name, lang, answers, score, total, created_at')
    .eq('quiz_id', quizId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = (data ?? []) as {
    id: string; name: string; lang: QuizLang | null; answers: Record<string, string>
    score: number; total: number; created_at: string
  }[]
  const attempt = attemptNumbers(list)

  const rows: XlsxCell[][] = [[
    '交卷時間', '姓名', '分數', '總分', '作答次數', '語言',
    ...quiz.questions.map((_, i) => `第 ${i + 1} 題`),
  ]]
  for (const r of list) {
    const n = attempt.get(r.id) ?? 1
    rows.push([
      new Date(r.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }),
      r.name,
      r.score,
      r.total,
      n === 1 ? '首次' : `第 ${n} 次（重考）`,
      r.lang ? QUIZ_LANG_LABEL[r.lang] : '',
      ...quiz.questions.map(q => {
        const a = r.answers?.[q.id]
        return a ? `${a} ${a === q.answer ? '✓' : '✗'}` : ''
      }),
    ])
  }

  const buf = buildXlsx('成績', rows)
  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${quiz.title.zh}成績_${date}.xlsx`)}`,
    },
  })
}
