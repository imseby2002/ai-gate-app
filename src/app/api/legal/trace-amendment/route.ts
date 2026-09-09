import { NextRequest, NextResponse } from 'next/server'
import { SEED_LEGAL_DOCUMENTS, SEED_LEGAL_NODES } from '@/lib/legal/seeds'
import { TemporalValidityEngine } from '@/lib/legal/temporal'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const documentNumber = searchParams.get('document_number') || '15/2018/NĐ-CP'
    const article = searchParams.get('article') || 'Điều 4'
    const targetDate = searchParams.get('target_date') || new Date().toISOString().slice(0, 10)

    const doc = SEED_LEGAL_DOCUMENTS.find(d => d.document_number.toLowerCase().includes(documentNumber.toLowerCase()))
    if (!doc) {
      return NextResponse.json({ error: `Document ${documentNumber} not found` }, { status: 404 })
    }

    const matchedNodes = SEED_LEGAL_NODES.filter(
      n => n.document_id === doc.id && n.article_number.toLowerCase() === article.toLowerCase()
    )

    const temporalEngine = new TemporalValidityEngine()
    const validity = temporalEngine.evaluateValidity(
      doc.effective_date,
      doc.expiry_date,
      doc.status,
      targetDate
    )

    return NextResponse.json({
      success: true,
      document: {
        number: doc.document_number,
        title_vi: doc.title_vi,
        title_zh: doc.title_zh,
        type: doc.document_type,
        issue_date: doc.issue_date,
        effective_date: doc.effective_date,
        status: doc.status,
        official_url: doc.source_url,
      },
      article: article,
      temporal_evaluation: validity,
      nodes: matchedNodes.map(n => ({
        locator: n.node_locator,
        text_vi: n.original_text_vi,
        text_zh: n.translated_text_zh,
        effective_from: n.effective_from,
        status: n.status,
      })),
      amendment_timeline: [
        {
          version_date: doc.effective_date,
          status: 'ORIGINAL_ENACTED',
          document_number: doc.document_number,
          summary: 'Ban hành áp dụng toàn quốc',
        }
      ],
    })
  } catch (error) {
    console.error('[API /api/legal/trace-amendment] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error while tracing amendment' },
      { status: 500 }
    )
  }
}
