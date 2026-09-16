'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { FlaskConical, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'


export default function RdRecipesPage() {
  const router = useRouter()
  const t = useTranslations('RdRecipes')

  useEffect(() => {
    // 自動無縫導向至合一之「配方」
    const timer = setTimeout(() => {
      router.replace('/rd')
    }, 100)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-purple-100">
        <FlaskConical className="h-8 w-8" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          {t('subtitle')}
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 pt-4">
        <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
        <Link href="/rd">
          <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2 text-sm">
            {t('goNow')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
