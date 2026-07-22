// 軟體開發專員（code-agent）專屬工具：只做「提案 PR」，不含自動跑測試/自我除錯——
// 這個平台（Vercel serverless）沒有可執行任意程式碼的沙盒環境，無法安全地自動跑測試。
// 測試/驗證交給既有 CI 或真人在 PR 上把關。
//
// 目標倉庫為單一、admin 設定的倉庫（環境變數 AGENT_GITHUB_TOKEN/AGENT_GITHUB_OWNER/
// AGENT_GITHUB_REPO），不是每個使用者各自的 GitHub 帳號——這是「公司內部工具」場景
// （AI 對公司自己的專案提案），不是幫任意使用者操作任意 repo。
import type { AgentToolDef } from '../types'

const GITHUB_API = 'https://api.github.com'

function githubConfig() {
  const token = process.env.AGENT_GITHUB_TOKEN
  const owner = process.env.AGENT_GITHUB_OWNER
  const repo = process.env.AGENT_GITHUB_REPO
  if (!token || !owner || !repo) return null
  return { token, owner, repo }
}

function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }
}

interface ReadRepoFileInput {
  path: string
  ref?: string
}

export const readRepoFileTool: AgentToolDef = {
  id: 'read_repo_file',
  description: '讀取指定專案（AGENT_GITHUB_REPO）中某個檔案的內容，供評估需求或規劃修改前先了解現況程式碼。',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '檔案路徑，如 src/lib/example.ts' },
      ref: { type: 'string', description: '分支/commit（選填，預設 repo 預設分支）' },
    },
    required: ['path'],
  },
  async execute(rawInput) {
    const input = rawInput as unknown as ReadRepoFileInput
    const cfg = githubConfig()
    if (!cfg) return { error: '尚未設定 AGENT_GITHUB_TOKEN/AGENT_GITHUB_OWNER/AGENT_GITHUB_REPO' }
    const params = input.ref ? `?ref=${encodeURIComponent(input.ref)}` : ''
    const res = await fetch(`${GITHUB_API}/repos/${cfg.owner}/${cfg.repo}/contents/${input.path}${params}`, {
      headers: githubHeaders(cfg.token),
    })
    const data = await res.json()
    if (!res.ok) return { error: data?.message ?? `讀取失敗（${res.status}）` }
    if (Array.isArray(data)) return { entries: data.map((d: { name: string; type: string }) => ({ name: d.name, type: d.type })) }
    const content = data.content ? Buffer.from(data.content, 'base64').toString('utf-8') : ''
    return { path: input.path, content, sha: data.sha }
  },
}

interface ProposeCodeChangeInput {
  branchName: string
  baseBranch?: string
  title: string
  description: string
  files: { path: string; content: string }[]
}

export const proposeCodeChangeTool: AgentToolDef = {
  id: 'propose_code_change',
  description:
    '在新分支上提交程式碼變更並開一個 draft PR 供真人審查。這會實際修改程式碼倉庫，一律需要真人核准。' +
    '不含自動跑測試——測試與最終把關交給既有 CI 或真人。',
  inputSchema: {
    type: 'object',
    properties: {
      branchName: { type: 'string', description: '新分支名稱，如 agent/fix-xxx' },
      baseBranch: { type: 'string', description: '從哪個分支切出，預設 repo 預設分支' },
      title: { type: 'string', description: 'PR 標題' },
      description: { type: 'string', description: 'PR 說明：為什麼改、改了什麼' },
      files: {
        type: 'array',
        description: '要新增/修改的檔案清單（完整內容，非 diff）',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['path', 'content'],
        },
      },
    },
    required: ['branchName', 'title', 'description', 'files'],
  },
  async execute(rawInput) {
    const input = rawInput as unknown as ProposeCodeChangeInput
    const cfg = githubConfig()
    if (!cfg) return { error: '尚未設定 AGENT_GITHUB_TOKEN/AGENT_GITHUB_OWNER/AGENT_GITHUB_REPO' }
    const headers = githubHeaders(cfg.token)
    const base = `${GITHUB_API}/repos/${cfg.owner}/${cfg.repo}`

    // 1. 取得 repo 預設分支與其最新 commit sha
    const repoRes = await fetch(base, { headers })
    const repoData = await repoRes.json()
    if (!repoRes.ok) return { error: repoData?.message ?? '讀取倉庫資訊失敗' }
    const baseBranch = input.baseBranch ?? repoData.default_branch

    const baseRefRes = await fetch(`${base}/git/ref/heads/${baseBranch}`, { headers })
    const baseRefData = await baseRefRes.json()
    if (!baseRefRes.ok) return { error: baseRefData?.message ?? '讀取 base 分支失敗' }
    const baseSha = baseRefData.object.sha

    // 2. 建立新分支
    const createRefRes = await fetch(`${base}/git/refs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ref: `refs/heads/${input.branchName}`, sha: baseSha }),
    })
    if (!createRefRes.ok) {
      const err = await createRefRes.json()
      if (createRefRes.status !== 422) return { error: err?.message ?? '建立分支失敗' } // 422 常見於分支已存在，容忍繼續
    }

    // 3. 逐檔提交（每個檔案各一個 commit，簡化實作，不做單一 tree 合併提交）
    for (const file of input.files) {
      let sha: string | undefined
      const existingRes = await fetch(`${base}/contents/${file.path}?ref=${input.branchName}`, { headers })
      if (existingRes.ok) {
        const existing = await existingRes.json()
        sha = existing.sha
      }
      const putRes = await fetch(`${base}/contents/${file.path}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `${input.title}\n\n${file.path}`,
          content: Buffer.from(file.content, 'utf-8').toString('base64'),
          branch: input.branchName,
          ...(sha ? { sha } : {}),
        }),
      })
      if (!putRes.ok) {
        const err = await putRes.json()
        return { error: `寫入 ${file.path} 失敗：${err?.message ?? putRes.status}` }
      }
    }

    // 4. 開 draft PR
    const prRes = await fetch(`${base}/pulls`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: input.title,
        body: input.description,
        head: input.branchName,
        base: baseBranch,
        draft: true,
      }),
    })
    const prData = await prRes.json()
    if (!prRes.ok) return { error: prData?.message ?? '建立 PR 失敗' }
    return { ok: true, prUrl: prData.html_url, prNumber: prData.number }
  },
}
