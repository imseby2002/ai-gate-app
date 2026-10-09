import { createAdminClient } from '@/lib/supabase/admin'
import { QUIZZES } from '@/lib/quiz'

export const dynamic = 'force-dynamic'

interface Submission {
  id: string
  quiz_id: string
  name: string
  answers: Record<string, string>
  score: number
  total: number
  created_at: string
}

export default async function AdminQuizPage() {
  // 權限由 (admin)/layout.tsx 把關（僅 admin）
  const { data, error } = await createAdminClient()
    .from('quiz_submissions')
    .select('id, quiz_id, name, answers, score, total, created_at')
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
        const keys = Object.keys(quiz.answers)
        const avg = list.length ? (list.reduce((s, r) => s + r.score, 0) / list.length).toFixed(1) : '-'
        return (
          <section key={quizId} className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex flex-wrap items-center gap-x-4 gap-y-1">
              <h2 className="font-semibold">{quiz.title}</h2>
              <a href={`/quiz/${quizId}.html`} target="_blank" className="text-xs text-blue-600 hover:underline">/quiz/{quizId}.html</a>
              <span className="text-xs text-muted-foreground">共 {list.length} 份 · 平均 {avg} / {keys.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 whitespace-nowrap">交卷時間</th>
                    <th className="text-left px-3 py-2">姓名</th>
                    <th className="text-left px-3 py-2">分數</th>
                    {keys.map((k, i) => <th key={k} className="px-2 py-2">{i + 1}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 && (
                    <tr><td colSpan={keys.length + 3} className="px-3 py-6 text-center text-muted-foreground">尚無紀錄</td></tr>
                  )}
                  {list.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}
                      </td>
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2 font-semibold whitespace-nowrap">{r.score} / {r.total}</td>
                      {keys.map(k => {
                        const ok = r.answers?.[k] === quiz.answers[k]
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
          </section>
        )
      })}
    </div>
  )
}
