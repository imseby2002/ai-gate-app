// 秘書專員（secretary）專屬工具：Google Calendar / Gmail（需使用者先於 /agent 連結帳號，
// 見 /api/integrations/google-calendar/{auth,callback,status}）。
// 不含機票/飯店/餐廳訂位——這個平台沒有串接任何訂位/訂票 API，真人下決定後仍需自行預訂。
import { getValidCalendarAccessToken } from '@/lib/calendar-token'
import { listUpcomingEvents, createCalendarEvent, listRecentImportantEmails } from '@/lib/google-calendar'
import type { AgentToolDef } from '../types'

interface ListCalendarEventsInput {
  maxResults?: number
}

export const listCalendarEventsTool: AgentToolDef = {
  id: 'list_calendar_events',
  description: '讀取老闆 Google 日曆上即將到來的行程。',
  inputSchema: {
    type: 'object',
    properties: {
      maxResults: { type: 'number', description: '讀取筆數上限，預設 10' },
    },
    required: [],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as ListCalendarEventsInput
    const token = await getValidCalendarAccessToken(ctx.userId)
    if (!token) return { error: '尚未連結 Google 日曆，請至 agent 頁面完成連結。' }
    const events = await listUpcomingEvents(token, input.maxResults ?? 10)
    return { events }
  },
}

interface CreateCalendarEventInput {
  summary: string
  description?: string
  start: string
  end: string
  location?: string
}

export const createCalendarEventTool: AgentToolDef = {
  id: 'create_calendar_event',
  description: '在老闆的 Google 日曆上建立一個事件（僅限老闆自己的日曆，不會邀請或通知外部對象）。',
  inputSchema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: '事件標題' },
      description: { type: 'string' },
      start: { type: 'string', description: 'ISO 8601 開始時間，如 2026-08-01T14:00:00+08:00' },
      end: { type: 'string', description: 'ISO 8601 結束時間' },
      location: { type: 'string' },
    },
    required: ['summary', 'start', 'end'],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as CreateCalendarEventInput
    const token = await getValidCalendarAccessToken(ctx.userId)
    if (!token) return { error: '尚未連結 Google 日曆，請至 agent 頁面完成連結。' }
    const result = await createCalendarEvent(token, input)
    return result
  },
}

interface SummarizeInboxInput {
  maxResults?: number
}

export const summarizeInboxTool: AgentToolDef = {
  id: 'summarize_inbox',
  description: '讀取老闆信箱中近期重要（未讀、非廣告/社群通知）的信件標題與摘要，供彙整回報。唯讀，不會回覆或刪除信件。',
  inputSchema: {
    type: 'object',
    properties: {
      maxResults: { type: 'number', description: '讀取封數上限，預設 10' },
    },
    required: [],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as SummarizeInboxInput
    const token = await getValidCalendarAccessToken(ctx.userId)
    if (!token) return { error: '尚未連結 Google 信箱，請至 agent 頁面完成連結。' }
    const emails = await listRecentImportantEmails(token, input.maxResults ?? 10)
    return { emails }
  },
}
