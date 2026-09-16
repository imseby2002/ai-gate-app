'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import {
  FlaskConical, Layers, Scale, DollarSign, ShieldCheck, Sparkles,
  BookOpen, Plus, Trash2, Search, CheckCircle2, AlertTriangle,
  Loader2, Star, Compass, FileText,
  Video, Globe, Check, Copy, Send, Coffee, Bot, TrendingUp, Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { calculateRecipe, type RecipeIngredientInput } from '@/lib/rd/formula-engine'
import { checkLegalCompliance } from '@/lib/rd/legal-engine'

const fmt = (n: number, locale: string) => Math.round(Number(n) || 0).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')

export default function RdLabPage() {
  const t = useTranslations('RdLab')
  const locale = useLocale()
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
        setExtNotice(t('ingestSuccess'))
        loadData()
      } else {
        alert(t('ingestFailed'))
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
        setAgentReply(t('agentError', { msg: data.error || t('agentErrorFallback') }))
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
          <p className="font-semibold text-lg">{t('forbidden')}</p>
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
                {t('badge')}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {t('subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/rd">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              {t('navRecipes')}
            </Button>
          </Link>
          <Link href="/rd-logs">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" />
              {t('navLogs')}
            </Button>
          </Link>
          <Link href="/rd-ai">
            <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs">
              <Bot className="h-3.5 w-3.5" />
              {t('navAi')}
            </Button>
          </Link>
        </div>
      </div>

      {/* 核心導覽分頁 Tabs (自適應換行排列，無須向右拖拉即可看清所有功能) */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/90 dark:bg-muted/60 rounded-2xl border border-slate-200 dark:border-border text-xs sm:text-sm font-medium">
        <button
          type="button"
          onClick={() => setTab('recipes')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-medium ${
            tab === 'recipes'
              ? 'bg-purple-600 text-white font-bold shadow-xs'
              : 'bg-white dark:bg-card text-slate-700 dark:text-slate-300 hover:text-purple-600 hover:bg-white/90 border border-slate-200/70 dark:border-border'
          }`}
        >
          <Layers className="h-4 w-4 shrink-0" />
          <span>{t('tabRecipes')}</span>
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
            tab === 'recipes' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}>
            {recipes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('ingredients')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-medium ${
            tab === 'ingredients'
              ? 'bg-purple-600 text-white font-bold shadow-xs'
              : 'bg-white dark:bg-card text-slate-700 dark:text-slate-300 hover:text-purple-600 hover:bg-white/90 border border-slate-200/70 dark:border-border'
          }`}
        >
          <Coffee className="h-4 w-4 shrink-0" />
          <span>{t('tabIngredients')}</span>
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
            tab === 'ingredients' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}>
            {ingredients.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('calculator')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-medium ${
            tab === 'calculator'
              ? 'bg-purple-600 text-white font-bold shadow-xs'
              : 'bg-white dark:bg-card text-slate-700 dark:text-slate-300 hover:text-purple-600 hover:bg-white/90 border border-slate-200/70 dark:border-border'
          }`}
        >
          <Scale className="h-4 w-4 shrink-0" />
          <span>{t('tabCalculator')}</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('experiments')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-medium ${
            tab === 'experiments'
              ? 'bg-purple-600 text-white font-bold shadow-xs'
              : 'bg-white dark:bg-card text-slate-700 dark:text-slate-300 hover:text-purple-600 hover:bg-white/90 border border-slate-200/70 dark:border-border'
          }`}
        >
          <Compass className="h-4 w-4 shrink-0" />
          <span>{t('tabExperiments')}</span>
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
            tab === 'experiments' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}>
            {experiments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('competitors')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-medium ${
            tab === 'competitors'
              ? 'bg-purple-600 text-white font-bold shadow-xs'
              : 'bg-white dark:bg-card text-slate-700 dark:text-slate-300 hover:text-purple-600 hover:bg-white/90 border border-slate-200/70 dark:border-border'
          }`}
        >
          <TrendingUp className="h-4 w-4 shrink-0" />
          <span>{t('tabCompetitors')}</span>
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
            tab === 'competitors' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}>
            {competitors.length + additives.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('knowledge')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-medium ${
            tab === 'knowledge'
              ? 'bg-purple-600 text-white font-bold shadow-xs'
              : 'bg-white dark:bg-card text-slate-700 dark:text-slate-300 hover:text-purple-600 hover:bg-white/90 border border-slate-200/70 dark:border-border'
          }`}
        >
          <Video className="h-4 w-4 shrink-0" />
          <span>{t('tabKnowledge')}</span>
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
            tab === 'knowledge' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}>
            {knowledge.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('agents')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-medium ${
            tab === 'agents'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-xs'
              : 'bg-white dark:bg-card text-slate-700 dark:text-slate-300 hover:text-purple-600 hover:bg-white/90 border border-slate-200/70 dark:border-border'
          }`}
        >
          <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
          <span>{t('tabAgents')}</span>
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
                  <h3 className="font-bold text-sm text-gray-800">{t('recipeListTitle')}</h3>
                  <span className="text-xs text-gray-500">{t('recipeListCount', { n: recipes.length })}</span>
                </div>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t('recipeSearchPlaceholder')}
                    value={recipeSearch}
                    onChange={e => setRecipeSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-xs"
                  />
                </div>

                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {recipes.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400 border border-dashed rounded-xl">
                      {t('recipeEmpty')}
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
                                  <Check className="h-2.5 w-2.5" /> {t('recipeInUse')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                            <span>{r.cup_size_ml} ml</span>
                            <span>{t('recipeCostPerCup', { n: fmt(r.cogs_amount, locale) })}</span>
                            <span>{t('recipeMargin', { n: r.gross_margin_pct })}</span>
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
                              {t('recipeProduction')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {t('recipeMeta', { size: selectedRecipe.cup_size_ml, category: selectedRecipe.category })}
                        </p>
                      </div>

                      <div>
                        {selectedRecipe.sugar_per_100ml > 5.0 ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {t('sugarTaxApplies', { n: selectedRecipe.sugar_per_100ml })}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t('sugarTaxExempt', { n: selectedRecipe.sugar_per_100ml })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-xs text-gray-500">{t('totalWeight')}</span>
                        <div className="text-lg font-bold text-gray-900 mt-0.5">{selectedRecipe.total_weight_g || 500} g</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-xs text-gray-500">{t('weightedBrix')}</span>
                        <div className="text-lg font-bold text-gray-900 mt-0.5">{selectedRecipe.estimated_brix || 6.5} °Bx</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-xs text-gray-500">{t('cogsPerCup')}</span>
                        <div className="text-lg font-bold text-indigo-700 mt-0.5">{fmt(selectedRecipe.cogs_amount, locale)} VND</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-xs text-gray-500">{t('grossMargin')}</span>
                        <div className="text-lg font-bold text-emerald-600 mt-0.5">{selectedRecipe.gross_margin_pct || 68.5}%</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        {t('structuredFormulation')}
                      </h4>
                      <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                            <tr>
                              <th className="p-2.5">{t('colIngredient')}</th>
                              <th className="p-2.5">{t('colCategory')}</th>
                              <th className="p-2.5 text-right">{t('colQty')}</th>
                              <th className="p-2.5 text-right">{t('colRatio')}</th>
                              <th className="p-2.5 text-right">{t('colBrix')}</th>
                              <th className="p-2.5 text-right">{t('colCostVnd')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(selectedRecipe.rd_recipe_ingredients || []).length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-4 text-center text-gray-400">
                                  {t('ingredientsEmpty')}
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
                                  <td className="p-2.5 text-right text-indigo-600 font-medium">{fmt(it.cost_amount, locale)}</td>
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
                    {t('selectRecipeHint')}
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
                    placeholder={t('ingSearchPlaceholder')}
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
                  <option value="all">{t('catAll')}</option>
                  <option value="tea">{t('catTea')}</option>
                  <option value="dairy">{t('catDairy')}</option>
                  <option value="syrup">{t('catSyrup')}</option>
                  <option value="juice">{t('catJuice')}</option>
                  <option value="topping">{t('catTopping')}</option>
                  <option value="additive">{t('catAdditive')}</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ingredients.length === 0 ? (
                  <div className="col-span-3 p-12 text-center text-xs text-gray-400 border border-dashed rounded-2xl">
                    {t('ingEmpty')}
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
                            <span className="text-xs text-purple-600 font-medium">{ing.supplier_name || t('defaultSupplier')}</span>
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
                            <span className="text-gray-400">{t('cost')}</span>
                            <div className="font-bold text-indigo-600">{fmt(ing.cost_per_kg, locale)}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">{t('shelfLife')}</span>
                            <div className="font-bold text-gray-800">{t('shelfLifeDays', { n: ing.shelf_life_days })}</div>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="text-[11px] font-semibold text-gray-500 mb-1">{t('sensoryScore')}</div>
                          <div className="flex items-center justify-between text-[11px] text-gray-600">
                            <span>{t('aroma')}: <b>{ing.aroma || 5}</b></span>
                            <span>{t('body')}: <b>{ing.body || 5}</b></span>
                            <span>{t('aftertaste')}: <b>{ing.aftertaste || 5}</b></span>
                            <span>{t('astringency')}: <b>{ing.astringency || 5}</b></span>
                            <span>{t('bitterness')}: <b>{ing.bitterness || 5}</b></span>
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
                      <h3 className="font-bold text-base text-gray-900">{t('calcTitle')}</h3>
                      <p className="text-xs text-gray-500">{t('calcSubtitle')}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCalcItems([...calcItems, { name: t('newIngredient'), category: 'topping', qty_g: 30, cost_per_kg: 20000, brix: 10 }])}
                      className="gap-1 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t('addIngredient')}
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
                          placeholder={t('ingredientNamePlaceholder')}
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
                          <option value="tea">{t('calcCatTea')}</option>
                          <option value="milk">{t('calcCatMilk')}</option>
                          <option value="syrup">{t('calcCatSyrup')}</option>
                          <option value="water">{t('calcCatWater')}</option>
                          <option value="ice">{t('calcCatIce')}</option>
                          <option value="foam">{t('calcCatFoam')}</option>
                          <option value="juice">{t('calcCatJuice')}</option>
                          <option value="topping">{t('calcCatTopping')}</option>
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
                          <span className="text-gray-400">{t('brix')}</span>
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
                          <span className="text-gray-400">{t('costPerKg')}</span>
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
                      <span className="text-gray-500">{t('packagingCost')}</span>
                      <input
                        type="number"
                        value={calcPackaging}
                        onChange={e => setCalcPackaging(Number(e.target.value))}
                        className="w-20 h-7 px-2 rounded border border-gray-200 text-right"
                      />
                      <span>VND</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{t('suggestedPrice')}</span>
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
                        {t('taxWarningTitle')}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        {t('taxExemptTitle')}
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
                    <div><b>{t('taxStatute')}</b>{activeLegal.tax_statute}</div>
                    <div><b>{t('taxCitation')}</b>{activeLegal.citation}</div>
                    <div className="mt-2 p-2 bg-white/80 rounded-lg text-gray-800">
                      <b>{t('reformulationSuggestion')}</b>{activeLegal.reformulation_suggestion}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                  <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-indigo-600" />
                    {t('costMarginModel')}
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500">{t('totalWeightVolume')}</span>
                      <span className="font-bold">{activeCalculation.total_weight_g} g / {activeCalculation.total_volume_ml} ml</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500">{t('weightedBrix')}</span>
                      <span className="font-bold">{activeCalculation.estimated_brix} °Bx</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500">{t('ingredientCost')}</span>
                      <span>{fmt(activeCalculation.ingredient_cogs, locale)} VND</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500">{t('packagingCostLabel')}</span>
                      <span>{fmt(activeCalculation.packaging_cogs, locale)} VND</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-50 text-indigo-700 font-bold">
                      <span>{t('totalCogsPerCup')}</span>
                      <span>{fmt(activeCalculation.total_cogs, locale)} VND</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-50 text-emerald-600 font-bold text-sm">
                      <span>{t('grossMarginLabel')}</span>
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
                  <h3 className="font-bold text-base text-gray-900">{t('experimentsTitle')}</h3>
                  <p className="text-xs text-gray-500">{t('experimentsSubtitle')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {experiments.length === 0 ? (
                  <div className="col-span-2 p-12 text-center text-xs text-gray-400 border border-dashed rounded-2xl">
                    {t('experimentsEmpty')}
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
                      <p className="text-xs text-gray-600"><b>{t('objective')}</b>{exp.objective}</p>

                      <div className="p-3 bg-gray-50 rounded-xl space-y-1 text-xs">
                        <div className="font-semibold text-gray-500 text-[11px]">{t('sensory9Score')}</div>
                        <div className="grid grid-cols-3 gap-1.5 text-[11px] text-gray-700">
                          <span>{t('sweetness')}: <b>7.0</b></span>
                          <span>{t('teaAroma')}: <b>8.5</b></span>
                          <span>{t('body')}: <b>8.0</b></span>
                          <span>{t('milkiness')}: <b>6.5</b></span>
                          <span>{t('astringency')}: <b>4.0</b></span>
                          <span>{t('bitterness')}: <b>3.0</b></span>
                          <span>{t('aftertaste')}: <b>8.5</b></span>
                          <span>{t('mouthfeel')}: <b>8.0</b></span>
                          <span>{t('overall')}: <b>8.2</b></span>
                        </div>
                      </div>

                      {exp.conclusion && (
                        <div className="p-2.5 bg-purple-50/50 rounded-lg text-xs text-purple-900 border border-purple-100">
                          <b>{t('conclusion')}</b>{exp.conclusion}
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
                  {t('competitorDbTitle')}
                </h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {competitors.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400 border border-dashed rounded-xl">
                      {t('competitorsEmpty')}
                    </div>
                  ) : (
                    competitors.map(c => (
                      <div key={c.id} className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-1.5 text-xs shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-gray-900">{c.product_name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">{c.brand_name}</span>
                        </div>
                        <div className="flex items-center justify-between text-gray-600">
                          <span>{t('priceLabel', { n: fmt(c.price_vnd, locale) })}</span>
                          <span>{t('capacityLabel', { n: c.cup_size_ml })}</span>
                          <span>{t('sweetnessLabel', { n: c.sweetness_level })}</span>
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
                  {t('additiveDbTitle')}
                </h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {additives.map(a => (
                    <div key={a.id} className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-1 text-xs shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900">{a.name}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">{a.ins_number}</span>
                      </div>
                      <div className="text-gray-600">{t('functionLabel')}{a.function}</div>
                      <div className="text-gray-600">{t('maxUsageLabel')}{a.max_usage}</div>
                      <div className="text-[11px] text-gray-400">{t('regulatorySourceLabel')}{a.regulatory_source}</div>
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
                  {t('knowledgeLearnerTitle')}
                </div>
                <p className="text-xs text-gray-500">
                  {t('knowledgeLearnerDesc')}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder={t('extUrlPlaceholder')}
                      value={extUrl}
                      onChange={e => setExtUrl(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder={t('extTitlePlaceholder')}
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
                      <option value="youtube">{t('extTypeYoutube')}</option>
                      <option value="paper">{t('extTypePaper')}</option>
                      <option value="patent">{t('extTypePatent')}</option>
                      <option value="expert">{t('extTypeExpert')}</option>
                      <option value="article">{t('extTypeArticle')}</option>
                    </select>
                  </div>
                </div>

                <textarea
                  placeholder={t('extTextPlaceholder')}
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
                    {t('startLearning')}
                  </Button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {knowledge.length === 0 ? (
                  <div className="col-span-2 p-12 text-center text-xs text-gray-400 border border-dashed rounded-2xl">
                    {t('knowledgeEmpty')}
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
                          {t('levelLabel', { level: k.evidence_level })}
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
                  { id: 'knowledge', label: t('agent1Label'), icon: BookOpen, desc: t('agent1Desc') },
                  { id: 'recipe', label: t('agent2Label'), icon: Layers, desc: t('agent2Desc') },
                  { id: 'cost', label: t('agent3Label'), icon: DollarSign, desc: t('agent3Desc') },
                  { id: 'regulatory', label: t('agent4Label'), icon: ShieldCheck, desc: t('agent4Desc') },
                  { id: 'experiment', label: t('agent5Label'), icon: Compass, desc: t('agent5Desc') },
                  { id: 'innovation', label: t('agent6Label'), icon: Sparkles, desc: t('agent6Desc') },
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
                    {t('agentPromptTo', { agent: agentType === 'innovation' ? t('agent6Full') : agentType })}
                  </h3>
                  <span className="text-xs text-gray-400">{t('agentContextHint')}</span>
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    value={agentPrompt}
                    onChange={e => setAgentPrompt(e.target.value)}
                    placeholder={
                      agentType === 'innovation'
                        ? t('agentPlaceholderInnovation')
                        : agentType === 'cost'
                        ? t('agentPlaceholderCost')
                        : t('agentPlaceholderDefault')
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
                    {t('runAgentAnalysis')}
                  </Button>
                </div>

                {agentReply && (
                  <div className="mt-4 p-4 rounded-xl border border-purple-200 bg-purple-50/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        {t('agentReportTitle')}
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
