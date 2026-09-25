// 智慧圓桌用量累計（server only）：以 AsyncLocalStorage 隔離每個請求的累計成本，
// 避免同一個 serverless 實例上的並行請求互相污染。
import { AsyncLocalStorage } from 'node:async_hooks'
import { calculateModelCosts } from '@/lib/ai/token-cost-tracker'
import { registerRoundtableUsageSink } from '@/lib/ai/roundtable'

export const roundtableUsage = new AsyncLocalStorage<{ costUsd: number }>()

registerRoundtableUsageSink((billingModelId, inputTokens, outputTokens) => {
  const store = roundtableUsage.getStore()
  if (!store) return
  const { actualCostUsd } = calculateModelCosts(billingModelId, inputTokens, outputTokens)
  store.costUsd += actualCostUsd
})
