'use client'
import { useState, useEffect } from 'react'
import { ExternalLink, CheckCircle2, XCircle, Loader2, Copy, Check, Terminal, Zap, Shield, Server } from 'lucide-react'

const PANEL_URL  = process.env.NEXT_PUBLIC_CLI_PROXY_PANEL_URL  ?? ''
const API_URL    = process.env.NEXT_PUBLIC_CLI_PROXY_API_URL    ?? ''

export default function CliProxyPage() {
  const [status, setStatus]     = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [models, setModels]     = useState<string[]>([])
  const [copied, setCopied]     = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting]   = useState(false)

  useEffect(() => { checkStatus() }, [])

  async function checkStatus() {
    if (!API_URL) { setStatus('error'); return }
    setStatus('checking')
    try {
      const r = await fetch('/api/cli-proxy/status')
      const d = await r.json()
      if (d.ok) {
        setStatus('ok')
        setModels(d.models ?? [])
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  async function testApi() {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await fetch('/api/cli-proxy/test', { method: 'POST' })
      const d = await r.json()
      setTestResult(d.reply ?? d.error ?? '無回應')
    } catch (e) {
      setTestResult(String(e))
    } finally {
      setTesting(false)
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const statusColor = { idle: 'text-gray-400', checking: 'text-amber-500', ok: 'text-green-600', error: 'text-red-500' }[status]
  const statusText  = { idle: '尚未檢查', checking: '檢查中…', ok: '連線正常', error: '無法連線' }[status]

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-3">
            <Terminal className="h-3.5 w-3.5" />
            <span>CLIProxyAPI Plus</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">代理伺服器管理</h1>
          <p className="text-slate-400 text-sm">透過 GitHub Copilot / Kiro 免費額度降低 Token 成本</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">

        {/* Status cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Server className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">API 狀態</span>
            </div>
            <div className={`flex items-center gap-1.5 font-semibold text-sm ${statusColor}`}>
              {status === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> :
               status === 'ok'       ? <CheckCircle2 className="h-4 w-4" /> :
               status === 'error'    ? <XCircle className="h-4 w-4" /> : null}
              {statusText}
            </div>
            <button onClick={checkStatus} className="mt-2 text-[11px] text-indigo-600 hover:underline">重新檢查</button>
          </div>

          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">可用模型</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{status === 'ok' ? models.length : '—'}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              {models.slice(0, 3).join('、') || '—'}
            </div>
          </div>

          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">控制台</span>
            </div>
            {PANEL_URL ? (
              <a href={PANEL_URL} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-indigo-600 hover:underline text-sm font-medium">
                開啟控制台 <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <div className="text-xs text-red-500">未設定 PANEL_URL</div>
            )}
            <div className="text-[11px] text-slate-400 mt-0.5">/management.html（https）</div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-sm text-slate-800">快速操作</h2>

          <div className="flex gap-3">
            {PANEL_URL && (
              <a href={PANEL_URL} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                <ExternalLink className="h-4 w-4" />
                開啟控制台
              </a>
            )}
            <button onClick={testApi} disabled={testing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              測試 API
            </button>
          </div>

          {testResult && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-700 font-mono border">
              {testResult}
            </div>
          )}
        </div>

        {/* Env vars */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h2 className="font-semibold text-sm text-slate-800">Vercel 環境變數設定</h2>
          <p className="text-xs text-slate-500">在 Vercel 後台 → Settings → Environment Variables 加入以下變數：</p>
          {[
            { key: 'NEXT_PUBLIC_CLI_PROXY_PANEL_URL', val: 'https://cli-proxy.yourdomain.com/management.html', desc: '控制台 URL（經 Cloudflare Tunnel，https）' },
            { key: 'NEXT_PUBLIC_CLI_PROXY_API_URL',   val: 'https://cli-proxy.yourdomain.com', desc: 'API 端點（經 Cloudflare Tunnel，https）' },
            { key: 'CLI_PROXY_API_KEY',               val: 'ai-gate-proxy-key-change-me', desc: 'config.yaml 中的 api-keys' },
          ].map(({ key, val, desc }) => (
            <div key={key} className="bg-slate-50 rounded-lg p-3 border">
              <div className="flex items-center justify-between mb-1">
                <code className="text-xs font-bold text-slate-800">{key}</code>
                <button onClick={() => copy(key, key)} className="text-slate-400 hover:text-slate-700">
                  {copied === key ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">{val}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{desc}</div>
            </div>
          ))}
        </div>

        {/* Deploy guide */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h2 className="font-semibold text-sm text-slate-800">伺服器部署步驟</h2>
          <div className="space-y-2 text-sm text-slate-600">
            {[
              { n: '1', text: '將 docker/cli-proxy/ 資料夾上傳到你的 VPS' },
              { n: '2', text: '修改 config.yaml：填入 API Keys 和管理密鑰' },
              { n: '3', text: 'Cloudflare Zero Trust → Networks → Tunnels 建立 tunnel，Public Hostname 服務填 http://cli-proxy-api:8317，複製 token' },
              { n: '4', text: '在 VPS 的 docker/cli-proxy/.env 填入 CLOUDFLARE_TUNNEL_TOKEN=剛複製的 token' },
              { n: '5', text: '執行：docker compose up -d（cli-proxy 與 cloudflared 一起啟動）' },
              { n: '6', text: '開 https://你的tunnel網域/management.html 進控制台，登入 Kiro / GitHub Copilot 取得免費額度' },
              { n: '7', text: '在 Vercel 設定上方環境變數（https 網域）後重新部署' },
            ].map(({ n, text }) => (
              <div key={n} className="flex gap-3">
                <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
              <strong>防火牆設定：</strong>使用 Cloudflare Tunnel 後對外不需開放 8317，
              建議防火牆只保留 SSH，其餘對外關閉（流量都走 tunnel，自動 https）。
              OAuth 初次登入若需回呼埠（8085 等）再臨時開放。
            </p>
          </div>
        </div>

        {/* Available models */}
        {models.length > 0 && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-sm text-slate-800 mb-3">可用模型清單</h2>
            <div className="flex flex-wrap gap-2">
              {models.map(m => (
                <span key={m} className="text-[11px] px-2 py-1 bg-slate-100 text-slate-700 rounded-md font-mono">{m}</span>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
