// 代理實測：經代理連到 ipinfo.io 取得出口 IP／國家／城市／ISP，並量測建立通道的延遲。
// 僅用 Node 內建 net／tls，支援 HTTP(S) CONNECT 與 SOCKS5（含帳密）。
import net from 'node:net'
import tls from 'node:tls'
import dns from 'node:dns/promises'

export interface ProxyTestInput {
  protocol: 'http' | 'https' | 'socks5'
  host: string
  port: number
  username?: string | null
  password?: string | null
}

export interface ProxyTestResult {
  ok: boolean
  latency_ms: number
  ip?: string
  country?: string
  city?: string
  org?: string
  error?: string
}

const TARGET_HOST = 'ipinfo.io'
const TARGET_PORT = 443
const TIMEOUT_MS = 12000

// 防 SSRF：代理主機不可解析到內網／保留位址
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const v = ip.toLowerCase()
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:')
}

function readUntil(socket: net.Socket, predicate: (buf: Buffer) => boolean): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0)
    const onData = (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk])
      if (predicate(buf)) { cleanup(); resolve(buf) }
    }
    const onEnd = () => { cleanup(); reject(new Error('代理提前關閉連線')) }
    const onError = (e: Error) => { cleanup(); reject(e) }
    const cleanup = () => { socket.off('data', onData); socket.off('end', onEnd); socket.off('error', onError) }
    socket.on('data', onData)
    socket.once('end', onEnd)
    socket.once('error', onError)
  })
}

function connectTcp(host: string, port: number, useTls: boolean): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const s = useTls
      ? tls.connect({ host, port, servername: net.isIP(host) ? undefined : host }, () => resolve(s))
      : net.connect({ host, port }, () => resolve(s))
    s.once('error', reject)
  })
}

async function openHttpTunnel(p: ProxyTestInput): Promise<net.Socket> {
  const s = await connectTcp(p.host, p.port, p.protocol === 'https')
  const auth = p.username ? `Proxy-Authorization: Basic ${Buffer.from(`${p.username}:${p.password ?? ''}`).toString('base64')}\r\n` : ''
  s.write(`CONNECT ${TARGET_HOST}:${TARGET_PORT} HTTP/1.1\r\nHost: ${TARGET_HOST}:${TARGET_PORT}\r\n${auth}\r\n`)
  const head = (await readUntil(s, b => b.includes('\r\n\r\n'))).toString('latin1')
  const status = head.split('\r\n')[0]
  if (!/^HTTP\/1\.[01] 200/.test(status)) {
    s.destroy()
    throw new Error(/ 407/.test(status) ? '代理帳號或密碼錯誤（407）' : `代理拒絕連線：${status}`)
  }
  return s
}

async function openSocks5Tunnel(p: ProxyTestInput): Promise<net.Socket> {
  const s = await connectTcp(p.host, p.port, false)
  const useAuth = !!p.username
  s.write(Buffer.from(useAuth ? [5, 1, 2] : [5, 1, 0]))
  const greet = await readUntil(s, b => b.length >= 2)
  if (greet[0] !== 5 || greet[1] === 0xff) { s.destroy(); throw new Error('SOCKS5 代理不接受此驗證方式') }
  if (greet[1] === 2) {
    const u = Buffer.from(p.username ?? ''), pw = Buffer.from(p.password ?? '')
    s.write(Buffer.concat([Buffer.from([1, u.length]), u, Buffer.from([pw.length]), pw]))
    const authRes = await readUntil(s, b => b.length >= 2)
    if (authRes[1] !== 0) { s.destroy(); throw new Error('代理帳號或密碼錯誤') }
  }
  const host = Buffer.from(TARGET_HOST)
  s.write(Buffer.concat([Buffer.from([5, 1, 0, 3, host.length]), host, Buffer.from([TARGET_PORT >> 8, TARGET_PORT & 0xff])]))
  const reply = await readUntil(s, b => b.length >= 10)
  if (reply[1] !== 0) { s.destroy(); throw new Error(`SOCKS5 連線失敗（代碼 ${reply[1]}）`) }
  return s
}

async function run(p: ProxyTestInput): Promise<ProxyTestResult> {
  if (!p.host || !p.port) return { ok: false, latency_ms: 0, error: '缺少主機或通訊埠' }
  const addrs = await dns.lookup(p.host, { all: true }).catch(() => [])
  if (addrs.length === 0) return { ok: false, latency_ms: 0, error: `無法解析主機 ${p.host}` }
  if (addrs.some(a => isPrivateIp(a.address))) return { ok: false, latency_ms: 0, error: '不允許測試內網或保留位址' }

  const started = Date.now()
  const tunnel = p.protocol === 'socks5' ? await openSocks5Tunnel(p) : await openHttpTunnel(p)
  const latency = Date.now() - started

  const secure = tls.connect({ socket: tunnel, servername: TARGET_HOST })
  await new Promise<void>((resolve, reject) => { secure.once('secureConnect', resolve); secure.once('error', reject) })
  secure.write(`GET /json HTTP/1.1\r\nHost: ${TARGET_HOST}\r\nAccept: application/json\r\nUser-Agent: ai-gate-proxy-test\r\nConnection: close\r\n\r\n`)
  const raw = await new Promise<string>((resolve, reject) => {
    let out = ''
    secure.on('data', (c: Buffer) => { out += c.toString('utf8') })
    secure.once('end', () => resolve(out))
    secure.once('close', () => resolve(out))
    secure.once('error', reject)
  })
  secure.destroy()

  const body = raw.slice(raw.indexOf('\r\n\r\n') + 4)
  const json = body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1)
  try {
    const info = JSON.parse(json) as { ip?: string; country?: string; city?: string; org?: string }
    if (!info.ip) throw new Error('no ip')
    return { ok: true, latency_ms: latency, ip: info.ip, country: info.country, city: info.city, org: info.org }
  } catch {
    return { ok: true, latency_ms: latency, error: '通道已建立，但無法取得出口 IP 資訊' }
  }
}

export async function testProxy(p: ProxyTestInput): Promise<ProxyTestResult> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<ProxyTestResult>(resolve => {
    timer = setTimeout(() => resolve({ ok: false, latency_ms: 0, error: `連線逾時（${TIMEOUT_MS / 1000} 秒）` }), TIMEOUT_MS)
  })
  try {
    return await Promise.race([run(p).catch(e => ({ ok: false, latency_ms: 0, error: e instanceof Error ? e.message : String(e) })), timeout])
  } finally {
    clearTimeout(timer)
  }
}
