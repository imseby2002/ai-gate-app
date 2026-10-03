// 行銷模組依實際用量扣點（server only）：以 AsyncLocalStorage 隔離每個請求累計的供應商成本，
// 讓深層的 helper（逐段 LLM 呼叫、外部搜尋）直接記帳，不必一路傳參數；請求結束時一次扣點。
import { AsyncLocalStorage } from 'node:async_hooks'
import { chargeUsage, llmCost } from './billing'

const usageStore = new AsyncLocalStorage<{ costUsd: number; userId: string | null }>()

/** 記一筆 LLM 用量（usage 取自 AI SDK 回傳） */
export function trackLlm(model: string, usage?: { inputTokens?: number; outputTokens?: number } | null): void {
  const store = usageStore.getStore()
  if (store) store.costUsd += llmCost(model, usage)
}

/** 記一筆外部服務成本（USD） */
export function trackCost(costUsd: number): void {
  const store = usageStore.getStore()
  if (store && costUsd > 0) store.costUsd += costUsd
}

/**
 * 在用量累計範圍內執行 fn，結束後依「實際成本 × 方案倍率」扣點。
 * fn 拋錯時仍會就已發生的成本扣點（供應商已計費），再把錯誤往外拋。
 */
export async function withUsageBilling<T>(userId: string, description: string, fn: () => Promise<T>): Promise<T> {
  const store = { costUsd: 0, userId }
  try {
    return await usageStore.run(store, fn)
  } finally {
    await chargeUsage(userId, store.costUsd, description)
  }
}

/** 指定本次請求要扣點的帳號（搭配 withUsage 使用；驗證身分後呼叫） */
export function setUsageUser(userId: string): void {
  const store = usageStore.getStore()
  if (store) store.userId = userId
}

/**
 * 包裝 route handler：整個請求期間累計用量，回應後依實際成本 × 方案倍率扣點。
 * handler 內須在驗證身分後呼叫 setUsageUser(userId)。
 */
export function withUsage<A extends unknown[], R>(description: string, handler: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    const store: { costUsd: number; userId: string | null } = { costUsd: 0, userId: null }
    try {
      return await usageStore.run(store, () => handler(...args))
    } finally {
      if (store.userId) await chargeUsage(store.userId, store.costUsd, description)
    }
  }
}
