/**
 * Vietnam Legal & Business Compliance AI System Types
 */

export type DocumentType =
  | 'Luật'
  | 'Bộ luật'
  | 'Nghị định'
  | 'Thông tư'
  | 'Nghị quyết'
  | 'Quyết định'
  | 'Công văn'
  | 'Văn bản hợp nhất'

export type LegalStatus =
  | 'ACTIVE'
  | 'NOT_YET_EFFECTIVE'
  | 'AMENDED'
  | 'PARTIALLY_AMENDED'
  | 'REPEALED'
  | 'EXPIRED'
  | 'DRAFT'

export type LegalNodeType = 'CHAPTER' | 'SECTION' | 'ARTICLE' | 'CLAUSE' | 'POINT'

export type RelationType =
  | 'AMENDS'
  | 'AMENDED_BY'
  | 'REPEALS'
  | 'REPEALED_BY'
  | 'REPLACES'
  | 'REPLACED_BY'
  | 'IMPLEMENTS'
  | 'IMPLEMENTED_BY'
  | 'GUIDES'
  | 'GUIDED_BY'
  | 'CONSOLIDATES_INTO'
  | 'REFERENCES'
  | 'MANDATES_PROCEDURE'

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNRESOLVED'

export interface LegalDocument {
  id: string
  country_code: string
  document_number: string
  document_type: DocumentType | string
  title_vi: string
  title_en?: string
  title_zh?: string
  issuing_authority: string
  signer?: string
  issue_date: string // YYYY-MM-DD
  effective_date: string // YYYY-MM-DD
  expiry_date?: string | null
  status: LegalStatus
  is_consolidated: boolean
  consolidates_docs?: string[]
  source_tier: number
  source_url: string
  official_pdf_url?: string
  content_hash?: string
  metadata?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export interface LegalNode {
  id: string
  document_id: string
  country_code: string
  node_type: LegalNodeType
  chapter_number?: string
  chapter_title?: string
  section_number?: string
  section_title?: string
  article_number: string // e.g. "Điều 5"
  article_title?: string
  clause_number?: string // e.g. "Khoản 2"
  point_number?: string // e.g. "Điểm a"
  node_locator: string // e.g. "Điều 5, Khoản 2, Điểm a"
  original_text_vi: string
  translated_text_zh?: string
  translated_text_en?: string
  keywords?: string[]
  effective_from: string
  effective_to?: string | null
  status: LegalStatus
  amended_by_doc_id?: string
  amended_by_node_id?: string
  created_at?: string
  updated_at?: string
}

export interface LegalRelation {
  id: string
  source_doc_id: string
  source_node_id?: string
  relation_type: RelationType
  target_doc_id: string
  target_node_id?: string
  effective_date: string
  description_vi?: string
  description_zh?: string
}

export interface ProcedureCatalog {
  id: string
  country_code: string
  code: string
  name_vi: string
  name_zh: string
  name_en?: string
  category: string
  industry: string
  province: string
  competent_authority: string
  governing_body: string
  submission_method: 'ONLINE' | 'IN_PERSON' | 'BOTH'
  online_url?: string
  processing_time_days: number
  official_fee_vnd: number
  fee_notes?: string
  result_document: string
  conditions?: string
  source_url: string
  last_verified_at?: string
}

export interface ProcedureStep {
  id: string
  procedure_id: string
  step_number: number
  title_vi: string
  title_zh: string
  description: string
  responsible_party: 'APPLICANT' | 'AUTHORITY'
  prerequisite_step_numbers?: number[]
  duration_days?: number
}

export interface ProcedureDossierItem {
  id: string
  procedure_id: string
  item_order: number
  document_name_vi: string
  document_name_zh: string
  is_mandatory: boolean
  form_code?: string
  form_template_url?: string
  sample_fill_url?: string
  notarization_required?: boolean
  consular_legalization?: boolean
  copies_count?: number
}

export interface CrossBorderComplianceRule {
  id: string
  origin_country: string
  destination_country: string
  category: 'FOOD' | 'EQUIPMENT' | 'STORE' | string
  item_name_zh: string
  hs_code?: string
  legal_basis_doc_id?: string
  regulatory_requirements: string
  tariff_rate_percentage?: number
  vat_rate_percentage?: number
  special_consumption_tax?: number
  required_certificates: string[]
  official_source_url: string
}

export interface Citation {
  document_title: string
  document_number: string
  article: string
  clause?: string
  point?: string
  effective_date: string
  status: LegalStatus
  official_url: string
}

export interface LegalAnswer {
  conclusion: string
  legal_basis: Citation[]
  confidence_level: ConfidenceLevel
  temporal_status: {
    target_date: string
    is_currently_effective: boolean
    effective_date: string
    expiry_date?: string | null
    notice?: string
  }
  amendment_history?: {
    is_amended: boolean
    amended_by?: string
    effective_from?: string
    notes?: string
  }
  exceptions?: string
  practical_interpretation?: string
  procedures?: Array<{
    procedure_name: string
    authority: string
    processing_time_days: number
    fee_vnd: number
    online_url?: string
    forms: string[]
  }>
  official_sources: string[]
  unresolved_disclaimer?: string
}
