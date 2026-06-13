/**
 * Schema.org JSON-LD 強化 — 由素材庫商家檔案/作者，確定性地注入 LocalBusiness 與 Person，
 * 不依賴 LLM 自行編造（地址/電話/座標必須真實），強化在地 E-E-A-T 與被引用率。
 */
export interface BusinessProfile {
  name?: string
  type?: string          // LocalBusiness | TravelAgency | Restaurant | Store | Organization ...
  url?: string
  phone?: string
  streetAddress?: string
  city?: string
  region?: string
  country?: string
  latitude?: string | number
  longitude?: string | number
  openingHours?: string
  priceRange?: string
  sameAs?: string[]
}

export interface AuthorProfile {
  name?: string
  jobTitle?: string
  bio?: string
  url?: string
  sameAs?: string[]
}

export interface Material {
  business?: BusinessProfile | null
  authors?: AuthorProfile[]
  facts?: { label?: string; text?: string }[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = Record<string, any>

function buildBusiness(b: BusinessProfile): Node | null {
  if (!b?.name) return null
  const node: Node = {
    '@type': b.type || 'LocalBusiness',
    '@id': '#business',
    name: b.name,
  }
  if (b.url) node.url = b.url
  if (b.phone) node.telephone = b.phone
  if (b.priceRange) node.priceRange = b.priceRange
  if (b.streetAddress || b.city || b.region || b.country) {
    node.address = {
      '@type': 'PostalAddress',
      ...(b.streetAddress ? { streetAddress: b.streetAddress } : {}),
      ...(b.city ? { addressLocality: b.city } : {}),
      ...(b.region ? { addressRegion: b.region } : {}),
      ...(b.country ? { addressCountry: b.country } : {}),
    }
  }
  if (b.latitude && b.longitude) {
    node.geo = { '@type': 'GeoCoordinates', latitude: String(b.latitude), longitude: String(b.longitude) }
  }
  if (b.openingHours) node.openingHours = b.openingHours
  if (b.sameAs?.length) node.sameAs = b.sameAs
  return node
}

function buildPerson(a: AuthorProfile): Node | null {
  if (!a?.name) return null
  const node: Node = { '@type': 'Person', '@id': '#author', name: a.name }
  if (a.jobTitle) node.jobTitle = a.jobTitle
  if (a.bio) node.description = a.bio
  if (a.url) node.url = a.url
  if (a.sameAs?.length) node.sameAs = a.sameAs
  return node
}

/** 把 LLM 產出的 JSON-LD 正規化為 @graph 陣列並注入商家/作者節點。 */
export function enrichJsonLd(jsonLd: unknown, material: Material): unknown {
  // 取出既有節點
  let graph: Node[] = []
  if (jsonLd && typeof jsonLd === 'object') {
    const obj = jsonLd as Node
    if (Array.isArray(obj['@graph'])) graph = obj['@graph']
    else if (Array.isArray(jsonLd)) graph = jsonLd as Node[]
    else graph = [obj]
  }

  const business = material.business ? buildBusiness(material.business) : null
  const person = material.authors?.length ? buildPerson(material.authors[0]) : null

  if (business) {
    // 移除 LLM 既有的 Organization/LocalBusiness，改用真實商家資料
    graph = graph.filter(n => !/Organization|LocalBusiness/i.test(String(n?.['@type'] ?? '')))
    graph.push(business)
  }
  if (person) {
    graph = graph.filter(n => String(n?.['@type'] ?? '') !== 'Person')
    graph.push(person)
    // Article 節點掛 author 參照
    for (const n of graph) {
      if (/Article|BlogPosting|NewsArticle/i.test(String(n?.['@type'] ?? ''))) {
        n.author = { '@id': '#author' }
        if (business) n.publisher = { '@id': '#business' }
      }
    }
  }

  if (graph.length === 0) return jsonLd
  return { '@context': 'https://schema.org', '@graph': graph }
}
