import { createAdminClient } from '@/lib/supabase/admin'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { notifyFeedbackAdmin } from '@/lib/feedback/notify'

export const CODE_ENGINE_NAME = 'Claude 3.7 Sonnet'

/**
 * 取得官方 Claude 3.7 Sonnet 程式碼修復引擎實例
 * 優先使用 ANTHROPIC_API_KEY 直連官方 claude-3-7-sonnet-20250219
 * 備用支援 OPENROUTER_API_KEY (anthropic/claude-3.7-sonnet)
 */
export function getClaudeSonnetModel() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (anthropicKey) {
    const anthropic = createAnthropic({ apiKey: anthropicKey })
    return anthropic('claude-3-7-sonnet-20250219')
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim()
  if (openrouterKey) {
    const openrouter = createOpenAI({
      apiKey: openrouterKey,
      baseURL: 'https://openrouter.ai/api/v1',
    })
    return openrouter.chat('anthropic/claude-3.7-sonnet')
  }

  throw new Error('未設定 ANTHROPIC_API_KEY 或 OPENROUTER_API_KEY，無法啟動 Claude Sonnet')
}

const REPO_OWNER = 'imseby2002'
const REPO_NAME  = 'ai-gate-app'
const BASE_BRANCH = 'main'

// ── GitHub API helpers ────────────────────────────────────────────────────────

export async function ghFetch(path: string, opts: RequestInit = {}) {
  const pat = process.env.GITHUB_PAT
  if (!pat) throw new Error('GITHUB_PAT 未設定')
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub API ${path}: ${res.status} ${err.slice(0, 200)}`)
  }
  return res.json()
}

async function getFileSha(filePath: string, branch: string): Promise<{ sha: string; content: string } | null> {
  try {
    const data = await ghFetch(`/contents/${filePath}?ref=${branch}`)
    return { sha: data.sha, content: Buffer.from(data.content, 'base64').toString('utf-8') }
  } catch { return null }
}

async function getMainSha(): Promise<string> {
  const data = await ghFetch(`/git/ref/heads/${BASE_BRANCH}`)
  return data.object.sha
}

async function createBranch(branchName: string, fromSha: string) {
  await ghFetch('/git/refs', {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: fromSha }),
  })
}

async function pushFile(filePath: string, newContent: string, message: string, branch: string) {
  const existing = await getFileSha(filePath, branch)
  const body: Record<string, string> = {
    message,
    content: Buffer.from(newContent, 'utf-8').toString('base64'),
    branch,
  }
  if (existing?.sha) body.sha = existing.sha
  await ghFetch(`/contents/${filePath}`, { method: 'PUT', body: JSON.stringify(body) })
}

async function createPR(title: string, body: string, head: string): Promise<{ url: string; number: number }> {
  const data = await ghFetch('/pulls', {
    method: 'POST',
    body: JSON.stringify({ title, body, head, base: BASE_BRANCH }),
  })
  return { url: data.html_url, number: data.number }
}

// ── Read key files for AI context ─────────────────────────────────────────────

const ALWAYS_READ = [
  'src/app/(tools)/layout.tsx',
  'CLAUDE.md',
]

const TYPE_HINT_FILES: Record<string, string[]> = {
  text_change: ['src/app/(tools)/booking/email/page.tsx'],
  feature:     ['src/app/(tools)/cli-proxy/page.tsx'],
  bug:         ['src/app/api/marketing/cs-chat/route.ts'],
  ai_error:    ['src/lib/cs/pricing.ts'],
}

async function readFilesForContext(type: string, description: string): Promise<Record<string, string>> {
  const paths = [...ALWAYS_READ, ...(TYPE_HINT_FILES[type] ?? [])]
  const result: Record<string, string> = {}
  await Promise.all(paths.map(async p => {
    const f = await getFileSha(p, BASE_BRANCH)
    if (f) result[p] = f.content.slice(0, 8000) // cap per file
  }))

  // Also try to detect relevant files from description keywords
  const kw = description.toLowerCase()
  const extras: string[] = []
  if (kw.includes('email')) extras.push('src/app/(tools)/booking/email/page.tsx')
  if (kw.includes('booking') || kw.includes('訂單')) extras.push('src/app/(tools)/booking/bookings/page.tsx')
  if (kw.includes('cli') || kw.includes('proxy')) extras.push('src/app/(tools)/cli-proxy/page.tsx')
  if (kw.includes('cs') || kw.includes('客服')) extras.push('src/app/api/marketing/cs-chat/route.ts')
  if (kw.includes('faq') || kw.includes('知識庫')) extras.push('src/app/api/marketing/cs-faq/route.ts')

  await Promise.all(extras.map(async p => {
    if (!result[p]) {
      const f = await getFileSha(p, BASE_BRANCH)
      if (f) result[p] = f.content.slice(0, 8000)
    }
  }))
  return result
}

// ── AI Classifier ──────────────────────────────────────────────────────────────

interface AiPlan {
  complexity: 'auto' | 'manual'
  reason: string
  files: Array<{ path: string; description: string }>
}

async function classifyAndPlan(title: string, description: string, type: string, context: Record<string, string>): Promise<AiPlan> {
  const contextStr = Object.entries(context).map(([p, c]) => `=== ${p} ===\n${c}`).join('\n\n')

  try {
    const model = getClaudeSonnetModel()
    const { text } = await generateText({
      model,
      messages: [{
        role: 'user',
        content: `你是一個由 Claude 3.7 Sonnet 驅動的 Next.js/TypeScript 高級架構分析師。根據以下使用者回饋，判斷是否可以「自動修改代碼」。

回饋類型：${type}
標題：${title}
描述：${description}

可以自動修改的條件（complexity: "auto"）：
- UI 文字、顏色、版面微調（單一檔案）
- 新增簡單頁面（照現有樣板）
- 設定值、FAQ、資料源調整
- 新增簡單 API（照現有樣板）
- AI 回應錯誤（資料或 prompt 調整）

不可自動修改（complexity: "manual"）：
- 需要 DB migration
- 複雜跨多檔案邏輯
- 需要第三方 API 整合
- 安全性相關改動

現有代碼參考：
${contextStr.slice(0, 12000)}

只回傳 JSON：
{
  "complexity": "auto" 或 "manual",
  "reason": "一句話說明判斷原因",
  "files": [{"path": "需要修改的檔案路徑", "description": "該檔案要做什麼修改"}]
}`,
      }],
    })

    const m = text.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0]) as AiPlan
  } catch (err) {
    return { complexity: 'manual', reason: `Claude Sonnet 分析失敗: ${String(err)}`, files: [] }
  }
  return { complexity: 'manual', reason: '解析失敗', files: [] }
}

// ── AI Code Generator ──────────────────────────────────────────────────────────

interface FileChange {
  path: string
  content: string
}

async function generateCodeChanges(
  title: string, description: string, type: string,
  plan: AiPlan, context: Record<string, string>
): Promise<FileChange[]> {
  const changes: FileChange[] = []
  const model = getClaudeSonnetModel()

  for (const fileTask of plan.files) {
    const existing = context[fileTask.path] ?? ''
    const { text } = await generateText({
      model,
      maxOutputTokens: 8192,
      messages: [{
        role: 'user',
        content: `你是一個由 Claude 3.7 Sonnet 驅動的 Next.js/TypeScript 專業工程師。根據使用者需求修改以下檔案。

需求類型：${type}
標題：${title}
需求描述：${description}
本檔案要做的修改：${fileTask.description}

現有代碼（${fileTask.path}）：
\`\`\`typescript
${existing}
\`\`\`

規則：
- 只輸出完整的修改後程式碼，不加任何說明
- 保持現有風格和結構
- TypeScript 嚴格模式，不加 any
- 不加不必要的注解
- 確保語法正確

直接輸出完整程式碼（不要加 \`\`\` 包裝）：`,
      }],
    })

    // Strip possible code fences
    const code = text.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '')
    changes.push({ path: fileTask.path, content: code })
  }

  return changes
}

// ── 主流程：供 API route 與其他伺服器端呼叫端（如 CS 問題反映）共用 ──────────────

export async function runFeedbackAutoFix(feedbackId: string) {
  const admin = createAdminClient()
  const { data: fb } = await admin.from('user_feedback').select('*').eq('id', feedbackId).single()
  if (!fb) return { ok: false as const, error: '找不到回饋' }

  // 計費項目需先經人工核准，狀態轉出 awaiting_approval 前不跑 AI
  if (fb.status === 'awaiting_approval') {
    return { ok: true as const, status: 'awaiting_approval', skipped: true }
  }
  // 避免重複處理
  if (fb.status === 'processing' || fb.status === 'pr_ready' || fb.status === 'merged') {
    return { ok: true as const, status: fb.status, skipped: true }
  }

  await admin.from('user_feedback').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', feedbackId)

  try {
    const context = await readFilesForContext(fb.type, fb.description)
    const plan = await classifyAndPlan(fb.title, fb.description, fb.type, context)

    if (plan.complexity === 'manual') {
      await admin.from('user_feedback').update({
        status: 'suggestion', complexity: 'manual', ai_plan: plan.reason,
        updated_at: new Date().toISOString(),
      }).eq('id', feedbackId)
      await notifyFeedbackAdmin(
        `[意見反映] 需要人工處理：${fb.title}`,
        [`AI 判斷無法自動修改：${plan.reason}`, `請至後台查看：https://www.im-tourist.com/admin/feedback`]
      )
      return { ok: true as const, complexity: 'manual' as const, reason: plan.reason }
    }

    // Auto: generate code and push to branch
    const branchName = `feedback/${feedbackId.slice(0, 8)}-${fb.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`
    const changes = await generateCodeChanges(fb.title, fb.description, fb.type, plan, context)

    if (!changes.length) {
      await admin.from('user_feedback').update({
        status: 'suggestion', complexity: 'auto', ai_plan: plan.reason,
        error_log: 'AI 未產生任何程式碼變更',
        updated_at: new Date().toISOString(),
      }).eq('id', feedbackId)
      return { ok: true as const, complexity: 'auto' as const, reason: 'no_changes' }
    }

    // Create branch
    const mainSha = await getMainSha()
    await createBranch(branchName, mainSha)

    // Push each changed file
    for (const change of changes) {
      await pushFile(change.path, change.content, `fix: ${fb.title}`, branchName)
    }

    // Create PR
    const prBody = `## 使用者回饋\n**類型**: ${fb.type}\n**描述**: ${fb.description}\n\n` +
      `## 🤖 程式碼編寫核心\n**${CODE_ENGINE_NAME} (Anthropic 官方)**\n\n` +
      `## AI 分析計畫\n${plan.reason}\n\n` +
      `## 修改檔案\n${plan.files.map((f: { path: string; description: string }) => `- \`${f.path}\`: ${f.description}`).join('\n')}\n\n` +
      `⚠️ 此 PR 由 ${CODE_ENGINE_NAME} 自動修改產生。請在預覽站點測試無誤後，至後台點擊「確認合併 (Squash Merge)」。`

    const pr = await createPR(`[Feedback] ${fb.title}`, prBody, branchName)
    const previewUrl = `https://ai-gate-app-git-${branchName.replace(/\//g, '-')}-imsebys-projects.vercel.app`

    await admin.from('user_feedback').update({
      status: 'pr_ready', complexity: 'auto',
      ai_plan: plan.reason,
      branch_name: branchName,
      pr_url: pr.url,
      preview_url: previewUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', feedbackId)

    await notifyFeedbackAdmin(
      `[意見反映] ${CODE_ENGINE_NAME} 已修好，待確認合併：${fb.title}`,
      [`Preview 預覽：${previewUrl}`, `GitHub PR：${pr.url}`, `後台一鍵合併：https://www.im-tourist.com/admin/feedback`]
    )

    return { ok: true as const, complexity: 'auto' as const, prUrl: pr.url, previewUrl, branchName }
  } catch (e) {
    const msg = String(e)
    await admin.from('user_feedback').update({
      status: 'pending', error_log: msg, updated_at: new Date().toISOString(),
    }).eq('id', feedbackId)
    return { ok: false as const, error: msg }
  }
}
