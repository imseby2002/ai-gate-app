/**
 * Hierarchical Legal Parser (越南法律層級語意樹解析器)
 *
 * 嚴格按照越南公務法律文書結構規範進行階層拆解：
 * Chapter (Chương) → Section (Mục) → Article (Điều) → Clause (Khoản) → Point (Điểm)
 */

import { LegalNode, LegalNodeType, LegalStatus } from './types'

export interface ParsedDocumentMeta {
  document_number: string
  document_type: string
  title_vi: string
  issuing_authority?: string
  signer?: string
  issue_date?: string
  effective_date?: string
}

export interface ParsedLegalHierarchy {
  meta: ParsedDocumentMeta
  nodes: Omit<LegalNode, 'id' | 'document_id' | 'created_at' | 'updated_at'>[]
  detected_amendments: Array<{
    target_doc_number?: string
    target_article?: string
    amendment_type: 'AMENDS' | 'REPEALS' | 'REPLACES'
    description: string
  }>
  detected_references: string[]
}

export class HierarchicalLegalParser {
  /**
   * 解析越南法律全文為結構化階層樹
   */
  public parseDocument(
    rawText: string,
    meta: ParsedDocumentMeta,
    effectiveDate: string
  ): ParsedLegalHierarchy {
    const lines = rawText.split(/\r?\n/)
    const nodes: Omit<LegalNode, 'id' | 'document_id' | 'created_at' | 'updated_at'>[] = []
    const detected_amendments: ParsedLegalHierarchy['detected_amendments'] = []
    const detected_references: string[] = []

    let currentChapter = ''
    let currentChapterTitle = ''
    let currentSection = ''
    let currentSectionTitle = ''
    let currentArticle = ''
    let currentArticleTitle = ''

    // 正規表達式定義 (越南法律法定格式)
    const chapterRegex = /^Chương\s+([IVXLCDM0-9]+)\s*[:\.\-]?\s*(.*)$/i
    const sectionRegex = /^Mục\s+([0-9]+)\s*[:\.\-]?\s*(.*)$/i
    const articleRegex = /^Điều\s+([0-9]+[a-z]?)\s*[\.\-:]?\s*(.*)$/i
    const clauseRegex = /^([0-9]+)\.\s*(.*)$/
    const pointRegex = /^([a-zđ])\)\s*(.*)$/i

    // 修法偵測關鍵字正則
    const amendPattern = /(sửa đổi|bổ sung|thay thế|bãi bỏ|hủy bỏ)\s+(Điều|Khoản|Điểm)?\s*([0-9a-zđ]+)?/i

    let currentArticleClauses: {
      clauseNum: string
      text: string
      points: { pointNum: string; text: string }[]
    }[] = []

    let pendingClause: {
      clauseNum: string
      text: string
      points: { pointNum: string; text: string }[]
    } | null = null

    const flushArticle = () => {
      if (!currentArticle) return

      // 若該條文下沒有任何子款 (無 1. 2. 3.)，則整篇條文視為第 1 款
      if (currentArticleClauses.length === 0) {
        nodes.push({
          country_code: 'VN',
          node_type: 'ARTICLE',
          chapter_number: currentChapter || undefined,
          chapter_title: currentChapterTitle || undefined,
          section_number: currentSection || undefined,
          section_title: currentSectionTitle || undefined,
          article_number: `Điều ${currentArticle}`,
          article_title: currentArticleTitle || undefined,
          node_locator: `Điều ${currentArticle}`,
          original_text_vi: currentArticleTitle,
          effective_from: effectiveDate,
          status: 'ACTIVE' as LegalStatus,
        })
        return
      }

      // 產生 Article 節點
      nodes.push({
        country_code: 'VN',
        node_type: 'ARTICLE',
        chapter_number: currentChapter || undefined,
        chapter_title: currentChapterTitle || undefined,
        section_number: currentSection || undefined,
        section_title: currentSectionTitle || undefined,
        article_number: `Điều ${currentArticle}`,
        article_title: currentArticleTitle || undefined,
        node_locator: `Điều ${currentArticle}`,
        original_text_vi: `${currentArticleTitle}\n${currentArticleClauses.map(c => `${c.clauseNum}. ${c.text}`).join('\n')}`,
        effective_from: effectiveDate,
        status: 'ACTIVE' as LegalStatus,
      })

      // 產生 Clause (Khoản) 與 Point (Điểm) 節點
      for (const cl of currentArticleClauses) {
        const clauseLocator = `Điều ${currentArticle}, Khoản ${cl.clauseNum}`
        nodes.push({
          country_code: 'VN',
          node_type: 'CLAUSE',
          chapter_number: currentChapter || undefined,
          chapter_title: currentChapterTitle || undefined,
          section_number: currentSection || undefined,
          section_title: currentSectionTitle || undefined,
          article_number: `Điều ${currentArticle}`,
          clause_number: `Khoản ${cl.clauseNum}`,
          node_locator: clauseLocator,
          original_text_vi: cl.text,
          effective_from: effectiveDate,
          status: 'ACTIVE' as LegalStatus,
        })

        for (const pt of cl.points) {
          const pointLocator = `Điều ${currentArticle}, Khoản ${cl.clauseNum}, Điểm ${pt.pointNum}`
          nodes.push({
            country_code: 'VN',
            node_type: 'POINT',
            chapter_number: currentChapter || undefined,
            chapter_title: currentChapterTitle || undefined,
            section_number: currentSection || undefined,
            section_title: currentSectionTitle || undefined,
            article_number: `Điều ${currentArticle}`,
            clause_number: `Khoản ${cl.clauseNum}`,
            point_number: `Điểm ${pt.pointNum}`,
            node_locator: pointLocator,
            original_text_vi: pt.text,
            effective_from: effectiveDate,
            status: 'ACTIVE' as LegalStatus,
          })
        }
      }

      currentArticleClauses = []
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // 偵測法規引用 (Căn cứ Luật / Nghị định số...)
      const refMatch = line.match(/(Luật|Nghị định|Thông tư|Quyết định)\s+số\s+([0-9\/\w\-]+)/i)
      if (refMatch) {
        const refDoc = `${refMatch[1]} số ${refMatch[2]}`
        if (!detected_references.includes(refDoc)) {
          detected_references.push(refDoc)
        }
      }

      // 偵測修法語意
      const amendMatch = line.match(amendPattern)
      if (amendMatch) {
        const action = amendMatch[1].toLowerCase()
        let amendment_type: 'AMENDS' | 'REPEALS' | 'REPLACES' = 'AMENDS'
        if (action.includes('bãi bỏ') || action.includes('hủy bỏ')) {
          amendment_type = 'REPEALS'
        } else if (action.includes('thay thế')) {
          amendment_type = 'REPLACES'
        }
        detected_amendments.push({
          target_article: amendMatch[3] ? `Điều ${amendMatch[3]}` : undefined,
          amendment_type,
          description: line,
        })
      }

      // 1. 章 (Chương)
      const chMatch = line.match(chapterRegex)
      if (chMatch) {
        flushArticle()
        currentChapter = chMatch[1]
        currentChapterTitle = chMatch[2] || (lines[i + 1] ? lines[++i].trim() : '')
        continue
      }

      // 2. 節 (Mục)
      const secMatch = line.match(sectionRegex)
      if (secMatch) {
        flushArticle()
        currentSection = secMatch[1]
        currentSectionTitle = secMatch[2] || (lines[i + 1] ? lines[++i].trim() : '')
        continue
      }

      // 3. 條 (Điều)
      const artMatch = line.match(articleRegex)
      if (artMatch) {
        flushArticle()
        currentArticle = artMatch[1]
        currentArticleTitle = artMatch[2] || (lines[i + 1] ? lines[++i].trim() : '')
        pendingClause = null
        continue
      }

      // 4. 款 (Khoản)
      const clMatch = line.match(clauseRegex)
      if (clMatch && currentArticle) {
        if (pendingClause) {
          currentArticleClauses.push(pendingClause)
        }
        pendingClause = {
          clauseNum: clMatch[1],
          text: clMatch[2],
          points: [],
        }
        continue
      }

      // 5. 點 (Điểm)
      const ptMatch = line.match(pointRegex)
      if (ptMatch && pendingClause) {
        pendingClause.points.push({
          pointNum: ptMatch[1].toLowerCase(),
          text: ptMatch[2],
        })
        continue
      }

      // 一般條文延續行
      if (pendingClause) {
        if (pendingClause.points.length > 0) {
          const lastPoint = pendingClause.points[pendingClause.points.length - 1]
          lastPoint.text += ` ${line}`
        } else {
          pendingClause.text += ` ${line}`
        }
      } else if (currentArticle) {
        currentArticleTitle += ` ${line}`
      }
    }

    if (pendingClause) {
      currentArticleClauses.push(pendingClause)
    }
    flushArticle()

    return {
      meta,
      nodes,
      detected_amendments,
      detected_references,
    }
  }
}
