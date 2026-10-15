import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface UserAssetItem {
  id: string
  name: string
  url: string
  type: 'studio' | 'template' | 'img' | 'video' | 'other'
  typeLabel: string
  subType?: string
  createdAt: string
  size: number
  isVideo: boolean
}

function parseAssetType(name: string): { type: UserAssetItem['type']; typeLabel: string; subType?: string } {
  const isVideo = name.endsWith('.mp4') || name.endsWith('.webm') || name.startsWith('sora-') || name.includes('video')

  if (isVideo) {
    return { type: 'video', typeLabel: 'AI 影片' }
  }

  if (name.startsWith('studio-')) {
    const parts = name.split('-')
    const sub = parts[1] || ''
    const subLabels: Record<string, string> = {
      'redesign': '店面/空間重繪',
      'inpaint': '局部重繪/修圖',
      'outpaint': '畫布擴展',
      'bg-remove': '智慧去背',
      'style': '風格轉換',
      'enhance': '超高解析度放大',
      'video': '視覺工坊影片',
    }
    return {
      type: 'studio',
      typeLabel: subLabels[sub] || '視覺工坊設計',
      subType: sub,
    }
  }

  if (name.startsWith('template-')) {
    return { type: 'template', typeLabel: '行銷風格模板' }
  }

  if (name.startsWith('img-')) {
    return { type: 'img', typeLabel: '產品設計生成' }
  }

  return { type: 'other', typeLabel: '行銷素材' }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data: files, error } = await supabase.storage
      .from('marketing-assets')
      .list(user.id, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      })

    if (error) {
      console.error('[assets GET error]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const assets: UserAssetItem[] = (files || [])
      .filter(f => f.name && !f.name.startsWith('.'))
      .map(f => {
        const { data: { publicUrl } } = supabase.storage
          .from('marketing-assets')
          .getPublicUrl(`${user.id}/${f.name}`)

        const isVideo = f.name.endsWith('.mp4') || f.name.endsWith('.webm') || f.name.startsWith('sora-')
        const { type, typeLabel, subType } = parseAssetType(f.name)

        return {
          id: f.id || f.name,
          name: f.name,
          url: publicUrl,
          type,
          typeLabel,
          subType,
          createdAt: f.created_at || new Date().toISOString(),
          size: f.metadata?.size || 0,
          isVideo,
        }
      })

    return NextResponse.json({ ok: true, assets })
  } catch (err: any) {
    console.error('[assets GET exception]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { name, url } = body

    let fileName = name
    if (!fileName && url) {
      const marker = '/marketing-assets/'
      const idx = url.indexOf(marker)
      if (idx !== -1) {
        const fullPath = decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
        if (fullPath.startsWith(user.id + '/')) {
          fileName = fullPath.slice(user.id.length + 1)
        }
      }
    }

    if (!fileName) {
      return NextResponse.json({ error: '檔案名稱必填' }, { status: 400 })
    }

    const filePath = `${user.id}/${fileName}`
    const { error } = await supabase.storage.from('marketing-assets').remove([filePath])
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, deleted: fileName })
  } catch (err: any) {
    console.error('[assets DELETE exception]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
