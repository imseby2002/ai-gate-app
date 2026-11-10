/**
 * GET /api/cron/model-prices（每天一次）
 *
 * 不呼叫任何 AI 模型、不花 token，只讀公開清單：
 *  1. CLIProxy /models：目前提供哪些模型（下架的自動跳過、有新版 Claude 就改用）
 *  2. OpenRouter /api/v1/models：免費模型清單（:free）與我們用到的付費模型價格
 *  3. OpenRouter /api/v1/models/{id}/endpoints：開源模型各供應商價格，排除低精度量化後取最便宜
 * 比較「同一模型直連價」與「OpenRouter 價 × (1 + 儲值手續費)」，便宜的先用，寫入 ai_route_prefs。
 * 任何一步失敗就保留前一天的資料，AI 功能照常（讀不到時用預設順序：直連 → OpenRouter）。
 */
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/cron/auth'
import {
  DIRECT_PRICES, OPENROUTER_FEE, OPENROUTER_OK_QUANTIZATIONS, PAIR_NAMES, pairInfo,
} from '@/lib/ai/proxy-fallback'
import type { OpenRouterPrice, RoutePrefs } from '@/lib/ai/route-prefs'

const OR_BASE = 'https://openrouter.ai/api/v1'
/** 只走 OpenRouter 的開源模型（沒有直連可比，但仍抓價格供計費） */
const OR_ONLY_OPEN_MODELS = ['moonshotai/kimi-k2.5']

// 比價用的典型用量：我們的呼叫大多輸入多、輸出少，以 1M 輸入 + 0.25M 輸出計
const blended = (p: { input: number; output: number }) => p.input + p.output * 0.25

type OrPricing = { prompt?: string; completion?: string }
const perMillion = (v?: string) => (v == null ? NaN : Number(v) * 1_000_000)

async function getJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res.json() as Promise<unknown>
}

export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const admin = createAdminClient()
  const { data: prevRow } = await admin.from('ai_route_prefs').select('data').eq('id', 'current').maybeSingle()
  const prev = (prevRow?.data ?? null) as RoutePrefs | null
  const notes: string[] = []

  // 1. CLIProxy 模型清單
  let cliProxyModels: string[] | null = prev?.cliProxyModels ?? null
  const cliUrl = process.env.CLI_PROXY_API_URL ?? process.env.NEXT_PUBLIC_CLI_PROXY_API_URL
  if (cliUrl) {
    try {
      const j = await getJson(`${cliUrl.replace(/\/+$/, '')}/models`, {
        Authorization: `Bearer ${process.env.CLI_PROXY_API_KEY ?? 'no-key'}`,
      }) as { data?: { id: string }[] }
      const ids = (j.data ?? []).map(m => m.id).filter(Boolean)
      if (ids.length) cliProxyModels = ids
      else notes.push('CLIProxy 回傳空清單，沿用前一天')
    } catch (e) {
      notes.push(`CLIProxy 清單抓取失敗，沿用前一天：${e instanceof Error ? e.message : e}`)
    }
  }

  // 2 + 3. OpenRouter 免費清單與價格
  let openRouterFree = prev?.openRouterFree ?? null
  const openRouterPrices: Record<string, OpenRouterPrice> = { ...(prev?.openRouterPrices ?? {}) }
  const orKey = process.env.OPENROUTER_API_KEY
  if (orKey) {
    const headers = { Authorization: `Bearer ${orKey}` }
    try {
      const j = await getJson(`${OR_BASE}/models`, headers) as { data?: { id: string; name?: string; pricing?: OrPricing }[] }
      const models = j.data ?? []
      const free = models.filter(m => m.id.endsWith(':free')).map(m => ({ id: m.id, name: m.name ?? m.id }))
      if (free.length) openRouterFree = free

      // 閉源模型：OpenRouter 只有原廠一家，直接用列表價格
      for (const name of PAIR_NAMES) {
        const info = pairInfo(name)
        if (info.openWeight) continue
        const m = models.find(x => x.id === info.openrouter)
        const input = perMillion(m?.pricing?.prompt), output = perMillion(m?.pricing?.completion)
        if (Number.isFinite(input) && Number.isFinite(output)) openRouterPrices[info.openrouter] = { input, output }
        else notes.push(`OpenRouter 找不到 ${info.openrouter} 的價格`)
      }
    } catch (e) {
      notes.push(`OpenRouter 模型清單抓取失敗，沿用前一天：${e instanceof Error ? e.message : e}`)
    }

    // 開源模型：逐一看各供應商報價，排除低精度量化後取最便宜
    const openIds = [
      ...PAIR_NAMES.map(pairInfo).filter(i => i.openWeight).map(i => i.openrouter),
      ...OR_ONLY_OPEN_MODELS,
    ]
    for (const id of openIds) {
      try {
        const j = await getJson(`${OR_BASE}/models/${id}/endpoints`, headers) as {
          data?: { endpoints?: { provider_name?: string; quantization?: string; pricing?: OrPricing }[] }
        }
        const ok = (j.data?.endpoints ?? [])
          .filter(e => (OPENROUTER_OK_QUANTIZATIONS as readonly string[]).includes((e.quantization ?? '').toLowerCase()))
          .map(e => ({ provider: e.provider_name, input: perMillion(e.pricing?.prompt), output: perMillion(e.pricing?.completion) }))
          .filter(e => Number.isFinite(e.input) && Number.isFinite(e.output))
          .sort((a, b) => blended(a) - blended(b))
        if (ok[0]) openRouterPrices[id] = { input: ok[0].input, output: ok[0].output, provider: ok[0].provider }
        else notes.push(`${id} 沒有符合精度要求的供應商`)
      } catch (e) {
        notes.push(`${id} 供應商報價抓取失敗：${e instanceof Error ? e.message : e}`)
      }
    }
  } else {
    notes.push('未設定 OPENROUTER_API_KEY')
  }

  // 比價：OpenRouter 加上儲值手續費後，比直連便宜才排前面
  const pairOrder: RoutePrefs['pairOrder'] = {}
  const comparison: Record<string, { direct: number; openrouter: number | null; pick: 'direct' | 'openrouter' }> = {}
  for (const name of PAIR_NAMES) {
    const info = pairInfo(name)
    const direct = DIRECT_PRICES[info.direct.model]
    const or = openRouterPrices[info.openrouter]
    const directCost = direct ? blended(direct) : Infinity
    const orCost = or ? blended(or) * (1 + OPENROUTER_FEE) : null
    const pick = orCost != null && orCost < directCost ? 'openrouter' : 'direct'
    pairOrder[name] = pick
    comparison[name] = { direct: Number(directCost.toFixed(4)), openrouter: orCost == null ? null : Number(orCost.toFixed(4)), pick }
  }

  const prefs: RoutePrefs = {
    updatedAt: new Date().toISOString(),
    cliProxyModels,
    openRouterFree,
    openRouterPrices,
    pairOrder,
  }
  const { error } = await admin.from('ai_route_prefs').upsert({ id: 'current', data: prefs, updated_at: prefs.updatedAt })
  if (error) return NextResponse.json({ ok: false, error: error.message, notes }, { status: 500 })

  return NextResponse.json({
    ok: true,
    cliProxyModels: cliProxyModels?.length ?? null,
    openRouterFree: openRouterFree?.length ?? null,
    comparison,
    notes,
  })
}
