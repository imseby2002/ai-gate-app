'use client'

import { useState, useEffect } from 'react'
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
      alert('請輸入設備品牌與型號')
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
        alert(data.error || '推導失敗')
      }
    } catch (e) {
      alert('連線失敗')
    } finally {
      setCsLoading(false)
    }
  }

  // 儲存新增切片
  const handleSaveChunk = async () => {
    if (!newChunk.title.trim() || !newChunk.content.trim()) {
      alert('標題與內容為必填')
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
        alert(data.error || '儲存失敗')
      }
    } catch (e) {
      alert('連線異常')
    } finally {
      setSavingChunk(false)
    }
  }

  // 儲存技師案例回饋
  const handleSaveFeedback = async () => {
    if (!newFeedback.actual_root_cause.trim() || !newFeedback.parts_replaced.trim()) {
      alert('故障真實原因與更換零件為必填')
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
        alert(data.error || '儲存失敗')
      }
    } catch (e) {
      alert('連線異常')
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
        c.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  const TYPE_LABELS: Record<KnowledgeChunkType, string> = {
    error_code: '故障代碼表',
    circuit_diagram: '電路接線圖',
    troubleshooting_tree: '故障排查樹',
    maintenance_sop: '保養清潔 SOP',
    exploded_view: '零件爆炸圖',
    real_case: '技師實戰回饋',
  }

  return (
    <div className="space-y-5">
      {/* 頂部功能卡與操作按鈕 */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            設備手冊與 RAG 知識庫
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            原廠說明書、線路圖、代碼表結構化切片・冷啟動狀態機自動推導・技師修復閉環學習
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
            冷啟動狀態機推導
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFeedbackModal(true)}
            className="text-xs gap-1.5 border-indigo-500/40 text-indigo-600 hover:bg-indigo-500/10"
          >
            <Zap className="h-3.5 w-3.5 text-indigo-600" />
            登記技師完修案例
          </Button>

          <Button
            size="sm"
            onClick={() => setShowAddChunk(true)}
            className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            上傳/新增手冊切片
          </Button>
        </div>
      </div>

      {/* 搜尋與過濾列 */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋機型、故障碼 (E01)、零件料號..."
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
            <option value="all">所有類別 (吧檯/工廠/IT)</option>
            <option value="bar">🧋 門市吧檯設備</option>
            <option value="it_pos">💻 POS 與資訊軟硬體</option>
            <option value="factory">🏭 中央工廠設備</option>
          </select>

          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="h-8 text-xs rounded-md border bg-background px-2"
          >
            <option value="all">所有資料類型</option>
            <option value="error_code">故障代碼表 (Error Code)</option>
            <option value="circuit_diagram">電路接線圖 (Circuit)</option>
            <option value="maintenance_sop">清潔保養 SOP</option>
            <option value="troubleshooting_tree">故障排查樹</option>
            <option value="real_case">技師實戰回饋案例</option>
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
          查無符合條件之知識切片
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
                        門市可用
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                        技師專屬
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
                <span className="truncate max-w-[180px]">來源：{chunk.source_file || '官方技術規範'}</span>
                <div className="flex items-center gap-1">
                  {chunk.tags.slice(0, 3).map((t, idx) => (
                    <span key={idx} className="px-1.5 py-0.2 rounded bg-muted text-[10px]">
                      #{t}
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
            <h3 className="text-sm font-bold">技師實戰修復經驗閉環庫 (Case-Based Learning)</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            經由實際到府維修回填，持續反哺 AI 判斷精確度
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
                <strong>回報異常：</strong> {cs.symptom}
              </p>
              <p className="text-emerald-700 dark:text-emerald-300">
                <strong>真實成因：</strong> {cs.actual_root_cause}
              </p>
              <p className="text-foreground font-medium">
                <strong>更換零件：</strong> {cs.parts_replaced}
              </p>
              {cs.measured_resistance_or_voltage && (
                <div className="text-[11px] bg-background/80 p-1.5 rounded font-mono text-muted-foreground">
                  ⚡ 量測紀錄：{cs.measured_resistance_or_voltage}
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
                設備冷啟動狀態機推導引擎
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
              當引進全新品牌型號且尚未建立 PDF 手冊時，輸入品牌與型號，AI 將依據水吧機電公理推導標準狀態機、極限開關與 10 大常見故障樹。
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold">設備類別</label>
                <select
                  value={csCategory}
                  onChange={e => setCsCategory(e.target.value as EquipmentCategory)}
                  className="w-full mt-1 h-8 rounded-md border bg-background px-2"
                >
                  <option value="bar">🧋 門市吧檯設備 (封口機/果糖機/萃茶機/製冰機)</option>
                  <option value="it_pos">💻 POS 與資訊軟硬體 (觸控機/出單機/標籤機/交換機)</option>
                  <option value="factory">🏭 中央工廠設備 (炒糖機/煮茶鍋/循環泵)</option>
                </select>
              </div>

              <div>
                <label className="font-bold">品牌廠商</label>
                <Input
                  placeholder="如：益芳、宏茂、Hoshizaki、Epson、台達"
                  value={csBrand}
                  onChange={e => setCsBrand(e.target.value)}
                  className="mt-1 text-xs h-8"
                />
              </div>

              <div>
                <label className="font-bold">設備型號</label>
                <Input
                  placeholder="如：ET-99S、FT-16、TM-T82、KM-150A"
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
                自動推導機電狀態機與故障樹
              </Button>
            </div>

            {csResult && (
              <div className="p-3.5 bg-muted/40 rounded-xl border space-y-2.5 text-xs">
                <div className="font-bold text-foreground flex items-center justify-between">
                  <span>
                    ✓ 已成功推導：{csResult.brand} {csResult.model_name}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    已收錄至知識庫
                  </Badge>
                </div>
                <div>
                  <strong>推導機電狀態機：</strong>
                  <ol className="list-decimal list-inside text-muted-foreground space-y-0.5 mt-1">
                    {csResult.state_machine_steps?.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <strong>推導標準備品料號：</strong>
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
                新增/收錄設備手冊知識切片
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
                  <label className="font-bold">目標設備機型</label>
                  <Input
                    placeholder="如：益芳-ET-99S"
                    value={newChunk.equipment_model}
                    onChange={e => setNewChunk({ ...newChunk, equipment_model: e.target.value })}
                    className="mt-1 text-xs h-8"
                  />
                </div>
                <div>
                  <label className="font-bold">切片類型</label>
                  <select
                    value={newChunk.chunk_type}
                    onChange={e =>
                      setNewChunk({ ...newChunk, chunk_type: e.target.value as KnowledgeChunkType })
                    }
                    className="w-full mt-1 h-8 rounded-md border bg-background px-2"
                  >
                    <option value="error_code">故障代碼表 (Error Code)</option>
                    <option value="circuit_diagram">電路接線圖 (Circuit)</option>
                    <option value="maintenance_sop">保養清潔 SOP</option>
                    <option value="troubleshooting_tree">故障排查樹</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold">切片標題</label>
                <Input
                  placeholder="如：益芳封口機切刀磨損判斷與更換工序"
                  value={newChunk.title}
                  onChange={e => setNewChunk({ ...newChunk, title: e.target.value })}
                  className="mt-1 text-xs h-8"
                />
              </div>

              <div>
                <label className="font-bold">切片正文內容 (支援 SOP、電阻值、步驟)</label>
                <textarea
                  rows={6}
                  placeholder="請詳述排查步驟、正常標準值與異常處置方式..."
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
                  <span>門市人員可執行 (免拆機安全)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newChunk.tech_only}
                    onChange={e => setNewChunk({ ...newChunk, tech_only: e.target.checked })}
                    className="rounded"
                  />
                  <span>技師專用 (需拆機量測)</span>
                </label>
              </div>

              <div>
                <label className="font-bold">標籤 (逗號分隔)</label>
                <Input
                  placeholder="如：切刀, 耗損, 刀片更換"
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
                  取消
                </Button>
                <Button
                  size="sm"
                  disabled={savingChunk}
                  onClick={handleSaveChunk}
                  className="text-xs font-bold"
                >
                  {savingChunk && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  儲存切片
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
                登記技師完修實戰經驗 (閉環反哺)
              </h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              將到府修復的真實故障原因與實測數值寫入系統，AI
              將自動學習並在下一次類似故障中優先推薦該處置方案。
            </p>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold">設備機型</label>
                  <Input
                    value={newFeedback.equipment_model}
                    onChange={e =>
                      setNewFeedback({ ...newFeedback, equipment_model: e.target.value })
                    }
                    className="mt-1 text-xs h-8"
                  />
                </div>
                <div>
                  <label className="font-bold">工單編號 (可選)</label>
                  <Input
                    placeholder="如 RO-202609-008"
                    value={newFeedback.order_id}
                    onChange={e => setNewFeedback({ ...newFeedback, order_id: e.target.value })}
                    className="mt-1 text-xs h-8"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold">現場回報現象</label>
                <Input
                  placeholder="如：E01 溫度不上升、膠膜捲不動"
                  value={newFeedback.symptom}
                  onChange={e => setNewFeedback({ ...newFeedback, symptom: e.target.value })}
                  className="mt-1 text-xs h-8"
                />
              </div>

              <div>
                <label className="font-bold">拆機排查之真實根因 (Root Cause) *</label>
                <textarea
                  rows={2}
                  placeholder="如：主板固態繼電器 (SSR) 輸出端擊穿斷路，無法供電給加熱棒"
                  value={newFeedback.actual_root_cause}
                  onChange={e =>
                    setNewFeedback({ ...newFeedback, actual_root_cause: e.target.value })
                  }
                  className="w-full mt-1 p-2 rounded-md border bg-background text-xs"
                />
              </div>

              <div>
                <label className="font-bold">實際更換料件與料號 *</label>
                <Input
                  placeholder="如：更換 25A 固態繼電器 (SSR-25DA)"
                  value={newFeedback.parts_replaced}
                  onChange={e =>
                    setNewFeedback({ ...newFeedback, parts_replaced: e.target.value })
                  }
                  className="mt-1 text-xs h-8"
                />
              </div>

              <div>
                <label className="font-bold">實測電阻值或電壓紀錄</label>
                <Input
                  placeholder="如：加熱棒量得 530Ω 正常，SSR 輸入端 12V 正常但無輸出"
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
                <label className="font-bold">技師心得與預防建議</label>
                <Input
                  placeholder="如：建議門市避免於潮濕處放置，每半年緊固端子螺絲"
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
                  取消
                </Button>
                <Button
                  size="sm"
                  disabled={savingFeedback}
                  onClick={handleSaveFeedback}
                  className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {savingFeedback && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  歸檔學習庫
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
