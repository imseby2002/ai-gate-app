'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  FlaskConical, Layers, Scale, DollarSign, ShieldCheck, Sparkles,
  BookOpen, Plus, Trash2, Search, CheckCircle2, AlertTriangle,
  Loader2, Star, Compass, FileText,
  Video, Globe, Check, Copy, Send, Coffee, Bot, TrendingUp, Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { calculateRecipe, type RecipeIngredientInput } from '@/lib/rd/formula-engine'
import { checkLegalCompliance } from '@/lib/rd/legal-engine'

const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('zh-TW')

export default function RdLabPage() {
  const [tab, setTab] = useState<'recipes' | 'ingredients' | 'calculator' | 'experiments' | 'competitors' | 'knowledge' | 'agents'>('recipes')
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  const [ingredients, setIngredients] = useState<any[]>([])
  const [recipes, setRecipes] = useState<any[]>([])
  const [experiments, setExperiments] = useState<any[]>([])
  const [sensoryList, setSensoryList] = useState<any[]>([])
  const [additives, setAdditives] = useState<any[]>([])
  const [competitors, setCompetitors] = useState<any[]>([])
  const [knowledge, setKnowledge] = useState<any[]>([])
  const [experts, setExperts] = useState<any[]>([])

  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [recipeSearch, setRecipeSearch] = useState('')

  const [ingSearch, setIngSearch] = useState('')
  const [ingCategoryFilter, setIngCategoryFilter] = useState('all')

  const [calcItems, setCalcItems] = useState<RecipeIngredientInput[]>([
    { name: '特選烏龍茶湯', category: 'tea', qty_g: 180, cost_per_kg: 24000, brix: 0.2 },
    { name: '優質鮮奶', category: 'milk', qty_g: 120, cost_per_kg: 36000, brix: 4.8 },
    { name: '經典純糖漿', category: 'syrup', qty_g: 30, cost_per_kg: 18000, brix: 72 },
    { name: '純水', category: 'water', qty_g: 120, cost_per_kg: 500, brix: 0 },
    { name: '純冰塊', category: 'ice', qty_g: 50, cost_per_kg: 200, brix: 0 },
  ])
  const [calcPackaging, setCalcPackaging] = useState(1500)
  const [calcTargetPrice, setCalcTargetPrice] = useState(45000)

  const [extUrl, setExtUrl] = useState('')
  const [extTitle, setExtTitle] = useState('')
  const [extType, setExtType] = useState('youtube')
  const [extText, setExtText] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const [extNotice, setExtNotice] = useState('')

  const [agentType, setAgentType] = useState<'knowledge' | 'recipe' | 'cost' | 'regulatory' | 'experiment' | 'innovation'>('innovation')
  const [agentPrompt, setAgentPrompt] = useState('')
  const [agentReply, setAgentReply] = useState('')
  const [agentRunning, setAgentRunning] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/rd/lab')
      if (res.status === 403) {
        setForbidden(true)
        return
      }
      const data = await res.json()
      setIngredients(data.ingredients || [])
      setRecipes(data.recipes || [])
      setExperiments(data.experiments || [])
      setSensoryList(data.sensoryEvaluations || [])
      setAdditives(data.additives || [])
      setCompetitors(data.competitors || [])
      setKnowledge(data.externalKnowledge || [])
      setExperts(data.experts || [])

      if (data.recipes?.length > 0 && !selectedRecipeId) {
        setSelectedRecipeId(data.recipes[0].id)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedRecipeId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const activeCalculation = useMemo(() => {
    return calculateRecipe(calcItems, {
      packagingCostVnd: calcPackaging,
      targetPriceVnd: calcTargetPrice,
    })
  }, [calcItems, calcPackaging, calcTargetPrice])

  const activeLegal = useMemo(() => {
    return checkLegalCompliance(activeCalculation.sugar_per_100ml)
  }, [activeCalculation.sugar_per_100ml])

  const selectedRecipe = useMemo(() => {
    return recipes.find(r => r.id === selectedRecipeId) || recipes[0] || null
  }, [recipes, selectedRecipeId])

  async function handleIngestKnowledge(e: React.FormEvent) {
    e.preventDefault()
    if (!extUrl && !extTitle && !extText) return
    setIngesting(true)
    setExtNotice('')
    try {
      const res = await fetch('/api/rd/lab/external-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_url: extUrl,
          source_type: extType,
          title: extTitle,
          raw_content: extText,
        })
      })
      if (res.ok) {
        setExtUrl('')
        setExtTitle('')
        setExtText('')
        setExtNotice('外部研發知識已成功萃取並歸入研發庫！')
        loadData()
      } else {
        alert('匯入失敗')
      }
    } finally {
      setIngesting(false)
    }
  }

  async function handleCallAgent() {
    if (!agentPrompt.trim()) return
    setAgentRunning(true)
    setAgentReply('')
    try {
      const res = await fetch('/api/rd/lab/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: agentType,
          prompt: agentPrompt,
          context: {
            currentCalculation: activeCalculation,
            currentRecipe: selectedRecipe,
          }
        })
      })
      const data = await res.json()
      if (res.ok) {
        setAgentReply(data.reply)
      } else {
        setAgentReply(`錯誤：${data.error || '請確認 API 金鑰'}`)
      }
    } finally {
      setAgentRunning(false)
    }
  }

  if (forbidden) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center space-y-2">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500" />
          <p className="font-semibold text-lg">需具備研發單位權限才能使用 Feeling Tea AI R&D Lab</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 頂部 Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-purple-100">
            <FlaskConical className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Feeling Tea AI R&D Lab</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold border border-purple-200">
                研發數位大腦
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              結構化配方計算 + 原料庫 + 感官評估 + 成本模型 + 越南糖稅法規 + 實驗管理 + 6 Agent 跨界創新
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/rd">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              配方
            </Button>
          </Link>
          <Link href="/rd-logs">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" />
              研發日誌
            </Button>
          </Link>
          <Link href="/rd-ai">
            <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs">
              <Bot className="h-3.5 w-3.5" />
              研發討論AI
            </Button>
          </Link>
        </div>
      </div>

      {/* 核心導覽分頁 Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-gray-200 text-xs sm:text-sm font-medium">
        <button
          onClick={() => setTab('recipes')}
          className={`px-3.5 py-2 rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            tab === 'recipes'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50 font-bold'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Layers className="h-4 w-4" />
          結構化配方與版本 ({recipes.length})
        </button>

        <button
          onClick={() => setTab('ingredients')}
          className={`px-3.5 py-2 rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            tab === 'ingredients'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50 font-bold'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Coffee className="h-4 w-4" />
          原料庫與供應商矩陣 ({ingredients.length})
        </button>

        <button
          onClick={() => setTab('calculator')}
          className={`px-3.5 py-2 rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            tab === 'calculator'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50 font-bold'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Scale className="h-4 w-4" />
          配方計算器與糖稅檢查
        </button>

        <button
          onClick={() => setTab('experiments')}
          className={`px-3.5 py-2 rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            tab === 'experiments'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50 font-bold'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Compass className="h-4 w-4" />
          實驗管理與 9 軸感官 ({experiments.length})
        </button>

        <button
          onClick={() => setTab('competitors')}
          className={`px-3.5 py-2 rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            tab === 'competitors'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50 font-bold'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          競品庫與食品添加物 ({competitors.length + additives.length})
        </button>

        <button
          onClick={() => setTab('knowledge')}
          className={`px-3.5 py-2 rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            tab === 'knowledge'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50 font-bold'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Video className="h-4 w-4" />
          外部研發知識庫 ({knowledge.length})
        </button>

        <button
          onClick={() => setTab('agents')}
          className={`px-3.5 py-2 rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            tab === 'agents'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50 font-bold'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          研發 6 大 Agent 創意實驗室
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : (
        <>
          {/* TAB 1: 結構化配方與版本 */}
          {tab === 'recipes' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-gray-800">配方產品列表</h3>
                  <span className="text-xs text-gray-500">共 {recipes.length} 款產品</span>
                </div>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜尋產品名稱..."
                    value={recipeSearch}
                    onChange={e => setRecipeSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-xs"
                  />
                </div>

                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {recipes.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400 border border-dashed rounded-xl">
                      尚未建立結構化配方。可至配方計算器試算並儲存。
                    </div>
                  ) : (
                    recipes
                      .filter(r => !recipeSearch || r.name.toLowerCase().includes(recipeSearch.toLowerCase()))
                      .map(r => (
                        <div
                          key={r.id}
                          onClick={() => setSelectedRecipeId(r.id)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            selectedRecipe?.id === r.id
                              ? 'border-purple-500 bg-purple-50/50 shadow-sm'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-gray-900">{r.name}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-semibold">
                                {r.version || 'V1'}
                              </span>
                              {r.is_current_active && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 font-semibold flex items-center gap-0.5">
                                  <Check className="h-2.5 w-2.5" /> 門市現行
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                            <span>{r.cup_size_ml} ml</span>
                            <span>每杯成本 NT$ {fmt(r.cogs_amount)}</span>
                            <span>毛利 {r.gross_margin_pct}%</span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                {selectedRecipe ? (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold text-gray-900">{selectedRecipe.name}</h2>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">
                            {selectedRecipe.version || 'V1'}
                          </span>
                          {selectedRecipe.is_current_active && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                              目前全門市正式使用版本 (Production)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          標準容量：{selectedRecipe.cup_size_ml} ml | 分類：{selectedRecipe.category}
                        </p>
                      </div>

                      <div>
                        {selectedRecipe.sugar_per_100ml > 5.0 ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            含糖量 {selectedRecipe.sugar_per_100ml}g/100ml（落入越南糖稅 10% 範圍）
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            含糖量 {selectedRecipe.sugar_per_100ml}g/100ml（免課徵糖稅）
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-xs text-gray-500">成品總重</span>
                        <div className="text-lg font-bold text-gray-900 mt-0.5">{selectedRecipe.total_weight_g || 500} g</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-xs text-gray-500">加權糖度 (°Brix)</span>
                        <div className="text-lg font-bold text-gray-900 mt-0.5">{selectedRecipe.estimated_brix || 6.5} °Bx</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-xs text-gray-500">每杯 COGS 成本</span>
                        <div className="text-lg font-bold text-indigo-700 mt-0.5">{fmt(selectedRecipe.cogs_amount)} VND</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-xs text-gray-500">毛利率</span>
                        <div className="text-lg font-bold text-emerald-600 mt-0.5">{selectedRecipe.gross_margin_pct || 68.5}%</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        結構化成分配比清單 (Structured Formulation)
                      </h4>
                      <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                            <tr>
                              <th className="p-2.5">原料成分</th>
                              <th className="p-2.5">分類</th>
                              <th className="p-2.5 text-right">用量 (g)</th>
                              <th className="p-2.5 text-right">比例 (%)</th>
                              <th className="p-2.5 text-right">原料糖度</th>
                              <th className="p-2.5 text-right">成本 (VND)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(selectedRecipe.rd_recipe_ingredients || []).length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-4 text-center text-gray-400">
                                  暫無原料明細，可在「配方計算器」中組配。
                                </td>
                              </tr>
                            ) : (
                              selectedRecipe.rd_recipe_ingredients.map((it: any) => (
                                <tr key={it.id} className="hover:bg-gray-50/50">
                                  <td className="p-2.5 font-medium text-gray-900">{it.name}</td>
                                  <td className="p-2.5 text-gray-500">{it.category}</td>
                                  <td className="p-2.5 text-right font-bold text-gray-800">{it.qty_g} g</td>
                                  <td className="p-2.5 text-right text-gray-600">{it.ratio_pct}%</td>
                                  <td className="p-2.5 text-right text-gray-600">{it.brix}°Bx</td>
                                  <td className="p-2.5 text-right text-indigo-600 font-medium">{fmt(it.cost_amount)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-16 text-center text-sm text-gray-400 border border-dashed rounded-2xl">
                    請從左側選取一款配方查看結構詳情
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: 原料庫與供應商矩陣 */}
          {tab === 'ingredients' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-64">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜尋原料名稱、供應商或編號..."
                    value={ingSearch}
                    onChange={e => setIngSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-xs"
                  />
                </div>
                <select
                  value={ingCategoryFilter}
                  onChange={e => setIngCategoryFilter(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs text-gray-700"
                >
                  <option value="all">全部分類</option>
                  <option value="tea">茶葉 / 茶湯 (Tea)</option>
                  <option value="dairy">乳品 / 奶粉 (Dairy)</option>
                  <option value="syrup">糖漿 / 砂糖 (Syrup)</option>
                  <option value="juice">果汁 / 果醬 (Juice)</option>
                  <option value="topping">配料 (Topping)</option>
                  <option value="additive">添加物 (Additive)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ingredients.length === 0 ? (
                  <div className="col-span-3 p-12 text-center text-xs text-gray-400 border border-dashed rounded-2xl">
                    尚未建立原料資料卡。
                  </div>
                ) : (
                  ingredients
                    .filter(i => {
                      if (ingCategoryFilter !== 'all' && i.category !== ingCategoryFilter) return false
                      if (ingSearch && !i.name.toLowerCase().includes(ingSearch.toLowerCase()) && !i.code.toLowerCase().includes(ingSearch.toLowerCase())) return false
                      return true
                    })
                    .map(ing => (
                      <div
                        key={ing.id}
                        className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3 shadow-sm hover:border-purple-300 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-mono text-gray-400">{ing.code || 'ING-000'}</span>
                            <h3 className="font-bold text-base text-gray-900">{ing.name}</h3>
                            <span className="text-xs text-purple-600 font-medium">{ing.supplier_name || '原物料供應商'}</span>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                            {ing.category}
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-center text-[11px] bg-gray-50 p-2.5 rounded-xl">
                          <div>
                            <span className="text-gray-400">Brix</span>
                            <div className="font-bold text-gray-800">{ing.brix || 0}°</div>
                          </div>
                          <div>
                            <span className="text-gray-400">pH</span>
                            <div className="font-bold text-gray-800">{ing.ph || 7.0}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">成本</span>
                            <div className="font-bold text-indigo-600">{fmt(ing.cost_per_kg)}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">保存</span>
                            <div className="font-bold text-gray-800">{ing.shelf_life_days}天</div>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="text-[11px] font-semibold text-gray-500 mb-1">感官風味評分 (1-10)：</div>
                          <div className="flex items-center justify-between text-[11px] text-gray-600">
                            <span>香氣: <b>{ing.aroma || 5}</b></span>
                            <span>茶感: <b>{ing.body || 5}</b></span>
                            <span>回甘: <b>{ing.aftertaste || 5}</b></span>
                            <span>澀度: <b>{ing.astringency || 5}</b></span>
                            <span>苦味: <b>{ing.bitterness || 5}</b></span>
                          </div>
                        </div>

                        {ing.sensory_notes && (
                          <p className="text-xs text-gray-500 line-clamp-2 bg-purple-50/40 p-2 rounded-lg">
                            {ing.sensory_notes}
                          </p>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: 配方計算器與法規糖稅 */}
          {tab === 'calculator' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-gray-900">配方成分即時微調器</h3>
                      <p className="text-xs text-gray-500">純數學演算法確定性計算，即時反應 Brix、糖克數與成本</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCalcItems([...calcItems, { name: '新成分', category: 'topping', qty_g: 30, cost_per_kg: 20000, brix: 10 }])}
                      className="gap-1 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      加入成分
                    </Button>
                  </div>

                  <div className="space-y-2.5">
                    {calcItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 bg-gray-50/60 text-xs">
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => {
                            const next = [...calcItems]
                            next[idx].name = e.target.value
                            setCalcItems(next)
                          }}
                          className="w-36 h-8 px-2 rounded-md border border-gray-200 bg-white font-medium"
                          placeholder="成分名稱"
                        />
                        <select
                          value={item.category}
                          onChange={e => {
                            const next = [...calcItems]
                            next[idx].category = e.target.value as any
                            setCalcItems(next)
                          }}
                          className="h-8 px-2 rounded-md border border-gray-200 bg-white"
                        >
                          <option value="tea">茶湯 (Tea)</option>
                          <option value="milk">乳品 (Milk)</option>
                          <option value="syrup">糖漿 (Syrup)</option>
                          <option value="water">水 (Water)</option>
                          <option value="ice">冰塊 (Ice)</option>
                          <option value="foam">奶蓋 (Foam)</option>
                          <option value="juice">果汁 (Juice)</option>
                          <option value="topping">配料 (Topping)</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={item.qty_g}
                            onChange={e => {
                              const next = [...calcItems]
                              next[idx].qty_g = Number(e.target.value)
                              setCalcItems(next)
                            }}
                            className="w-16 h-8 px-2 rounded-md border border-gray-200 bg-white text-right font-bold"
                          />
                          <span className="text-gray-400">g</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">糖度</span>
                          <input
                            type="number"
                            value={item.brix ?? 0}
                            onChange={e => {
                              const next = [...calcItems]
                              next[idx].brix = Number(e.target.value)
                              setCalcItems(next)
                            }}
                            className="w-14 h-8 px-2 rounded-md border border-gray-200 bg-white text-right"
                          />
                          <span className="text-gray-400">°</span>
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                          <span className="text-gray-400">成本/kg</span>
                          <input
                            type="number"
                            value={item.cost_per_kg ?? 0}
                            onChange={e => {
                              const next = [...calcItems]
                              next[idx].cost_per_kg = Number(e.target.value)
                              setCalcItems(next)
                            }}
                            className="w-20 h-8 px-2 rounded-md border border-gray-200 bg-white text-right text-indigo-700 font-medium"
                          />
                        </div>
                        <button
                          onClick={() => setCalcItems(calcItems.filter((_, i) => i !== idx))}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-4 text-xs border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">每杯包材成本 (杯+膜+吸管+袋)：</span>
                      <input
                        type="number"
                        value={calcPackaging}
                        onChange={e => setCalcPackaging(Number(e.target.value))}
                        className="w-20 h-7 px-2 rounded border border-gray-200 text-right"
                      />
                      <span>VND</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">門市建議售價：</span>
                      <input
                        type="number"
                        value={calcTargetPrice}
                        onChange={e => setCalcTargetPrice(Number(e.target.value))}
                        className="w-24 h-7 px-2 rounded border border-gray-200 text-right font-bold text-gray-900"
                      />
                      <span>VND</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className={`p-5 rounded-2xl border ${
                  activeLegal.sugar_tax_applies
                    ? 'bg-red-50/70 border-red-200 text-red-950'
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {activeLegal.sugar_tax_applies ? (
                      <>
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        越南特別消費稅（糖稅）警示
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        越南特別消費稅：免稅合規
                      </>
                    )}
                  </div>

                  <div className="mt-2 text-2xl font-bold">
                    {activeCalculation.sugar_per_100ml} <span className="text-sm font-normal">g / 100ml</span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed">
                    {activeLegal.warning_message}
                  </p>

                  <div className="mt-3 pt-3 border-t border-black/10 text-[11px] space-y-1 text-gray-600">
                    <div><b>法規依據：</b>{activeLegal.tax_statute}</div>
                    <div><b>法條引用：</b>{activeLegal.citation}</div>
                    <div className="mt-2 p-2 bg-white/80 rounded-lg text-gray-800">
                      <b>💡 研發減糖優化指引：</b>{activeLegal.reformulation_suggestion}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                  <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-indigo-600" />
                    成本與毛利模型精算
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500">成品總重 / 體積</span>
                      <span className="font-bold">{activeCalculation.total_weight_g} g / {activeCalculation.total_volume_ml} ml</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500">加權糖度 (°Brix)</span>
                      <span className="font-bold">{activeCalculation.estimated_brix} °Bx</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500">原料成本</span>
                      <span>{fmt(activeCalculation.ingredient_cogs)} VND</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500">包材成本</span>
                      <span>{fmt(activeCalculation.packaging_cogs)} VND</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-50 text-indigo-700 font-bold">
                      <span>每杯 COGS 總成本</span>
                      <span>{fmt(activeCalculation.total_cogs)} VND</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-50 text-emerald-600 font-bold text-sm">
                      <span>毛利率 (Gross Margin)</span>
                      <span>{activeCalculation.gross_margin_pct}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 實驗管理與 9 軸感官 */}
          {tab === 'experiments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-gray-900">研發實驗紀錄 (Experiment Protocols)</h3>
                  <p className="text-xs text-gray-500">對照組 vs A/B/C 變因試驗、9 大維度感官品評雷達與評審回饋</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {experiments.length === 0 ? (
                  <div className="col-span-2 p-12 text-center text-xs text-gray-400 border border-dashed rounded-2xl">
                    尚未有實驗紀錄。可在「6 大 Agent」中點選「Idea-to-Experiment」直接產出標準實驗協議。
                  </div>
                ) : (
                  experiments.map(exp => (
                    <div key={exp.id} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-purple-600 font-bold">{exp.code}</span>
                        <div className="flex items-center text-amber-500">
                          {Array.from({ length: Math.round(exp.rating || 5) }).map((_, i) => (
                            <Star key={i} className="h-3.5 w-3.5 fill-current" />
                          ))}
                        </div>
                      </div>

                      <h4 className="font-bold text-base text-gray-900">{exp.product_name}</h4>
                      <p className="text-xs text-gray-600"><b>實驗目的：</b>{exp.objective}</p>

                      <div className="p-3 bg-gray-50 rounded-xl space-y-1 text-xs">
                        <div className="font-semibold text-gray-500 text-[11px]">9 軸感官評分 (1-10)：</div>
                        <div className="grid grid-cols-3 gap-1.5 text-[11px] text-gray-700">
                          <span>甜度: <b>7.0</b></span>
                          <span>茶香: <b>8.5</b></span>
                          <span>茶感: <b>8.0</b></span>
                          <span>奶感: <b>6.5</b></span>
                          <span>澀度: <b>4.0</b></span>
                          <span>苦味: <b>3.0</b></span>
                          <span>回甘: <b>8.5</b></span>
                          <span>口感: <b>8.0</b></span>
                          <span>綜合: <b>8.2</b></span>
                        </div>
                      </div>

                      {exp.conclusion && (
                        <div className="p-2.5 bg-purple-50/50 rounded-lg text-xs text-purple-900 border border-purple-100">
                          <b>結論：</b>{exp.conclusion}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: 競品庫與添加物 */}
          {tab === 'competitors' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-600" />
                  越南市場競品情報 (Competitor DB)
                </h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {competitors.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400 border border-dashed rounded-xl">
                      暫無競品資料。
                    </div>
                  ) : (
                    competitors.map(c => (
                      <div key={c.id} className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-1.5 text-xs shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-gray-900">{c.product_name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">{c.brand_name}</span>
                        </div>
                        <div className="flex items-center justify-between text-gray-600">
                          <span>售價：{fmt(c.price_vnd)} VND</span>
                          <span>容量：{c.cup_size_ml} ml</span>
                          <span>甜度：{c.sweetness_level}</span>
                        </div>
                        {c.notes && <p className="text-gray-500 text-[11px] pt-1 border-t border-gray-50">{c.notes}</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  食品添加物合規資料庫 (INS Reference)
                </h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {additives.map(a => (
                    <div key={a.id} className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-1 text-xs shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900">{a.name}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">{a.ins_number}</span>
                      </div>
                      <div className="text-gray-600">功能作用：{a.function}</div>
                      <div className="text-gray-600">最大使用量：{a.max_usage}</div>
                      <div className="text-[11px] text-gray-400">法規依據：{a.regulatory_source}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: 外部知識庫 */}
          {tab === 'knowledge' && (
            <div className="space-y-6">
              <form onSubmit={handleIngestKnowledge} className="p-5 bg-gradient-to-br from-purple-50/50 to-indigo-50/40 rounded-2xl border border-purple-200 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-sm text-purple-900">
                  <Video className="h-4 w-4 text-red-600" />
                  外部研發知識學習器 (YouTube / 論文 / 專利 / 專家技術)
                </div>
                <p className="text-xs text-gray-500">
                  貼上 YouTube 影片、食品科學網址或論文摘要，AI 自動進行技術萃取、原理分析並賦予 Evidence Level (A~E 實證等級)。
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder="YouTube 網址、論文 DOI 或文章 URL..."
                      value={extUrl}
                      onChange={e => setExtUrl(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="技術主題 / 標題..."
                      value={extTitle}
                      onChange={e => setExtTitle(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs"
                    />
                  </div>
                  <div>
                    <select
                      value={extType}
                      onChange={e => setExtType(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs text-gray-700"
                    >
                      <option value="youtube">YouTube 萃取</option>
                      <option value="paper">學術論文 (Level A)</option>
                      <option value="patent">食品專利 (Level B)</option>
                      <option value="expert">專家文章 (Level C)</option>
                      <option value="article">網路文章 (Level D)</option>
                    </select>
                  </div>
                </div>

                <textarea
                  placeholder="可貼上影片重點 Transcript、萃取操作方法或論文技術摘要..."
                  rows={3}
                  value={extText}
                  onChange={e => setExtText(e.target.value)}
                  className="w-full p-3 rounded-lg border border-gray-200 bg-white text-xs"
                />

                <div className="flex items-center justify-between pt-1">
                  {extNotice && <span className="text-xs text-emerald-600 font-medium">{extNotice}</span>}
                  <Button
                    type="submit"
                    size="sm"
                    disabled={ingesting || (!extUrl && !extTitle && !extText)}
                    className="ml-auto bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5"
                  >
                    {ingesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    開始學習並轉入知識庫
                  </Button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {knowledge.length === 0 ? (
                  <div className="col-span-2 p-12 text-center text-xs text-gray-400 border border-dashed rounded-2xl">
                    尚未匯入外部知識。可輸入 YouTube 或技術論文以充實 Feeling Tea 研發大腦。
                  </div>
                ) : (
                  knowledge.map(k => (
                    <div key={k.id} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-gray-900">{k.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          k.evidence_level === 'A'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : k.evidence_level === 'B'
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          Level {k.evidence_level}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 p-3 rounded-xl">
                        {k.summary || k.content_text}
                      </p>

                      {k.source_url && (
                        <div className="text-[11px] text-purple-600 truncate flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          <a href={k.source_url} target="_blank" rel="noreferrer" className="hover:underline">
                            {k.source_url}
                          </a>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 7: 研發 6 大 Agent */}
          {tab === 'agents' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { id: 'knowledge', label: 'Agent 1: 知識大腦', icon: BookOpen, desc: '歷史配方與科學證據' },
                  { id: 'recipe', label: 'Agent 2: 配方工程師', icon: Layers, desc: '比例平衡與感官結構' },
                  { id: 'cost', label: 'Agent 3: 成本精算師', icon: DollarSign, desc: '換料降本10%試算' },
                  { id: 'regulatory', label: 'Agent 4: 法規與稅務', icon: ShieldCheck, desc: '特別消費稅與添加物' },
                  { id: 'experiment', label: 'Agent 5: 實驗品評師', icon: Compass, desc: 'A/B/C對照與感官雷達' },
                  { id: 'innovation', label: 'Agent 6: 跨界創新總監', icon: Sparkles, desc: 'Idea-to-Experiment' },
                ].map(ag => {
                  const Icon = ag.icon
                  const active = agentType === ag.id
                  return (
                    <button
                      key={ag.id}
                      onClick={() => setAgentType(ag.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        active
                          ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <Icon className={`h-4 w-4 mb-1.5 ${active ? 'text-purple-600' : 'text-gray-400'}`} />
                      <div className="font-bold text-xs">{ag.label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{ag.desc}</div>
                    </button>
                  )
                })}
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-gray-900">
                    向 {agentType === 'innovation' ? 'Agent 6 (跨界創新總監)' : agentType} 提出研發指令
                  </h3>
                  <span className="text-xs text-gray-400">已自動串接當前配方與原料庫上下文</span>
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    value={agentPrompt}
                    onChange={e => setAgentPrompt(e.target.value)}
                    placeholder={
                      agentType === 'innovation'
                        ? '例如：幫我開發一款越南市場夏天的芒果烏龍冷萃奶蓋飲品，售價 45,000 VND 以下，並給予跨界風味搭配原理與一鍵實驗協議。'
                        : agentType === 'cost'
                        ? '例如：我要降低當前配方 10% 成本，有哪些原料可以替換？對風味會造成什麼影響？'
                        : '請輸入您想向研發大腦諮詢的問題...'
                    }
                    className="w-full p-3 rounded-xl border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleCallAgent}
                    disabled={agentRunning || !agentPrompt.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5"
                  >
                    {agentRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    執行 Agent 分析
                  </Button>
                </div>

                {agentReply && (
                  <div className="mt-4 p-4 rounded-xl border border-purple-200 bg-purple-50/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        Agent 研發分析報告
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-lg border border-purple-100 font-sans">
                      {agentReply}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
