import { notFound } from 'next/navigation'
import SystemAuth from '@/components/auth/SystemAuth'
import { isSystemKey } from '@/lib/systems'

export default async function SystemLoginPage({ params }: { params: Promise<{ system: string }> }) {
  const { system } = await params
  if (!isSystemKey(system)) notFound()
  return <SystemAuth system={system} />
}
