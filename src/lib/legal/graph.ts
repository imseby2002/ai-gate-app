/**
 * Legal Knowledge Graph Engine (法律知識圖譜引擎)
 *
 * 管理與走訪母法、子法、修法、廢止與行政程序之關係網絡：
 * - AMENDS / AMENDED_BY
 * - REPEALS / REPEALED_BY
 * - IMPLEMENTS / IMPLEMENTED_BY (Luật ↔ Nghị định)
 * - GUIDES / GUIDED_BY (Nghị định ↔ Thông tư / Công văn)
 * - MANDATES_PROCEDURE (條文 ↔ 行政審批程序)
 */

import { LegalRelation, RelationType } from './types'

export interface GraphNodeRef {
  docId: string
  docNumber: string
  nodeId?: string
  locator?: string
}

export interface GraphNeighbor {
  relationType: RelationType
  targetDocNumber: string
  targetLocator?: string
  effectiveDate: string
  description?: string
}

export class LegalGraphEngine {
  private relations: LegalRelation[] = []

  constructor(initialRelations: LegalRelation[] = []) {
    this.relations = initialRelations
  }

  public addRelation(rel: LegalRelation) {
    this.relations.push(rel)
  }

  /**
   * 走訪查詢與特定法律條文直接相關的母子法與指導法規
   */
  public findImplementingDecrees(lawDocId: string): LegalRelation[] {
    return this.relations.filter(
      r => r.target_doc_id === lawDocId && r.relation_type === 'IMPLEMENTS'
    )
  }

  /**
   * 走訪查詢指導該命令之部會 Thông tư 或公文
   */
  public findGuidingCirculars(decreeDocId: string): LegalRelation[] {
    return this.relations.filter(
      r => r.target_doc_id === decreeDocId && r.relation_type === 'GUIDES'
    )
  }

  /**
   * 檢查條文是否被修訂，並取得修訂它的新條文與生效日
   */
  public findAmendingDocuments(targetDocId: string, targetNodeId?: string): LegalRelation[] {
    return this.relations.filter(r => {
      const matchDoc = r.target_doc_id === targetDocId
      const matchType = r.relation_type === 'AMENDS'
      if (!matchDoc || !matchType) return false
      if (targetNodeId && r.target_node_id) {
        return r.target_node_id === targetNodeId
      }
      return true
    })
  }

  /**
   * 檢查法律是否被廢止
   */
  public findRepealingDocument(targetDocId: string): LegalRelation | undefined {
    return this.relations.find(
      r => r.target_doc_id === targetDocId && r.relation_type === 'REPEALS'
    )
  }

  /**
   * 取得授權之行政申請程序
   */
  public findMandatedProcedures(docId: string, nodeId?: string): LegalRelation[] {
    return this.relations.filter(r => {
      if (r.source_doc_id !== docId || r.relation_type !== 'MANDATES_PROCEDURE') return false
      if (nodeId && r.source_node_id) {
        return r.source_node_id === nodeId
      }
      return true
    })
  }
}
