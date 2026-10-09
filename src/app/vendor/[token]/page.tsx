import VendorFill from '../VendorFill'

export default async function VendorFillPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <VendorFill token={token} legacy />
}
