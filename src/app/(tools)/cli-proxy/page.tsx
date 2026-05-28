'use client'
import { useState, useEffect } from 'react'
import { ExternalLink, CheckCircle2, XCircle, Loader2, Terminal, Zap, Shield, Server } from 'lucide-react'

const PANEL_URL    = process.env.NEXT_PUBLIC_CLI_PROXY_PANEL_URL  ?? ''
const API_URL      = process.env.NEXT_PUBLIC_CLI_PROXY_API_URL    ?? ''
const FREE_LLM_URL = process.env.NEXT_PUBLIC_FREE_LLM_URL         ?? ''

type StatusVal = 'idle' | 'checking' | 'ok' | 'error'

export default function CliProxyPage() {
  const [status, setStatus]         = useState<StatusVal>('idle')
  const [models, setModels]         = useState<string[]>([])
  const [freeStatus, setFreeStatus] = useState<StatusVal>('idle')
  const [freeModels, setFreeModels] = useState<string[]>([])

  useEffect(() => { checkStatus(); checkFreeStatus() }, [])

  async function checkStatus() {
    if (!API_URL) { setStatus('error'); return }
    setStatus('checking')
    try {
      const r = await fetch('/api/cli-proxy/status')
      const d = await r.json()
      if (d.ok) { setStatus('ok'); setModels(d.models ?? []) }
      else setStatus('error')
    } catch { setStatus('error') }
  }

  async function checkFreeStatus() {
    if (!FREE_LLM_URL) { setFreeStatus('error'); return }
    setFreeStatus('checking')
    try {
      const r = await fetch('/api/cli-proxy/free-status')
      const d = await r.json()
      if (d.ok) { setFreeStatus('ok'); setFreeModels(d.models ?? []) }
      else setFreeStatus('error')
    } catch { setFreeStatus('error') }
  }

  function statusColor(s: StatusVal) { return { idle: 'text-gray-400', checking: 'text-amber-500', ok: 'text-green-600', error: 'text-red-500' }[s] }
  function statusText(s: StatusVal)  { return { idle: '尚未檢查', checking: '檢查中…', ok: '連線正常', error: '無法連線' }[s] }
  function StatusIcon({ s }: { s: StatusVal }) {
    if (s === 'checking') return <Loader2 className="h-4 w-4 animate-spin" />
    if (s === 'ok')       return <CheckCircle2 className="h-4 w-4" />
    if (s === 'error')    return <XCircle className="h-4 w-4" />
    return null
  }

  function ProxyCard({
    label, accent, icon, s, mdls, panelUrl, panelLabel, sources, onRecheck,
  }: {
    label: string; accent: string; icon: React.ReactNode
    s: StatusVal; mdls: string[]; panelUrl?: string; panelLabel?: string
    sources?: string; onRecheck: () => void
  }) {
    return (
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${accent}`}>
          {icon}
          <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
          {panelUrl && (
            <a href={panelUrl} target="_blank" rel="noreferrer"
              className="ml-auto flex items-center gap-1 text-[11px] hover:underline opacity-70 hover:opacity-100">
              {panelLabel ?? 'Admin UI'} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="grid grid-cols-3 divide-x">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Server className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">API 狀態</span>
            </div>
            <div className={`flex items-center gap-1.5 font-semibold text-sm ${statusColor(s)}`}>
              <StatusIcon s={s} />{statusText(s)}
            </div>
            <button onClick={onRecheck} className="mt-2 text-[11px] text-indigo-600 hover:underline">重新檢查</button>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">可用模型</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{s === 'ok' ? mdls.length : '—'}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">{mdls.slice(0, 3).join('、') || '—'}</div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">管理控制台</span>
            </div>
            {panelUrl
              ? <a href={panelUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-indigo-600 hover:underline text-sm font-medium">
                  開啟控制台 <ExternalLink className="h-3.5 w-3.5" />
                </a>
              : <div className="text-xs text-slate-500">{sources}</div>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-3">
            <Terminal className="h-3.5 w-3.5" />
            <span>Proxy 管理</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">代理伺服器管理</h1>
          <p className="text-slate-400 text-sm">整合多個免費 LLM 平台，最大化可用額度</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        <ProxyCard
          label="CLIProxyAPI — 免費模型 × 6 大平台 + Vertex"
          accent="bg-slate-100 text-slate-600"
          icon={<Terminal className="h-3.5 w-3.5" />}
          s={status}
          mdls={models}
          panelUrl={PANEL_URL || undefined}
          panelLabel="控制台"
          onRecheck={checkStatus}
        />
        <ProxyCard
          label="FreeLLMAPI — 免費模型 × 12 平台"
          accent="bg-emerald-50 text-emerald-700"
          icon={<Zap className="h-3.5 w-3.5 text-emerald-600" />}
          s={freeStatus}
          mdls={freeModels}
          panelUrl={FREE_LLM_URL || undefined}
          panelLabel="Admin UI"
          onRecheck={checkFreeStatus}
        />

        {/* 模型清單 */}
        {models.length > 0 && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-sm text-slate-800 mb-3">CLIProxy 模型清單</h2>
            <div className="flex flex-wrap gap-2">
              {models.map(m => (
                <span key={m} className="text-[11px] px-2 py-1 bg-slate-100 text-slate-700 rounded-md font-mono">{m}</span>
              ))}
            </div>
          </div>
        )}
        {freeModels.length > 0 && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-sm text-slate-800 mb-3">FreeLLMAPI 模型清單</h2>
            <div className="flex flex-wrap gap-2">
              {freeModels.map(m => (
                <span key={m} className="text-[11px] px-2 py-1 bg-emerald-50 text-emerald-800 rounded-md font-mono">{m}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
