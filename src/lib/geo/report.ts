/**
 * GEO 月度引用追蹤報告聚合 — 由 geo_tracking 歷史算出：
 *  - 被引用率趨勢（依日期）
 *  - 競爭對手 share-of-voice（誰在這些問句被引用最多）
 *  - 掉榜清單（上次被引用、最新一次未被引用）
 * 並產生可列印的 HTML 報告（瀏覽器另存 PDF）。
 */
export interface TrackingRow {
  question_id: string
  question: string
  checked_at: string
  cited: boolean
  rank: number | null
  cited_sources: string[]
}

export interface ReportData {
  totalQuestions: number
  latestDate: string | null
  latestCitedRate: number          // 0–100
  trend: { date: string; rate: number; tracked: number }[]
  competitors: { domain: string; questions: number; share: number }[]  // share 0–100
  ourDomain: string
  ourAppearances: number
  dropped: { question: string; lastSeen: string }[]
}

function dayOf(iso: string): string {
  return iso.slice(0, 10)
}

function normDomain(s: string): string {
  return s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
}

function matchTarget(domain: string, target: string): boolean {
  const d = normDomain(domain), t = normDomain(target)
  return d === t || d.endsWith(`.${t}`) || d.includes(t)
}

export function aggregateReport(rows: TrackingRow[], targetDomain: string): ReportData {
  const target = normDomain(targetDomain)

  // 依日期分組（每個 day 視為一次 run）
  const byDay = new Map<string, TrackingRow[]>()
  for (const r of rows) {
    const d = dayOf(r.checked_at)
    const arr = byDay.get(d) ?? []
    arr.push(r)
    byDay.set(d, arr)
  }
  const days = [...byDay.keys()].sort()

  const trend = days.map(d => {
    const rs = byDay.get(d)!
    const tracked = rs.length
    const cited = rs.filter(r => r.cited).length
    return { date: d, tracked, rate: tracked ? Math.round((cited / tracked) * 100) : 0 }
  })

  const latestDate = days.length ? days[days.length - 1] : null
  const latestRows = latestDate ? byDay.get(latestDate)! : []
  const latestCitedRate = latestRows.length
    ? Math.round((latestRows.filter(r => r.cited).length / latestRows.length) * 100)
    : 0

  // 競爭對手 SoV（最新一次 run）：每個網域出現在幾個問句
  const domainQ = new Map<string, Set<string>>()
  let ourAppearances = 0
  for (const r of latestRows) {
    const seen = new Set<string>()
    for (const src of r.cited_sources ?? []) {
      const dom = normDomain(src)
      if (!dom || seen.has(dom)) continue
      seen.add(dom)
      if (matchTarget(dom, target)) { ourAppearances++; continue }
      const set = domainQ.get(dom) ?? new Set()
      set.add(r.question_id)
      domainQ.set(dom, set)
    }
  }
  const denom = latestRows.length || 1
  const competitors = [...domainQ.entries()]
    .map(([domain, qs]) => ({ domain, questions: qs.size, share: Math.round((qs.size / denom) * 100) }))
    .sort((a, b) => b.questions - a.questions)
    .slice(0, 12)

  // 掉榜：某題在較早 run 曾 cited，最新 run 未 cited
  const dropped: { question: string; lastSeen: string }[] = []
  if (latestDate) {
    const latestByQ = new Map(latestRows.map(r => [r.question_id, r]))
    const everCited = new Map<string, { question: string; date: string }>()
    for (const r of rows) {
      if (r.cited && dayOf(r.checked_at) < latestDate) {
        const prev = everCited.get(r.question_id)
        if (!prev || dayOf(r.checked_at) > prev.date) everCited.set(r.question_id, { question: r.question, date: dayOf(r.checked_at) })
      }
    }
    for (const [qid, info] of everCited) {
      const now = latestByQ.get(qid)
      if (now && !now.cited) dropped.push({ question: info.question, lastSeen: info.date })
    }
  }

  return {
    totalQuestions: new Set(rows.map(r => r.question_id)).size,
    latestDate,
    latestCitedRate,
    trend,
    competitors,
    ourDomain: target,
    ourAppearances,
    dropped,
  }
}

// ── 可列印 HTML 報告 ───────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function sparkline(trend: ReportData['trend']): string {
  if (trend.length < 2) return ''
  const w = 480, h = 90, pad = 6
  const xs = (i: number) => pad + (i * (w - 2 * pad)) / (trend.length - 1)
  const ys = (v: number) => h - pad - (v / 100) * (h - 2 * pad)
  const pts = trend.map((t, i) => `${xs(i).toFixed(0)},${ys(t.rate).toFixed(0)}`).join(' ')
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <polyline fill="none" stroke="#4f46e5" stroke-width="2" points="${pts}"/>
    ${trend.map((t, i) => `<circle cx="${xs(i).toFixed(0)}" cy="${ys(t.rate).toFixed(0)}" r="3" fill="#4f46e5"/>`).join('')}
  </svg>`
}

export function buildReportHtml(projectTitle: string, data: ReportData): string {
  const compRows = data.competitors.length
    ? data.competitors.map(c => `<tr><td>${esc(c.domain)}</td><td>${c.questions}</td><td>${c.share}%</td></tr>`).join('')
    : '<tr><td colspan="3">—</td></tr>'
  const dropRows = data.dropped.length
    ? data.dropped.map(d => `<tr><td>${esc(d.question)}</td><td>${esc(d.lastSeen)}</td></tr>`).join('')
    : '<tr><td colspan="2">無掉榜</td></tr>'
  const trendRows = data.trend.map(t => `<tr><td>${t.date}</td><td>${t.rate}%</td><td>${t.tracked}</td></tr>`).join('')

  return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8">
<title>GEO 引用追蹤報告 — ${esc(projectTitle)}</title>
<style>
body{max-width:780px;margin:0 auto;padding:32px 24px;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;color:#1e293b;line-height:1.6}
h1{font-size:1.6rem;margin:0 0 .25rem}
.sub{color:#64748b;font-size:.85rem;margin-bottom:1.5rem}
.kpis{display:flex;gap:16px;margin:1rem 0 1.5rem;flex-wrap:wrap}
.kpi{flex:1;min-width:150px;border:1px solid #e2e8f0;border-radius:12px;padding:14px}
.kpi .n{font-size:1.8rem;font-weight:800;color:#4f46e5}
.kpi .l{font-size:.75rem;color:#64748b}
h2{font-size:1.05rem;margin:1.8rem 0 .6rem;border-left:4px solid #4f46e5;padding-left:8px}
table{border-collapse:collapse;width:100%;font-size:.9rem;margin:.5rem 0}
th,td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left}
th{background:#f8fafc}
@media print{body{padding:0}}
</style></head><body>
<h1>GEO 引用追蹤報告</h1>
<div class="sub">${esc(projectTitle)} ・ 目標網域 ${esc(data.ourDomain)} ・ 最新追蹤 ${data.latestDate ?? '—'}</div>
<div class="kpis">
  <div class="kpi"><div class="n">${data.latestCitedRate}%</div><div class="l">最新被引用率</div></div>
  <div class="kpi"><div class="n">${data.ourAppearances}</div><div class="l">你的網域被引用次數</div></div>
  <div class="kpi"><div class="n">${data.totalQuestions}</div><div class="l">追蹤問句數</div></div>
  <div class="kpi"><div class="n">${data.dropped.length}</div><div class="l">掉榜問句</div></div>
</div>
<h2>被引用率趨勢</h2>
${sparkline(data.trend)}
<table><thead><tr><th>日期</th><th>被引用率</th><th>追蹤數</th></tr></thead><tbody>${trendRows || '<tr><td colspan="3">尚無資料</td></tr>'}</tbody></table>
<h2>競爭對手 Share of Voice（最新一次）</h2>
<table><thead><tr><th>網域</th><th>出現問句數</th><th>佔比</th></tr></thead><tbody>${compRows}</tbody></table>
<h2>掉榜清單（曾被引用、最新未被引用）</h2>
<table><thead><tr><th>問句</th><th>最後被引用</th></tr></thead><tbody>${dropRows}</tbody></table>
</body></html>`
}
