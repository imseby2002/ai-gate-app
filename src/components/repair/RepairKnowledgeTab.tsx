'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  BookOpen, Search, Plus, Filter, FileText, Cpu, CheckCircle2,
  AlertTriangle, Wrench, Sparkles, Loader2, ArrowRight, ShieldCheck,
  Tag, Download, UploadCloud, Eye, Zap, Layers
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import type {
  RepairKnowledgeChunk,
  EquipmentCategory,
  KnowledgeChunkType,
  EquipmentModelInfo,
  RepairCaseFeedback,
} from '@/lib/types/repair-ai'
import { INITIAL_KNOWLEDGE_CHUNKS, INITIAL_REPAIR_CASES } from '@/lib/repair-ai/knowledge-base'

export default function RepairKnowledgeTab() {
  const t = useTranslations('RepairKnowledge')
  const [chunks, setChunks] = useState<RepairKnowledgeChunk[]>(INITIAL_KNOWLEDGE_CHUNKS)
  const [cases, setCases] = useState<RepairCaseFeedback[]>(INITIAL_REPAIR_CASES)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')

  // 冷啟動推導 Modal
  const [showColdStart, setShowColdStart] = useState(false)
  const [csBrand, setCsBrand] = useState('')
  const [csModel, setCsModel] = useState('')
  const [csCategory, setCsCategory] = useState<EquipmentCategory>('bar')
  const [csLoading, setCsLoading] = useState(false)
  const [csResult, setCsResult] = useState<EquipmentModelInfo | null>(null)

  // 新增手冊切片 Modal
  const [showAddChunk, setShowAddChunk] = useState(false)
  const [newChunk, setNewChunk] = useState({
    equipment_model: '益芳-ET-99S',
    category: 'bar' as EquipmentCategory,
    chunk_type: 'maintenance_sop' as KnowledgeChunkType,
    title: '',
    content: '',
    safe_for_store: true,
    tech_only: false,
    tags: '',
  })
  const [savingChunk, setSavingChunk] = useState(false)

  // 技師案例回饋 Modal
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [newFeedback, setNewFeedback] = useState({
    order_id: '',
    equipment_model: '益芳-ET-99S',
    symptom: '',
    actual_root_cause: '',
    parts_replaced: '',
    measured_resistance_or_voltage: '',
    technician_note: '',
    verified_by: '機電工務組',
  })
  const [savingFeedback, setSavingFeedback] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [chunkRes, caseRes] = await Promise.all([
        fetch('/api/repair/ai/knowledge'),
        fetch('/api/repair/ai/feedback'),
      ])
      const cJson = await chunkRes.json()
      const csJson = await caseRes.json()
      if (cJson.chunks) setChunks(cJson.chunks)
      if (csJson.cases) setCases(csJson.cases)
    } catch (e) {
      console.warn('Load knowledge fallback to seeds:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // 執行冷啟動推導
  const handleRunColdStart = async () => {
    if (!csBrand.trim() || !csModel.trim()) {
      alert(t('errBrandModel'))
      return
    }
    setCsLoading(true)
    try {
      const res = await fetch('/api/repair/ai/cold-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: csBrand, model_name: csModel, category: csCategory }),
      })
      const data = await res.json()
      if (res.ok && data.model) {
        setCsResult(data.model)
        // 自動加到切片清單供即刻檢視
        const generatedChunk: RepairKnowledgeChunk = {
          id: `chk-cs-${Date.now()}`,
          equipment_model: `${data.model.brand}-${data.model.model_name}`,
          category: data.model.category,
          chunk_type: 'troubleshooting_tree',
          title: `【冷啟動狀態機】${data.model.brand} ${data.model.model_name} 10大標準排查規範`,
          content: `${data.model.description}\n\n【機電狀態機流程】：\n${data.model.state_machine_steps?.join('\n')}\n\n【常見故障代碼對照】：\n${data.model.common_error_codes?.map((c: any) => `[${c.code}] ${c.symptom} ➔ 原因: ${c.cause} (門市:${c.store_action} / 技師:${c.tech_action})`).join('\n')}`,
          source_file: '冷啟動機電狀態機自動推導',
          safe_for_store: true,
          tech_only: false,
          tags: [data.model.brand, data.model.model_name, '冷啟動', '狀態機'],
          created_at: new Date().toISOString(),
        }
        setChunks(prev => [generatedChunk, ...prev])
      } else {
        alert(data.error || t('errDerive'))
      }
    } catch (e) {
      alert(t('errNetwork'))
    } finally {
      setCsLoading(false)
    }
  }

  // 儲存新增切片
  const handleSaveChunk = async () => {
    if (!newChunk.title.trim() || !newChunk.content.trim()) {
      alert(t('errTitleContent'))
      return
    }
    setSavingChunk(true)
    try {
      const res = await fetch('/api/repair/ai/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newChunk,
          tags: newChunk.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (res.ok && data.chunk) {
        setChunks(prev => [data.chunk, ...prev])
        setShowAddChunk(false)
        setNewChunk({
          equipment_model: '益芳-ET-99S',
          category: 'bar',
          chunk_type: 'maintenance_sop',
          title: '',
          content: '',
          safe_for_store: true,
          tech_only: false,
          tags: '',
        })
      } else {
        alert(data.error || t('errSave'))
      }
    } catch (e) {
      alert(t('errConnection'))
    } finally {
      setSavingChunk(false)
    }
  }

  // 儲存技師案例回饋
  const handleSaveFeedback = async () => {
    if (!newFeedback.actual_root_cause.trim() || !newFeedback.parts_replaced.trim()) {
      alert(t('errCauseParts'))
      return
    }
    setSavingFeedback(true)
    try {
      const res = await fetch('/api/repair/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFeedback),
      })
      const data = await res.json()
      if (res.ok && data.case) {
        setCases(prev => [data.case, ...prev])
        if (data.chunk) {
          setChunks(prev => [data.chunk, ...prev])
        }
        setShowFeedbackModal(false)
        setNewFeedback({
          order_id: '',
          equipment_model: '益芳-ET-99S',
          symptom: '',
          actual_root_cause: '',
          parts_replaced: '',
          measured_resistance_or_voltage: '',
          technician_note: '',
          verified_by: '機電工務組',
        })
      } else {
        alert(data.error || t('errSave'))
      }
    } catch (e) {
      alert(t('errConnection'))
    } finally {
      setSavingFeedback(false)
    }
  }

  const filteredChunks = chunks.filter(c => {
    if (selectedCategory !== 'all' && c.category !== selectedCategory) return false
    if (selectedType !== 'all' && c.chunk_type !== selectedType) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        c.title.toLowerCase().includes(q) ||
        c.equipment_model.toLowerCase().includes(q) ||
        c.content.toLowerCase().includes(q) ||
        c.tags.some(tag => tag.toLowerCase().includes(q))
      )
    }
    return true
  })

  const TYPE_LABELS: Record<KnowledgeChunkType, string> = {
    error_code: t('type.error_code'),
    circuit_diagram: t('type.circuit_diagram'),
    troubleshooting_tree: t('type.troubleshooting_tree'),
    maintenance_sop: t('type.maintenance_sop'),
    exploded_view: t('type.exploded_view'),
    real_case: t('type.real_case'),
  }

  return (
    <div className="space-y-5">
      {/* 頂部功能卡與操作按鈕 */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {t('title')}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowColdStart(true)}
            className="text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            {t('coldStartBtn')}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFeedbackModal(true)}
            className="text-xs gap-1.5 border-indigo-500/40 text-indigo-600 hover:bg-indigo-500/10"
          >
            <Zap className="h-3.5 w-3.5 text-indigo-600" />
            {t('logCaseBtn')}
          </Button>

          <Button
            size="sm"
            onClick={() => setShowAddChunk(true)}
            className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('addChunkBtn')}
          </Button>
        </div>
      </div>

      {/* 搜尋與過濾列 */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPh')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="h-8 text-xs rounded-md border bg-background px-2"
          >
            <option value="all">{t('allCategories')}</option>
            <option value="bar">{t('catBar')}</option>
            <option value="it_pos">{t('catPos')}</option>
            <option value="factory">{t('catFactory')}</option>
          </select>

          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="h-8 text-xs rounded-md border bg-background px-2"
          >
            <option value="all">{t('allTypes')}</option>
            <option value="error_code">{t('typeErrorCode')}</option>
            <option value="circuit_diagram">{t('typeCircuit')}</option>
            <option value="maintenance_sop">{t('typeSop')}</option>
            <option value="troubleshooting_tree">{t('type.troubleshooting_tree')}</option>
            <option value="real_case">{t('typeCases')}</option>
          </select>
        </div>
      </div>

      {/* 切片卡片列表 */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredChunks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-xs bg-muted/20 rounded-2xl border border-dashed">
          {t('noChunks')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredChunks.map(chunk => (
            <Card
              key={chunk.id}
              className="p-4 rounded-2xl border hover:border-primary/40 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[11px] font-bold">
                    {chunk.equipment_model}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      className={`text-[10px] ${
                        chunk.chunk_type === 'error_code'
                          ? 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                          : chunk.chunk_type === 'circuit_diagram'
                          ? 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20'
                          : chunk.chunk_type === 'real_case'
                          ? 'bg-violet-500/10 text-violet-700 border-violet-500/20'
                          : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                      }`}
                    >
                      {TYPE_LABELS[chunk.chunk_type] || chunk.chunk_type}
                    </Badge>
                    {chunk.safe_for_store ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                        {t('storeSafe')}
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                        {t('techOnly')}
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-bold text-foreground">{chunk.title}</h3>

                <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap leading-relaxed">
                  {chunk.content}
                </p>
              </div>

              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="truncate max-w-[180px]">{t('source')}{chunk.source_file || t('officialSpec')}</span>
                <div className="flex items-center gap-1">
                  {chunk.tags.slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="px-1.5 py-0.2 rounded bg-muted text-[10px]">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 技師實戰回饋案例專區 */}
      <div className="mt-8 pt-6 border-t space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold">{t('casesTitle')}</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {t('casesSubtitle')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cases.map(cs => (
            <div
              key={cs.id}
              className="p-3.5 rounded-xl border bg-indigo-500/5 border-indigo-500/20 text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between font-bold text-indigo-900 dark:text-indigo-200">
                <span>{cs.equipment_model}</span>
                <span className="text-[11px] text-muted-foreground">{cs.verified_by}</span>
              </div>
              <p className="text-muted-foreground">
                <strong>{t('reported')}</strong> {cs.symptom}
              </p>
              <p className="text-emerald-700 dark:text-emerald-300">
                <strong>{t('rootCause')}</strong> {cs.actual_root_cause}
              </p>
              <p className="text-foreground font-medium">
                <strong>{t('partsReplaced')}</strong> {cs.parts_replaced}
              </p>
              {cs.measured_resistance_or_voltage && (
                <div className="text-[11px] bg-background/80 p-1.5 rounded font-mono text-muted-foreground">
                  {t('measurements')}{cs.measured_resistance_or_voltage}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal 1: 冷啟動推導 Modal */}
      {showColdStart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-lg w-full p-5 border shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                {t('csTitle')}
              </h3>
              <button
                onClick={() => {
                  setShowColdStart(false)
                  setCsResult(null)
                }}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('csDesc')}
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold">{t('equipmentCategory')}</label>
                <select
                  value={csCategory}
                  onChange={e => setCsCategory(e.target.value as EquipmentCategory)}
                  className="w-full mt-1 h-8 rounded-md border bg-background px-2"
                >
                  <option value="bar">{t('catBarLong')}</option>
                  <option value="it_pos">{t('catPosLong')}</option>
                  <option value="factory">{t('catFactoryLong')}</option>
                </select>
              </div>

              <div>
                <label className="font-bold">{t('brand')}</label>
                <Input
                  placeholder={t('brandPh')}
                  value={csBrand}
                  onChange={e => setCsBrand(e.target.value)}
                  className="mt-1 text-xs h-8"
                />
              </div>

              <div>
                <label className="font-bold">{t('model')}</label>
                <Input
                  placeholder={t('modelPh')}
                  value={csModel}
                  onChange={e => setCsModel(e.target.value)}
                  className="mt-1 text-xs h-8"
                />
              </div>

              <Button
                size="sm"
                disabled={csLoading}
                onClick={handleRunColdStart}
                className="w-full gap-2 text-xs font-bold"
              >
                {csLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {t('runDerive')}
              </Button>
            </div>

            {csResult && (
              <div className="p-3.5 bg-muted/40 rounded-xl border space-y-2.5 text-xs">
                <div className="font-bold text-foreground flex items-center justify-between">
                  <span>
                    ✓ {t('derivedOk', { name: `${csResult.brand} ${csResult.model_name}` })}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {t('savedToKb')}
                  </Badge>
                </div>
                <div>
                  <strong>{t('derivedStates')}</strong>
                  <ol className="list-decimal list-inside text-muted-foreground space-y-0.5 mt-1">
                    {csResult.state_machine_steps?.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <strong>{t('derivedParts')}</strong>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {csResult.standard_parts?.map((p, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-background border text-[11px]"
                      >
                        {p.name} ({p.part_code})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 2: 新增切片 Modal */}
      {showAddChunk && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-lg w-full p-5 border shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                {t('addChunkTitle')}
              </h3>
              <button
                onClick={() => setShowAddChunk(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold">{t('targetModel')}</label>
                  <Input
                    placeholder={t('targetModelPh')}
                    value={newChunk.equipment_model}
                    onChange={e => setNewChunk({ ...newChunk, equipment_model: e.target.value })}
                    className="mt-1 text-xs h-8"
                  />
                </div>
                <div>
                  <label className="font-bold">{t('chunkType')}</label>
                  <select
                    value={newChunk.chunk_type}
                    onChange={e =>
                      setNewChunk({ ...newChunk, chunk_type: e.target.value as KnowledgeChunkType })
                    }
                    className="w-full mt-1 h-8 rounded-md border bg-background px-2"
                  >
                    <option value="error_code">{t('typeErrorCode')}</option>
                    <option value="circuit_diagram">{t('typeCircuit')}</option>
                    <option value="maintenance_sop">{t('type.maintenance_sop')}</option>
                    <option value="troubleshooting_tree">{t('type.troubleshooting_tree')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold">{t('chunkTitle')}</label>
                <Input
                  placeholder={t('chunkTitlePh')}
                  value={newChunk.title}
                  onChange={e => setNewChunk({ ...newChunk, title: e.target.value })}
                  className="mt-1 text-xs h-8"
                />
              </div>

              <div>
                <label className="font-bold">{t('chunkContent')}</label>
                <textarea
                  rows={6}
                  placeholder={t('chunkContentPh')}
                  value={newChunk.content}
                  onChange={e => setNewChunk({ ...newChunk, content: e.target.value })}
                  className="w-full mt-1 p-2 rounded-md border bg-background text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newChunk.safe_for_store}
                    onChange={e => setNewChunk({ ...newChunk, safe_for_store: e.target.checked })}
                    className="rounded"
                  />
                  <span>{t('storeSafeLong')}</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newChunk.tech_only}
                    onChange={e => setNewChunk({ ...newChunk, tech_only: e.target.checked })}
                    className="rounded"
                  />
                  <span>{t('techOnlyLong')}</span>
                </label>
              </div>

              <div>
                <label className="font-bold">{t('tags')}</label>
                <Input
                  placeholder={t('tagsPh')}
                  value={newChunk.tags}
                  onChange={e => setNewChunk({ ...newChunk, tags: e.target.value })}
                  className="mt-1 text-xs h-8"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddChunk(false)}
                  className="text-xs"
                >
                  {t('cancel')}
                </Button>
                <Button
                  size="sm"
                  disabled={savingChunk}
                  onClick={handleSaveChunk}
                  className="text-xs font-bold"
                >
                  {savingChunk && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  {t('saveChunk')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: 登記技師修復案例回饋 Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-lg w-full p-5 border shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Zap className="h-4 w-4 text-indigo-600" />
                {t('caseTitle')}
              </h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('caseDesc')}
            </p>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold">{t('equipmentModel')}</label>
                  <Input
                    value={newFeedback.equipment_model}
                    onChange={e =>
                      setNewFeedback({ ...newFeedback, equipment_model: e.target.value })
                    }
                    className="mt-1 text-xs h-8"
                  />
                </div>
                <div>
                  <label className="font-bold">{t('orderNo')}</label>
                  <Input
                    placeholder={t('orderNoPh')}
                    value={newFeedback.order_id}
                    onChange={e => setNewFeedback({ ...newFeedback, order_id: e.target.value })}
                    className="mt-1 text-xs h-8"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold">{t('symptom')}</label>
                <Input
                  placeholder={t('symptomPh')}
                  value={newFeedback.symptom}
                  onChange={e => setNewFeedback({ ...newFeedback, symptom: e.target.value })}
                  className="mt-1 text-xs h-8"
                />
              </div>

              <div>
                <label className="font-bold">{t('rootCauseReq')}</label>
                <textarea
                  rows={2}
                  placeholder={t('rootCausePh')}
                  value={newFeedback.actual_root_cause}
                  onChange={e =>
                    setNewFeedback({ ...newFeedback, actual_root_cause: e.target.value })
                  }
                  className="w-full mt-1 p-2 rounded-md border bg-background text-xs"
                />
              </div>

              <div>
                <label className="font-bold">{t('partsReq')}</label>
                <Input
                  placeholder={t('partsPh')}
                  value={newFeedback.parts_replaced}
                  onChange={e =>
                    setNewFeedback({ ...newFeedback, parts_replaced: e.target.value })
                  }
                  className="mt-1 text-xs h-8"
                />
              </div>

              <div>
                <label className="font-bold">{t('measured')}</label>
                <Input
                  placeholder={t('measuredPh')}
                  value={newFeedback.measured_resistance_or_voltage}
                  onChange={e =>
                    setNewFeedback({
                      ...newFeedback,
                      measured_resistance_or_voltage: e.target.value,
                    })
                  }
                  className="mt-1 text-xs h-8"
                />
              </div>

              <div>
                <label className="font-bold">{t('techNote')}</label>
                <Input
                  placeholder={t('techNotePh')}
                  value={newFeedback.technician_note}
                  onChange={e =>
                    setNewFeedback({ ...newFeedback, technician_note: e.target.value })
                  }
                  className="mt-1 text-xs h-8"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFeedbackModal(false)}
                  className="text-xs"
                >
                  {t('cancel')}
                </Button>
                <Button
                  size="sm"
                  disabled={savingFeedback}
                  onClick={handleSaveFeedback}
                  className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {savingFeedback && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  {t('fileCase')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
