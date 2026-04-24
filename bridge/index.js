/**
 * AI GATE — WhatsApp Personal Bridge Server
 * 部署於 Oracle Cloud (或任何可公開訪問的 VPS)
 *
 * 環境變數:
 *   PORT           監聽埠號 (預設 3001)
 *   API_KEY        與 AI GATE 共用的 secret key
 *   AIGATE_URL     AI GATE 的主域名，例如 https://your-app.vercel.app
 */
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys'
import express from 'express'
import QRCode from 'qrcode'
import { Boom } from '@hapi/boom'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'
import pino from 'pino'

const require = createRequire(import.meta.url)
const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3001
const API_KEY = process.env.API_KEY || 'change-me-in-production'
const AIGATE_URL = process.env.AIGATE_URL || ''

const logger = pino({ level: 'warn' })

// session map: userId → { sock, qr, status, phone }
const sessions = new Map()

// ── Auth middleware ────────────────────────────────────────────────────────────
function auth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

// ── Start / reconnect a session ────────────────────────────────────────────────
async function startSession(userId) {
  // Already running
  const existing = sessions.get(userId)
  if (existing && ['qr', 'connected'].includes(existing.status)) return

  const authDir = path.join('./sessions', userId)
  fs.mkdirSync(authDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    printQRInTerminal: false,
    browser: ['AI GATE Bridge', 'Chrome', '120.0'],
  })

  const session = { sock, qr: null, status: 'connecting', userId }
  sessions.set(userId, session)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      session.qr = await QRCode.toDataURL(qr)
      session.status = 'qr'
      console.log(`[${userId}] QR ready`)
    }

    if (connection === 'open') {
      session.status = 'connected'
      session.qr = null
      const phone = sock.user?.id?.split(':')[0] ?? ''
      session.phone = phone
      console.log(`[${userId}] Connected: ${phone}`)
      // Notify AI GATE
      if (AIGATE_URL) {
        fetch(`${AIGATE_URL}/api/marketing/wa-bridge/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-bridge-key': API_KEY },
          body: JSON.stringify({ event: 'connected', userId, phone }),
        }).catch(() => {})
      }
    }

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
      const loggedOut = reason === DisconnectReason.loggedOut
      session.status = loggedOut ? 'disconnected' : 'reconnecting'
      console.log(`[${userId}] Closed, reason: ${reason}, loggedOut: ${loggedOut}`)
      if (!loggedOut) {
        setTimeout(() => startSession(userId), 5000)
      } else {
        // Remove auth files on logout
        fs.rmSync(authDir, { recursive: true, force: true })
        sessions.delete(userId)
      }
    }
  })

  // ── Handle incoming messages → forward to AI GATE ──────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      // Skip own messages and group messages
      if (msg.key.fromMe) continue
      if (msg.key.remoteJid?.endsWith('@g.us')) continue

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        ''
      if (!text.trim()) continue

      const from = msg.key.remoteJid // e.g. "60123456789@s.whatsapp.net"
      const senderPhone = from.replace('@s.whatsapp.net', '')
      const senderName = msg.pushName || senderPhone

      console.log(`[${userId}] Message from ${senderPhone}: ${text}`)

      if (AIGATE_URL) {
        fetch(`${AIGATE_URL}/api/marketing/cs-webhook/whatsapp-personal/${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: senderPhone, fromJid: from, text, senderName }),
        }).catch(e => console.error(`[${userId}] Webhook error:`, e.message))
      }
    }
  })
}

// ── API Routes ─────────────────────────────────────────────────────────────────

// Start session (called by AI GATE when user clicks 連線)
app.post('/start', auth, async (req, res) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })
  try {
    await startSession(userId)
    res.json({ ok: true, status: sessions.get(userId)?.status ?? 'starting' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Get QR code
app.get('/qr', auth, (req, res) => {
  const { userId } = req.query
  const s = sessions.get(userId)
  if (!s) return res.json({ status: 'not_started' })
  res.json({ status: s.status, qr: s.qr ?? null, phone: s.phone ?? null })
})

// Get status only
app.get('/status', auth, (req, res) => {
  const { userId } = req.query
  const s = sessions.get(userId)
  res.json({ status: s?.status ?? 'not_started', phone: s?.phone ?? null })
})

// Send a message (called by AI GATE to reply to customer)
app.post('/send', auth, async (req, res) => {
  const { userId, to, text } = req.body
  if (!userId || !to || !text) return res.status(400).json({ error: 'userId, to, text required' })
  const s = sessions.get(userId)
  if (!s || s.status !== 'connected') return res.status(503).json({ error: 'Session not connected' })
  try {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`
    await s.sock.sendMessage(jid, { text })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Disconnect / logout
app.post('/disconnect', auth, async (req, res) => {
  const { userId } = req.body
  const s = sessions.get(userId)
  if (s?.sock) {
    try { await s.sock.logout() } catch { /* ignore */ }
  }
  sessions.delete(userId)
  res.json({ ok: true })
})

// Health check (no auth needed)
app.get('/health', (_, res) => res.json({ ok: true, sessions: sessions.size }))

// ── Auto-restore sessions from saved auth files ────────────────────────────────
async function restoreSessions() {
  const sessDir = './sessions'
  if (!fs.existsSync(sessDir)) return
  const users = fs.readdirSync(sessDir)
  console.log(`Restoring ${users.length} session(s)...`)
  for (const userId of users) {
    try {
      await startSession(userId)
    } catch (e) {
      console.error(`Failed to restore session ${userId}:`, e.message)
    }
  }
}

app.listen(PORT, async () => {
  console.log(`AI GATE WhatsApp Bridge running on port ${PORT}`)
  await restoreSessions()
})
