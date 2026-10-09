import { createAdminClient } from '@/lib/supabase/admin'
import { QUIZZES, type QuizLang } from '@/lib/quiz'

export const dynamic = 'force-dynamic'

interface Submission {
  id: string
  quiz_id: string
  name: string
  lang: QuizLang | null
  answers: Record<string, string>
  score: number
  total: number
  created_at: string
}

const LANG_LABEL: Record<QuizLang, string> = { zh: '中文', en: 'English', vi: 'Tiếng Việt' }

function normName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export default async function AdminQuizPage() {
  // 權限由 (admin)/layout.tsx 把關（僅 admin）
  const { data, error } = await createAdminClient()
    .from('quiz_submissions')
    .select('id, quiz_id, name, lang, answers, score, total, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  const rows = (data ?? []) as Submission[]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">測驗成績</h1>
        <p className="text-sm text-muted-foreground mt-1">公開測驗頁 /quiz/* 的交卷紀錄（最新 500 筆）</p>
      </div>

      {error && <div className="text-sm text-red-600">讀取失敗：{error.message}</div>}

      {Object.entries(QUIZZES).map(([quizId, quiz]) => {
        const list = rows.filter(r => r.quiz_id === quizId)
        const keys = quiz.questions.map(q => q.id)
        // 交卷後會公布答案，重考分數不具參考性：依姓名照時間排序標出第幾次作答，平均只算首次
        const attempt = new Map<string, number>()
        const seen = new Map<string, number>()
        for (const r of [...list].reverse()) {
          const n = normName(r.name)
          const c = (seen.get(n) ?? 0) + 1
          seen.set(n, c)
          attempt.set(r.id, c)
        }
        const firsts = list.filter(r => attempt.get(r.id) === 1)
        const avg = firsts.length ? (firsts.reduce((s, r) => s + r.score, 0) / firsts.length).toFixed(1) : '-'
        return (
          <section key={quizId} className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex flex-wrap items-center gap-x-4 gap-y-1">
              <h2 className="font-semibold">{quiz.title.zh}</h2>
              <a href={`/quiz/${quizId}.html`} target="_blank" className="text-xs text-blue-600 hover:underline">/quiz/{quizId}.html</a>
              <span className="text-xs text-muted-foreground">共 {firsts.length} 人 · {list.length} 份 · 首次平均 {avg} / {keys.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 whitespace-nowrap">交卷時間</th>
                    <th className="text-left px-3 py-2">姓名</th>
                    <th className="text-left px-3 py-2">分數</th>
                    <th className="text-left px-3 py-2 whitespace-nowrap">作答次數</th>
                    <th className="text-left px-3 py-2">語言</th>
                    {keys.map((k, i) => <th key={k} className="px-2 py-2">{i + 1}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 && (
                    <tr><td colSpan={keys.length + 5} className="px-3 py-6 text-center text-muted-foreground">尚無紀錄</td></tr>
                  )}
                  {list.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}
                      </td>
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2 font-semibold whitespace-nowrap">{r.score} / {r.total}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {attempt.get(r.id) === 1
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">首次</span>
                          : <span className="text-xs text-muted-foreground">第 {attempt.get(r.id)} 次（重考）</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{r.lang ? LANG_LABEL[r.lang] : '-'}</td>
                      {quiz.questions.map(({ id: k, answer }) => {
                        const ok = r.answers?.[k] === answer
                        return (
                          <td key={k} className={`px-2 py-2 text-center ${ok ? 'text-emerald-600' : 'text-red-600 font-semibold bg-red-50'}`}>
                            {r.answers?.[k] ?? '-'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t px-4 py-3 space-y-3">
              <h3 className="text-sm font-semibold">每題詳細說明</h3>
              {quiz.questions.map((q, i) => {
                const correct = firsts.filter(r => r.answers?.[q.id] === q.answer).length
                return (
                  <div key={q.id} className="rounded-lg border p-3 text-sm space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="font-medium">{i + 1}. {q.question.zh}</div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        首次答對 {correct} / {firsts.length}{firsts.length ? `（${Math.round(correct / firsts.length * 100)}%）` : ''}
                      </span>
                    </div>
                    <ul className="space-y-0.5">
                      {(['A', 'B', 'C'] as const).map(opt => (
                        <li key={opt} className={opt === q.answer ? 'text-emerald-700 font-semibold' : 'text-muted-foreground'}>
                          {opt}. {q.options[opt].zh}{opt === q.answer && ' ✓'}
                        </li>
                      ))}
                    </ul>
                    <p className="text-muted-foreground leading-relaxed">{q.explanation.zh}</p>
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">English / Tiếng Việt</summary>
                      <div className="mt-2 space-y-2">
                        <p><span className="font-medium">EN：</span>{q.question.en}<br />{q.answer}. {q.options[q.answer].en}<br />{q.explanation.en}</p>
                        <p><span className="font-medium">VI：</span>{q.question.vi}<br />{q.answer}. {q.options[q.answer].vi}<br />{q.explanation.vi}</p>
                      </div>
                    </details>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
