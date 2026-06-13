/**
 * 輕量 Markdown → HTML（不裝套件，供 GEO SSR 落地頁渲染給 AI 爬蟲）。
 * 支援：H1–H3、無序/有序清單、表格、段落、粗體、連結。已對文字做 HTML escape。
 */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inline(s: string): string {
  let out = esc(s)
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, href) =>
    `<a href="${esc(href)}" rel="noopener">${t}</a>`)
  return out
}

export function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let i = 0

  const flushTable = (start: number): number => {
    const rows: string[][] = []
    let j = start
    while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) {
      const cells = lines[j].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      rows.push(cells)
      j++
    }
    if (rows.length >= 2 && /^[-:\s|]+$/.test(rows[1].join('|'))) {
      const head = rows[0]
      const body = rows.slice(2)
      html.push('<table><thead><tr>' + head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        body.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>')
    }
    return j
  }

  while (i < lines.length) {
    const line = lines[i]

    if (/^\s*$/.test(line)) { i++; continue }

    // 表格
    if (/^\s*\|.*\|\s*$/.test(line)) { i = flushTable(i); continue }

    // 標題
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      const lvl = h[1].length
      html.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`)
      i++; continue
    }

    // 無序清單
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`)
        i++
      }
      html.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    // 有序清單
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`)
        i++
      }
      html.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    // 段落
    html.push(`<p>${inline(line)}</p>`)
    i++
  }

  return html.join('\n')
}
