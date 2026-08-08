'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, CheckCircle, XCircle, BookOpen, Search, Link2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

interface ExpertKnowledgeStatus {
  id: string
  status: string
  created_at: string
}

interface Expert {
  id: string
  name: string
  domain: string | null
  source_url: string | null
  source_type: string
  description: string | null
  is_system: boolean
  expert_knowledge: ExpertKnowledgeStatus[]
}

type InputMode = 'search' | 'url' | 'manual'

const MODE_CONFIG: Record<InputMode, { icon: React.ElementType; label: string; hint: string }> = {
  search: { icon: Search, label: '搜尋', hint: '輸入名稱／主題，AI 自動搜尋相關分析並整理成知識庫' },
  url:    { icon: Link2,   label: 'URL',  hint: '貼上 YouTube 或 Blog 文章連結，自動抓取內容（逐字稿／全文）' },
  manual: { icon: FileText, label: '手動', hint: '自己整理的筆記、觀察或逐字稿，直接貼入' },
}

interface ExpertSelectorProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  single?: boolean
  className?: string
}

export function ExpertSelector({ selectedIds, onChange, single, className }: ExpertSelectorProps) {
  const [experts, setExperts] = useState<Expert[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState<InputMode>('url')
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [manualContent, setManualContent] = useState('')
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  useEffect(() => {
    fetch('/api/experts')
      .then(r => r.json())
      .then(d => setExperts(d.experts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function toggle(id: string) {
    if (single) {
      onChange(selectedIds[0] === id ? [] : [id])
      return
    }
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  function resetForm() {
    setName('')
    setDomain('')
    setSourceUrl('')
    setSearchQuery('')
    setManualContent('')
    setAddError('')
  }

  async function addExpert() {
    if (!name.trim()) { setAddError('請輸入名稱'); return }
    if (mode === 'url' && !sourceUrl.trim()) { setAddError('請輸入 URL'); return }
    if (mode === 'manual' && !manualContent.trim()) { setAddError('請輸入內容'); return }

    setAddLoading(true)
    setAddError('')
    try {
      const res = await fetch('/api/experts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          domain: domain.trim() || undefined,
          input_mode: mode,
          source_url: mode === 'url' ? sourceUrl.trim() : undefined,
          search_query: mode === 'search' ? searchQuery.trim() : undefined,
          manual_content: mode === 'manual' ? manualContent.trim() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error ?? '新增失敗'); return }

      const listRes = await fetch('/api/experts')
      const listData = await listRes.json()
      setExperts(listData.experts ?? [])
      if (data.expertId) onChange(single ? [data.expertId] : [...selectedIds, data.expertId])
      resetForm()
      setAdding(false)
    } catch {
      setAddError('連線失敗')
    } finally {
      setAddLoading(false)
    }
  }

  async function deleteExpert(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/experts/${id}`, { method: 'DELETE' })
    setExperts(prev => prev.filter(x => x.id !== id))
    onChange(selectedIds.filter(x => x !== id))
  }

  const SOURCE_LABEL: Record<string, string> = { youtube: 'YT', tiktok: 'TK', instagram: 'IG', blog: 'Blog', search: '搜尋', manual: '手動' }

  const statusIcon = (expert: Expert) => {
    const k = expert.expert_knowledge[0]
    if (!k) return <XCircle className="h-3.5 w-3.5 text-gray-400" />
    if (k.status === 'ready') return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
    if (k.status === 'processing') return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
    return <XCircle className="h-3.5 w-3.5 text-rose-500" />
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <BookOpen className="h-4 w-4" />
          引用專家知識
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
          onClick={() => { setAdding(v => !v); resetForm() }}>
          <Plus className="h-3.5 w-3.5" />新增
        </Button>
      </div>

      {adding && (
        <div className="border rounded-lg overflow-hidden bg-gray-50">
          {/* 模式切換 */}
          <div className="flex border-b bg-white">
            {(Object.keys(MODE_CONFIG) as InputMode[]).map(m => {
              const { icon: Icon, label } = MODE_CONFIG[m]
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setAddError('') }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                    mode === m ? 'border-b-2 border-primary text-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              )
            })}
          </div>

          <div className="p-3 space-y-2">
            <p className="text-xs text-muted-foreground">{MODE_CONFIG[mode].hint}</p>

            <div className="flex gap-2">
              <Input placeholder="名稱" value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
              <Input placeholder="領域（選填）" value={domain} onChange={e => setDomain(e.target.value)} className="h-8 text-sm w-28 shrink-0" />
            </div>

            {mode === 'url' && (
              <Input placeholder="YouTube / Blog URL" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} className="h-8 text-sm" />
            )}

            {mode === 'search' && (
              <Input
                placeholder={`搜尋關鍵字（留空自動搜「${name || '名稱'} 方法論 技巧 分析」）`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 text-sm"
              />
            )}

            {mode === 'manual' && (
              <Textarea
                placeholder="貼上你觀察到的技巧、逐字稿、筆記…"
                value={manualContent}
                onChange={e => setManualContent(e.target.value)}
                rows={5}
                className="text-sm resize-none"
              />
            )}

            {addError && <p className="text-xs text-rose-600">{addError}</p>}
            {addLoading && (
              <p className="text-xs text-muted-foreground">
                {mode === 'search' ? 'AI 正在搜尋並整理知識，約需 20-40 秒…' : '處理中，約需 15-30 秒…'}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button size="sm" className="h-7 text-xs" onClick={addExpert} disabled={addLoading}>
                {addLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />處理中…</> : '確認新增'}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAdding(false); resetForm() }}>取消</Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> 載入中…
        </div>
      ) : experts.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">尚無專家，點擊「新增」加入第一位</p>
      ) : (
        <div className="grid gap-1.5">
          {experts.map(expert => {
            const selected = selectedIds.includes(expert.id)
            return (
              <button key={expert.id} type="button" onClick={() => toggle(expert.id)}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-all',
                  selected ? 'border-primary bg-primary/5' : 'border-border bg-white hover:border-primary/50',
                )}>
                <div className="flex items-center gap-2 min-w-0">
                  {statusIcon(expert)}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{expert.name}</span>
                      {expert.is_system && <Badge variant="outline" className="text-[10px] h-4 px-1">系統</Badge>}
                      {expert.source_type && SOURCE_LABEL[expert.source_type] && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">{SOURCE_LABEL[expert.source_type]}</Badge>
                      )}
                    </div>
                    {expert.domain && <span className="text-xs text-muted-foreground">{expert.domain}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {selected && <Badge className="text-[10px] h-4 px-1.5">已選</Badge>}
                  {!expert.is_system && (
                    <button type="button" onClick={e => deleteExpert(expert.id, e)} className="ml-1 text-gray-400 hover:text-rose-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
