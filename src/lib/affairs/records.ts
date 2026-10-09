// 外務擴充資料表（門市開發、關係維護、往來紀錄、租金評比）的欄位白名單。
// /api/affairs/records/[kind] 依此清洗輸入，未列出的欄位一律忽略。

type FieldType = 'text' | 'num' | 'int' | 'date' | 'json'

export interface RecordSpec {
  table: string
  fields: Record<string, FieldType>
  required: string[]
  order: { column: string; ascending: boolean }
  hasUpdatedAt: boolean
}

export const SITE_CATEGORIES = ['street', 'mall', 'public', 'private'] as const
export const SITE_SUBTYPES: Record<string, string[]> = {
  street: ['ground_large', 'ground_small', 'shop_in_shop', 'counter', 'delivery'],
  mall: ['community', 'non_community'],
  public: ['airport', 'gov_zone', 'public_other'],
  private: ['factory', 'market', 'private_other'],
}
export const SITE_STATUSES = ['prospect', 'visiting', 'negotiating', 'applying', 'reviewing', 'approved', 'signed', 'rejected', 'dropped'] as const

export const CONTACT_CATEGORIES = ['landlord', 'mall', 'public', 'private', 'other'] as const
export const CONTACT_ORG_TYPES: Record<string, string[]> = {
  landlord: [],
  mall: [],
  public: ['investment', 'health', 'market_security', 'economic_security', 'tax', 'fire', 'environment', 'labor', 'customs', 'airport', 'gov_zone', 'public_other'],
  private: ['factory', 'market', 'private_other'],
  other: [],
}
export const LOG_KINDS = ['visit', 'call', 'meal', 'gift', 'meeting', 'message', 'other'] as const

export const RECORD_SPECS: Record<string, RecordSpec> = {
  sites: {
    table: 'affair_sites',
    fields: {
      name: 'text', category: 'text', subtype: 'text', address: 'text', region: 'text', floor: 'text',
      area_sqm: 'num', frontage_m: 'num', monthly_rent: 'num', deposit: 'num', households: 'int',
      contact_id: 'text', status: 'text', application_deadline: 'date', application: 'json', notes: 'text',
    },
    required: ['name'],
    order: { column: 'updated_at', ascending: false },
    hasUpdatedAt: true,
  },
  contacts: {
    table: 'affair_contacts',
    fields: {
      category: 'text', org_type: 'text', name: 'text', title: 'text', organization: 'text', phone: 'text',
      email: 'text', im: 'text', region: 'text', traits: 'text', importance: 'int', last_contact_at: 'date',
      next_followup: 'date', store_code: 'text', notes: 'text',
    },
    required: ['name'],
    order: { column: 'updated_at', ascending: false },
    hasUpdatedAt: true,
  },
  logs: {
    table: 'affair_contact_logs',
    fields: { contact_id: 'text', log_date: 'date', kind: 'text', summary: 'text', next_action: 'text' },
    required: ['contact_id'],
    order: { column: 'log_date', ascending: false },
    hasUpdatedAt: false,
  },
  rents: {
    table: 'affair_rent_benchmarks',
    fields: {
      region: 'text', address: 'text', subtype: 'text', area_sqm: 'num', monthly_rent: 'num', currency: 'text',
      observed_at: 'date', source: 'text', source_url: 'text', contact_id: 'text', notes: 'text',
    },
    required: ['monthly_rent'],
    order: { column: 'observed_at', ascending: true },
    hasUpdatedAt: false,
  },
}

const ENUMS: Record<string, Record<string, readonly string[]>> = {
  sites: { category: SITE_CATEGORIES, status: SITE_STATUSES },
  contacts: { category: CONTACT_CATEGORIES },
  logs: { kind: LOG_KINDS },
  rents: { source: ['manual', 'ai'] },
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 依白名單清洗；partial=true 時只處理有傳的欄位（更新用）
export function cleanRecord(kind: string, body: Record<string, unknown>, partial: boolean): Record<string, unknown> | string {
  const spec = RECORD_SPECS[kind]
  const out: Record<string, unknown> = {}
  for (const [key, type] of Object.entries(spec.fields)) {
    if (!(key in body)) continue
    const raw = body[key]
    const str = String(raw ?? '').trim()
    if (type === 'text') {
      if (key.endsWith('_id')) out[key] = UUID.test(str) ? str : null
      else out[key] = str
    } else if (type === 'num') {
      const n = Number(str)
      out[key] = str !== '' && Number.isFinite(n) ? n : null
    } else if (type === 'int') {
      const n = parseInt(str, 10)
      out[key] = Number.isFinite(n) ? n : null
    } else if (type === 'date') {
      out[key] = /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null
    } else if (type === 'json') {
      out[key] = Array.isArray(raw) || (raw && typeof raw === 'object') ? raw : []
    }
  }
  for (const [key, allowed] of Object.entries(ENUMS[kind] ?? {})) {
    if (key in out && !allowed.includes(String(out[key]))) out[key] = allowed[0]
  }
  if (kind === 'contacts' && 'importance' in out) {
    out.importance = Math.min(5, Math.max(1, Number(out.importance) || 3))
  }
  if (!partial) {
    for (const r of spec.required) {
      if (out[r] === undefined || out[r] === null || out[r] === '') return r
    }
  }
  return out
}
