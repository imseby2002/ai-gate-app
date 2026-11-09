import { ExamReview } from '@/components/exams/ExamReview'

export const dynamic = 'force-dynamic'

export default async function ExamReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ExamReview url={`/api/exams/${id}/my-result`} />
}
