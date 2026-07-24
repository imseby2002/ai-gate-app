import type { AgentToolDef } from '../types'

export const getCompanyContextTool: AgentToolDef = {
  id: 'get_company_context',
  description: '讀取公司知識庫（產業、產品、目標客群、品牌調性、競爭優勢等），規劃前建議先讀取以確保內容符合公司實際狀況。',
  inputSchema: { type: 'object', properties: {} },
  async execute(_input, ctx) {
    const md = await ctx.getCompanyContext()
    return { compiledMd: md || '（尚未建立公司知識庫）' }
  },
}
