import ApplyForm from '../ApplyForm'

export default async function ApplyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <ApplyForm code={code} />
}
