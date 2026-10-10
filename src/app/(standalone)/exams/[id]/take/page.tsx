import { ExamTaker } from '@/components/exams/ExamTaker'

export const dynamic = 'force-dynamic'

export default async function TakeExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ExamTaker loadUrl={`/api/exams/${id}/take`} submitUrl={`/api/exams/${id}/take`} />
}
