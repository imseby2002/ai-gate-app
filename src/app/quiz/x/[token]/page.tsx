// 公開作答頁（應徵者，免登入；middleware 已將 /quiz/ 設為公開）
import { ExamTaker } from '@/components/exams/ExamTaker'

export const dynamic = 'force-dynamic'

export default async function PublicExamPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const url = `/api/quiz/exam/${encodeURIComponent(token)}`
  return <ExamTaker loadUrl={url} submitUrl={url} isPublic />
}
