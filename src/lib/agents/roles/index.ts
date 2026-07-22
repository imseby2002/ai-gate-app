// 各角色的專屬工具集（核心工具見 src/lib/agents/tools/index.ts 的 CORE_AGENT_TOOLS，
// 每個角色都會自動拿到；這裡只需列出「額外」的角色專屬工具）。
// 純核心工具即可運作的角色（researcher、accountant 等）不需要在此登記任何項目。
import { createInternalApiTool } from '../tools'
import { listDormantCustomersTool, sendCustomerMessageTool } from '../tools/cs_customers'
import { listCandidatesTool, updateCandidateStageTool, sendCandidateEmailTool } from '../tools/hr_candidates'
import { listUncategorizedCashflowTool, updateCashflowCategoryTool } from '../tools/finance_cashflow'
import { listCalendarEventsTool, createCalendarEventTool, summarizeInboxTool } from '../tools/secretary'
import { readRepoFileTool, proposeCodeChangeTool } from '../tools/code_agent'
import { listRecentUploadsTool, analyzeComplianceImageTool } from '../tools/compliance'
import type { AgentToolDef } from '../types'

const collectTool = createInternalApiTool(
  'collect_market_data',
  '從網路（新聞/網頁/地圖/社群平台/電商平台）蒐集與關鍵字相關的原始資料，回傳文字摘要。',
  '/api/marketing/collect',
  {
    type: 'object',
    properties: {
      types: {
        type: 'array',
        items: { type: 'string', enum: ['web', 'news', 'map', 'facebook', 'instagram', 'tiktok', 'youtube', 'threads', 'amazon', 'shopee', 'ios_android'] },
        description: '要蒐集的資料來源類型',
      },
      keywords: { type: 'string', description: '搜尋關鍵字/主題' },
      location: { type: 'string', description: '地區限制（選填）' },
      limit: { type: 'number', description: '蒐集筆數上限，預設 10' },
    },
    required: ['types', 'keywords'],
  },
)

const copyTool = createInternalApiTool(
  'draft_marketing_copy',
  '依公司資料/分析結果/蒐集摘要產出行銷文案或開發信草稿（多種類型：facebook 貼文、IG 文案、開發信等）。',
  '/api/marketing/copy',
  {
    type: 'object',
    properties: {
      copyTypes: {
        type: 'array',
        items: { type: 'string' },
        description: "如 'facebook_post' | 'instagram_caption' | 'outreach_email'",
      },
      userInstructions: { type: 'string', description: '額外指示，如語氣、字數限制、要強調的優惠' },
      companyData: { type: 'object' },
      analysisData: { type: 'object' },
      collectedSummary: { type: 'string' },
    },
    required: ['copyTypes'],
  },
)

const analyzeTool = createInternalApiTool(
  'analyze_market',
  '針對蒐集到的資料做結構化分析（SWOT / 公司分析 / 競品動態 / 行銷洞察）。',
  '/api/marketing/analyze',
  {
    type: 'object',
    properties: {
      types: {
        type: 'array',
        items: { type: 'string', enum: ['swot', 'company', 'competitor_activity', 'competitor_performance', 'content', 'marketing'] },
      },
      collectedData: { type: 'string' },
      companyData: { type: 'object' },
      extraContext: { type: 'string' },
    },
    required: ['types'],
  },
)

const imageScriptTool = createInternalApiTool(
  'plan_image_content',
  '規劃社群配圖內容（圖片文案腳本），供後續生圖使用。',
  '/api/marketing/image-script',
  {
    type: 'object',
    properties: {
      count: { type: 'number', description: '規劃張數，預設 3' },
      platforms: { type: 'array', items: { type: 'string' } },
      companyData: { type: 'object' },
      analysisData: { type: 'object' },
      copyData: { type: 'object' },
      collectedSummary: { type: 'string' },
    },
    required: [],
  },
)

const videoScriptTool = createInternalApiTool(
  'plan_video_content',
  '規劃短影音腳本（鉤子、分鏡、口播），供後續生成影片使用。',
  '/api/marketing/video-script',
  {
    type: 'object',
    properties: {
      count: { type: 'number', description: '規劃支數，預設 2' },
      duration: { type: 'number', description: '單支秒數' },
      companyData: { type: 'object' },
      analysisData: { type: 'object' },
      copyData: { type: 'object' },
      collectedSummary: { type: 'string' },
    },
    required: [],
  },
)

export const ROLE_TOOL_SETS: Record<string, Record<string, AgentToolDef>> = {
  'lead-gen': {
    [collectTool.id]: collectTool,
    [copyTool.id]: copyTool,
  },
  'marketing-officer': {
    [collectTool.id]: collectTool,
    [analyzeTool.id]: analyzeTool,
    [copyTool.id]: copyTool,
    [imageScriptTool.id]: imageScriptTool,
    [videoScriptTool.id]: videoScriptTool,
  },
  'cs-care': {
    [listDormantCustomersTool.id]: listDormantCustomersTool,
    [sendCustomerMessageTool.id]: sendCustomerMessageTool,
  },
  'rnd': {
    [collectTool.id]: collectTool,
  },
  'pr': {
    [copyTool.id]: copyTool,
  },
  'project-marketing': {
    [copyTool.id]: copyTool,
  },
  'sales-intake': {
    [copyTool.id]: copyTool,
    [sendCustomerMessageTool.id]: sendCustomerMessageTool,
  },
  'product-visual': {
    [imageScriptTool.id]: imageScriptTool,
    [videoScriptTool.id]: videoScriptTool,
  },
  'hr-recruiter': {
    [listCandidatesTool.id]: listCandidatesTool,
    [updateCandidateStageTool.id]: updateCandidateStageTool,
    [sendCandidateEmailTool.id]: sendCandidateEmailTool,
  },
  'finance-invoice': {
    [listUncategorizedCashflowTool.id]: listUncategorizedCashflowTool,
    [updateCashflowCategoryTool.id]: updateCashflowCategoryTool,
  },
  'secretary': {
    [listCalendarEventsTool.id]: listCalendarEventsTool,
    [createCalendarEventTool.id]: createCalendarEventTool,
    [summarizeInboxTool.id]: summarizeInboxTool,
  },
  'code-agent': {
    [readRepoFileTool.id]: readRepoFileTool,
    [proposeCodeChangeTool.id]: proposeCodeChangeTool,
  },
  'edge-ai-audit': {
    [listRecentUploadsTool.id]: listRecentUploadsTool,
    [analyzeComplianceImageTool.id]: analyzeComplianceImageTool,
  },
  // researcher、accountant、procurement 純核心工具即可運作，不需額外登記
}

export function getToolsForRole(roleId: string): Record<string, AgentToolDef> {
  return ROLE_TOOL_SETS[roleId] ?? {}
}
