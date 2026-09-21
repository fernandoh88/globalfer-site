import assert from 'node:assert/strict'
import { once } from 'node:events'
import http from 'node:http'
import net from 'node:net'
import { mock, test } from 'node:test'
import nodemailer from 'nodemailer'

// Exercise the installed Nodemailer MIME composer using its in-memory transport.
// No SMTP host, credentials, URL, or production transport options reach it.
const createMemoryTransport = nodemailer.createTransport.bind(nodemailer)
mock.method(nodemailer, 'createTransport', () => {
  assert.fail('Only the explicitly configured in-memory transport is allowed.')
})
const { createApp } = await import('../server/app.js')

const env = {
  NODE_ENV: 'test',
  FRONTEND_URL: 'https://globalfer.example.test',
  QUOTE_EMAIL_TO: 'quotes@example.test',
  SMTP_FROM: 'Globalfer <website@example.test>',
  SMTP_HOST: 'never-connect.example.test',
  SMTP_PORT: '587',
  SMTP_USER: 'smtp-user@example.test',
  SMTP_PASS: 'fake-password-never-used',
}

const validQuote = () => ({
  name: 'José Silva',
  phone: '14999990000',
  city: 'Marília',
  message: 'Favor informar o prazo.',
  items: [{ product: 'Tubo de aço', measurements: '2 peças de 6 metros' }],
})

async function fixture(t) {
  const generated = []
  const app = createApp({
    env,
    logger: { error() {} },
    createTransport: () => {
      const transport = createMemoryTransport({
        streamTransport: true,
        buffer: true,
        newline: 'windows',
        disableFileAccess: true,
        disableUrlAccess: true,
      })
      return {
        async sendMail(mail) {
          // The incoming loopback HTTP connection already exists. Any outgoing
          // socket connection during real MIME generation fails this test.
          const networkGuard = t.mock.method(net.Socket.prototype, 'connect', () => {
            assert.fail('Mail generation must never open an SMTP or other network connection.')
          })
          try {
            const result = await transport.sendMail(mail)
            assert.equal(networkGuard.mock.callCount(), 0)
            generated.push(result)
            return result
          } finally {
            networkGuard.mock.restore()
          }
        },
      }
    },
  })
  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
    server.closeAllConnections?.()
  }))
  await once(server, 'listening')
  return { port: server.address().port, generated }
}

function post(server, quote) {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(quote)
    const req = http.request({
      host: '127.0.0.1',
      port: server.port,
      method: 'POST',
      path: '/api/orcamento',
      headers: {
        Connection: 'close',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(raw),
      },
    }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('error', reject)
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }))
    })
    req.on('error', reject)
    req.setTimeout(5000, () => req.destroy(new Error('Loopback HTTP test request timed out.')))
    req.end(raw)
  })
}

function splitMime(raw) {
  const separator = raw.indexOf('\r\n\r\n')
  assert.ok(separator >= 0, 'MIME message must separate headers from body.')
  const headerText = raw.slice(0, separator).replace(/\r\n[ \t]+/g, ' ')
  const headers = new Map()
  for (const line of headerText.split('\r\n')) {
    const colon = line.indexOf(':')
    assert.ok(colon > 0, 'MIME header must contain its field name.')
    const name = line.slice(0, colon).toLowerCase()
    assert.ok(!headers.has(name), `Unexpected duplicate MIME header: ${name}`)
    headers.set(name, line.slice(colon + 1).trim())
  }
  return { headers, body: raw.slice(separator + 4) }
}

function decodeQuotedPrintable(raw) {
  return Buffer.from(
    raw.replace(/=\r?\n/g, '').replace(/=([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16))),
    'latin1',
  ).toString('utf8')
}

function decodeHeader(raw) {
  return raw.replace(/\?=\s+=\?/g, '?==?').replace(/=\?utf-8\?([bq])\?([^?]*)\?=/gi, (_, encoding, value) => (
    encoding.toLowerCase() === 'b'
      ? Buffer.from(value, 'base64').toString('utf8')
      : decodeQuotedPrintable(value.replaceAll('_', ' '))
  ))
}

function readMessage(result) {
  assert.ok(Buffer.isBuffer(result.message))
  const message = splitMime(result.message.toString('utf8'))
  assert.match(message.headers.get('content-type'), /^multipart\/alternative;/i)
  const boundary = message.headers.get('content-type').match(/boundary="([^"]+)"/)[1]
  const parts = message.body.split(`--${boundary}`).slice(1, -1).map((raw) => {
    const part = splitMime(raw.replace(/^\r\n/, ''))
    const encoding = part.headers.get('content-transfer-encoding')
    const body = encoding === 'base64'
      ? Buffer.from(part.body, 'base64').toString('utf8')
      : encoding === 'quoted-printable' ? decodeQuotedPrintable(part.body) : part.body
    return { type: part.headers.get('content-type'), body }
  })
  assert.equal(parts.length, 2)
  return {
    ...message,
    text: parts.find((part) => /^text\/plain;/i.test(part.type))?.body,
    html: parts.find((part) => /^text\/html;/i.test(part.type))?.body,
  }
}

test('installed Nodemailer composes UTF-8 multipart quotes with a fixed envelope and safe headers', async (t) => {
  const server = await fixture(t)
  const quote = validQuote()
  quote.name = '  José <img src=x onerror=alert(1)> & "Silva"  '
  quote.message = 'Olá\r\nTo: victim@evil.test\r\nCc: victim@evil.test\r\nBcc: victim@evil.test\r\nSubject: attacker-changed'
  quote.items[0].measurements = '<script>alert(1)</script>\n2 & 3 metros'
  const response = await post(server, quote)
  assert.equal(response.status, 200)
  assert.equal(server.generated.length, 1)
  const result = server.generated[0]
  assert.deepEqual(result.envelope, { from: 'website@example.test', to: [env.QUOTE_EMAIL_TO] })
  const message = readMessage(result)
  assert.equal(message.headers.get('from'), env.SMTP_FROM)
  assert.equal(message.headers.get('to'), env.QUOTE_EMAIL_TO)
  assert.equal(message.headers.get('reply-to'), env.SMTP_USER)
  assert.equal(message.headers.get('cc'), undefined)
  assert.equal(message.headers.get('bcc'), undefined)
  assert.ok(decodeHeader(message.headers.get('subject')).endsWith(quote.name.trim()))
  assert.doesNotMatch(decodeHeader(message.headers.get('subject')), /attacker-changed|[\r\n]/)
  assert.ok(message.text.includes('José <img'))
  assert.ok(message.text.includes('Marília'))
  assert.ok(message.text.includes('Tubo de aço'))
  assert.ok(message.text.includes('Bcc: victim@evil.test'))
  assert.ok(message.text.includes('Subject: attacker-changed'))
  assert.ok(message.html.includes('&lt;img'))
  assert.ok(message.html.includes('&lt;script&gt;'))
  assert.ok(message.html.includes('&amp;'))
  assert.ok(message.html.includes('&quot;'))
  assert.doesNotMatch(message.html, /<img|<script/i)
  assert.ok(message.html.includes('<br>'))
})

test('CR/LF visitor names are rejected before reaching the real Nodemailer composer', async (t) => {
  const server = await fixture(t)
  const response = await post(server, { ...validQuote(), name: 'Maria\r\nBcc: victim@evil.test' })
  assert.equal(response.status, 400)
  assert.equal(server.generated.length, 0)
})
