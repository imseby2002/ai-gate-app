import { notFound } from 'next/navigation'
import SystemAuth from '@/components/auth/SystemAuth'
import { isSystemKey } from '@/lib/systems'

// 註冊與登入同頁：登入即註冊（查無帳號自動建立）
export default async function SystemRegisterPage({ params }: { params: Promise<{ system: string }> }) {
  const { system } = await params
  if (!isSystemKey(system)) notFound()
  return <SystemAuth system={system} />
}
