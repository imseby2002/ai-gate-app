/**
 * GET /api/test-keys
 * 測試所有 AI API key 是否有效
 * 僅限管理員使用，測試完畢後可刪除此檔案
 */
import { NextResponse } from 'next/server'

async function testAnthropic(): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return '❌ 未設定'
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })
    if (res.ok) return '✅ 正常'
    const d = await res.json().catch(() => ({}))
    return `❌ HTTP ${res.status}：${d?.error?.message ?? res.statusText}`
  } catch (e) { return `❌ ${String(e)}` }
}

async function testGoogleAI(): Promise<string> {
  const key = process.env.GOOGLE_AI_API_KEY
  if (!key) return '❌ 未設定'
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { maxOutputTokens: 5 } }),
      }
    )
    if (res.ok) return '✅ 正常'
    const d = await res.json().catch(() => ({}))
    return `❌ HTTP ${res.status}：${d?.error?.message ?? res.statusText}`
  } catch (e) { return `❌ ${String(e)}` }
}

async function testOpenAI(): Promise<string> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return '❌ 未設定'
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
    })
    if (res.ok) return '✅ 正常'
    const d = await res.json().catch(() => ({}))
    return `❌ HTTP ${res.status}：${d?.error?.message ?? res.statusText}`
  } catch (e) { return `❌ ${String(e)}` }
}

async function testOpenRouter(): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return '❌ 未設定'
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'openai/gpt-4o-mini', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
    })
    if (res.ok) return '✅ 正常'
    const d = await res.json().catch(() => ({}))
    return `❌ HTTP ${res.status}：${d?.error?.message ?? res.statusText}`
  } catch (e) { return `❌ ${String(e)}` }
}

async function testDeepSeek(): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) return '❌ 未設定'
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'deepseek-chat', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
    })
    if (res.ok) return '✅ 正常'
    const d = await res.json().catch(() => ({}))
    return `❌ HTTP ${res.status}：${d?.error?.message ?? res.statusText}`
  } catch (e) { return `❌ ${String(e)}` }
}

async function testElevenLabs(): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return '❌ 未設定'
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': key },
    })
    if (res.ok) return '✅ 正常'
    return `❌ HTTP ${res.status}：${res.statusText}`
  } catch (e) { return `❌ ${String(e)}` }
}

async function testFalAI(): Promise<string> {
  const key = process.env.FAL_AI_API_KEY
  if (!key) return '❌ 未設定'
  try {
    const res = await fetch('https://fal.run/fal-ai/fast-sdxl', {
      method: 'POST',
      headers: { 'Authorization': `Key ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'test', num_images: 1, image_size: 'square_hd' }),
    })
    // fal.ai 會排隊，200/202 都算正常
    if (res.status === 200 || res.status === 202) return '✅ 正常'
    const d = await res.json().catch(() => ({}))
    return `❌ HTTP ${res.status}：${d?.detail ?? res.statusText}`
  } catch (e) { return `❌ ${String(e)}` }
}

async function testTavily(): Promise<string> {
  const key = process.env.TAVILY_API_KEY
  if (!key) return '❌ 未設定'
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: key, query: 'test', max_results: 1 }),
    })
    if (res.ok) return '✅ 正常'
    const d = await res.json().catch(() => ({}))
    return `❌ HTTP ${res.status}：${d?.detail ?? res.statusText}`
  } catch (e) { return `❌ ${String(e)}` }
}

async function testOutscraper(): Promise<string> {
  const key = process.env.OUTSCRAPER_API_KEY
  if (!key) return '❌ 未設定'
  try {
    const res = await fetch(`https://api.app.outscraper.com/account`, {
      headers: { 'X-API-KEY': key },
    })
    if (res.ok) return '✅ 正常'
    return `❌ HTTP ${res.status}：${res.statusText}`
  } catch (e) { return `❌ ${String(e)}` }
}

async function testHeyGen(): Promise<string> {
  const key = process.env.HEYGEN_API_KEY
  if (!key) return '❌ 未設定'
  try {
    const res = await fetch('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': key },
    })
    if (res.ok) return '✅ 正常'
    return `❌ HTTP ${res.status}：${res.statusText}`
  } catch (e) { return `❌ ${String(e)}` }
}

async function testYouTube(): Promise<string> {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) return '❌ 未設定'
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${key}`)
    if (res.ok) return '✅ 正常'
    const d = await res.json().catch(() => ({}))
    return `❌ HTTP ${res.status}：${d?.error?.message ?? res.statusText}`
  } catch (e) { return `❌ ${String(e)}` }
}

export async function GET(req: Request) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  void req
  const [anthropic, googleAI, openai, openrouter, deepseek, elevenlabs, falAI, tavily, outscraper, heygen, youtube] =
    await Promise.all([
      testAnthropic(),
      testGoogleAI(),
      testOpenAI(),
      testOpenRouter(),
      testDeepSeek(),
      testElevenLabs(),
      testFalAI(),
      testTavily(),
      testOutscraper(),
      testHeyGen(),
      testYouTube(),
    ])

  return NextResponse.json({
    tested_at: new Date().toISOString(),
    results: {
      'Anthropic (Claude)':   anthropic,
      'Google AI (Gemini)':   googleAI,
      'OpenAI':               openai,
      'OpenRouter':           openrouter,
      'DeepSeek':             deepseek,
      'ElevenLabs':           elevenlabs,
      'Fal.ai':               falAI,
      'Tavily':               tavily,
      'Outscraper':           outscraper,
      'HeyGen':               heygen,
      'YouTube Data API':     youtube,
    },
  })
}
