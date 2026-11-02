'use client'
// 平台擁有者（imseby@gmail.com）判定：通訊測試（電話／簡訊／Email）與來電顯示號碼等平台設定只給平台擁有者看
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export const PLATFORM_OWNER_EMAIL = 'imseby@gmail.com'

export function usePlatformOwner(): boolean {
  const [isOwner, setIsOwner] = useState(false)
  useEffect(() => {
    let alive = true
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (alive) setIsOwner((user?.email ?? '').toLowerCase().trim() === PLATFORM_OWNER_EMAIL)
    }).catch(() => {})
    return () => { alive = false }
  }, [])
  return isOwner
}
