import assert from 'node:assert/strict'
import { once } from 'node:events'
import http from 'node:http'
import { after, mock, test } from 'node:test'
import nodemailer from 'nodemailer'

// Install this guard before loading application code. Every fixture injects its
// own fake factory, and an accidental real Nodemailer factory call also fails.
mock.method(nodemailer, 'createTransport', () => {
  assert.fail('Real SMTP transports are forbidden in this test suite.')
})
const forbiddenFetch = mock.method(globalThis, 'fetch', () => {
  assert.fail('External fetch requests are forbidden in this test suite.')
})
after(() => assert.equal(forbiddenFetch.mock.callCount(), 0, 'No test may use the default network fetch.'))
const { createApp } = await import('../server/app.js')
const { createWhatsAppNotifier } = await import('../server/whatsapp.js')

const fakeEnv = {
  NODE_ENV: 'test',
  FRONTEND_URL: 'https://globalfer.example.test',
  QUOTE_EMAIL_TO: 'quotes@example.test',
  SMTP_FROM: 'Globalfer <website@example.test>',
  SMTP_HOST: 'smtp-private.example.test',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: 'smtp-user-private@example.test',
  SMTP_PASS: 'smtp-password-private-sentinel',
}

const validQuote = () => ({
  name: 'Maria Silva',
  phone: '(14) 99999-0000',
  city: 'Marília',
  message: 'Favor informar o prazo.',
  items: [{ product: 'Tubo de aço', measurements: '2 peças de 6 metros' }],
})

async function fixture(t, { env = {}, sendMail, createTransport, createWhatsAppNotifier, now } = {}) {
  const sent = []
  const transports = []
  const logs = []
  const logger = Object.fromEntries(
    ['error', 'warn', 'info', 'log', 'debug'].map((level) => [
      level,
      (...args) => logs.push({ level, args }),
    ]),
  )
  const app = createApp({
    env: { ...fakeEnv, ...env },
    logger,
    now,
    createWhatsAppNotifier,
    createTransport: (options) => {
      transports.push(options)
      if (createTransport) return createTransport(options)
      return {
        async sendMail(mail) {
          sent.push(mail)
          if (sendMail) return sendMail(mail)
          return { messageId: 'fake-message-id', accepted: [fakeEnv.QUOTE_EMAIL_TO] }
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
  return { app, server, port: server.address().port, sent, transports, logs }
}

function request(server, { method = 'POST', path = '/api/orcamento', raw, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const outgoingHeaders = { Connection: 'close', ...headers }
    if (raw !== undefined) outgoingHeaders['Content-Length'] = Buffer.byteLength(raw)
    const req = http.request({
      host: '127.0.0.1',
      port: server.port,
      method,
      path,
      headers: outgoingHeaders,
    }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('error', reject)
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let body
        try { body = JSON.parse(text) } catch { /* Preserve non-JSON failures for assertions. */ }
        resolve({ status: res.statusCode, headers: res.headers, text, body })
      })
    })
    req.on('error', reject)
    req.setTimeout(5000, () => req.destroy(new Error('Loopback HTTP test request timed out.')))
    req.end(raw)
  })
}

function post(server, body = validQuote(), headers = {}) {
  return request(server, {
    raw: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function assertHeaders(response, production = false) {
  assert.equal(response.headers['x-content-type-options'], 'nosniff')
  assert.equal(response.headers['x-frame-options'], 'DENY')
  assert.equal(response.headers['referrer-policy'], 'strict-origin-when-cross-origin')
  assert.equal(response.headers['permissions-policy'], 'camera=(), microphone=(), geolocation=()')
  assert.equal(response.headers['x-powered-by'], undefined)
  assert.equal(
    response.headers['strict-transport-security'],
    production ? 'max-age=31536000; includeSubDomains' : undefined,
  )
}

function assertSafe(response) {
  assert.match(response.headers['content-type'] || '', /^application\/json\b/)
  assert.equal(typeof response.body?.message, 'string')
  for (const value of [
    fakeEnv.SMTP_HOST,
    fakeEnv.SMTP_USER,
    fakeEnv.SMTP_PASS,
    'SMTP_PASS',
    'SMTP_USER',
    'SMTP_HOST',
    'provider-auth-private-sentinel',
    'environment-private-sentinel',
    'filesystem-private-sentinel',
    'attacker-payload-private-sentinel',
  ]) {
    assert.ok(!response.text.includes(value), `Response exposed forbidden marker: ${value}`)
  }
  assert.doesNotMatch(response.text, /node_modules|Error:|\bat\s+\S+\s*\(|[A-Za-z]:\\\\/)
  assertHeaders(response)
}

async function assertRejected(t, body, status = 400) {
  const server = await fixture(t)
  const response = await post(server, body)
  assert.equal(response.status, status)
  assertSafe(response)
  assert.equal(server.transports.length, 0)
  assert.equal(server.sent.length, 0)
  return response
}

test('valid quote trims values, escapes email HTML, and uses only configured headers', async (t) => {
  const server = await fixture(t)
  const quote = {
    name: '  Maria <img src=x onerror=alert(1)> & "Silva" \'Junior\'  ',
    phone: '  <b>14999990000</b>  ',
    city: '  <script>alert(2)</script>  ',
    message: '  <img src=x onerror=alert(3)>\nObrigado & até breve  ',
    items: [{ product: '  <svg onload=alert(4)>  ', measurements: '  <iframe>\n2 & 3 metros  ' }],
  }
  const response = await post(server, quote, { 'Content-Type': 'application/json; charset=utf-8' })
  assert.equal(response.status, 200)
  assertSafe(response)
  assert.equal(server.sent.length, 1)
  assert.equal(server.transports.length, 1)
  assert.equal(server.transports[0].host, fakeEnv.SMTP_HOST)
  assert.equal(server.transports[0].auth.user, fakeEnv.SMTP_USER)
  assert.equal(server.transports[0].auth.pass, fakeEnv.SMTP_PASS)
  const mail = server.sent[0]
  assert.equal(mail.from, fakeEnv.SMTP_FROM)
  assert.equal(mail.to, fakeEnv.QUOTE_EMAIL_TO)
  assert.equal(mail.replyTo, fakeEnv.SMTP_USER)
  for (const field of ['cc', 'bcc', 'envelope', 'headers']) assert.equal(mail[field], undefined)
  assert.ok(mail.subject.endsWith(quote.name.trim()))
  assert.doesNotMatch(mail.subject, /[\r\n]/)
  for (const value of [quote.name, quote.phone, quote.city, quote.message, quote.items[0].product, quote.items[0].measurements]) {
    assert.ok(mail.text.includes(value.trim()))
    assert.ok(!mail.text.includes(value))
  }
  assert.doesNotMatch(mail.html, /<script|<img|<svg|<iframe|<b>/i)
  for (const escaped of ['&lt;img', '&lt;script&gt;', '&lt;svg', '&lt;iframe&gt;', '&amp;', '&quot;', '&#039;']) {
    assert.ok(mail.html.includes(escaped), `Missing HTML escape: ${escaped}`)
  }
  assert.ok(mail.html.includes('<br>'))
})

const defaultQuoteRecipients = 'fernando403@gmail.com,globalfer_marilia@yahoo.com.br'
for (const [label, configured, expected] of [
  ['unset configuration', undefined, defaultQuoteRecipients],
  ['empty configuration', '', defaultQuoteRecipients],
  ['one configured recipient', 'override@example.test', 'override@example.test'],
  ['multiple configured recipients', 'first@example.test,second@example.test', 'first@example.test,second@example.test'],
]) {
  test(`quote recipients honor ${label} in one mail call`, async (t) => {
    const server = await fixture(t, { env: { QUOTE_EMAIL_TO: configured } })
    const response = await post(server)
    assert.equal(response.status, 200)
    assertSafe(response)
    assert.equal(server.transports.length, 1)
    assert.equal(server.sent.length, 1)
    const mail = server.sent[0]
    assert.equal(mail.to, expected)
    assert.equal(mail.from, fakeEnv.SMTP_FROM)
    assert.equal(mail.replyTo, fakeEnv.SMTP_USER)
    assert.equal(mail.cc, undefined)
    assert.equal(mail.bcc, undefined)
  })
}

test('all documented field maxima and 30 products fit a legitimate request', async (t) => {
  const server = await fixture(t)
  const response = await post(server, {
    name: 'N'.repeat(120),
    phone: '1'.repeat(40),
    city: 'C'.repeat(120),
    message: 'M'.repeat(2000),
    items: Array.from({ length: 30 }, () => ({ product: 'P'.repeat(120), measurements: 'D'.repeat(1000) })),
  })
  assert.equal(response.status, 200)
  assert.equal(server.sent.length, 1)
})

for (const message of [undefined, '', '   ', 'Line one\r\nLine two']) {
  test(`optional message accepts ${JSON.stringify(message) ?? 'omission'}`, async (t) => {
    const server = await fixture(t)
    const quote = validQuote()
    if (message === undefined) delete quote.message
    else quote.message = message
    const response = await post(server, quote)
    assert.equal(response.status, 200)
    assert.equal(server.sent.length, 1)
  })
}

for (const field of ['name', 'phone', 'city', 'items']) {
  test(`rejects missing required ${field}`, async (t) => {
    const quote = validQuote()
    delete quote[field]
    await assertRejected(t, quote)
  })
}

for (const field of ['name', 'phone', 'city']) {
  for (const value of ['', ' \t ']) {
    test(`rejects empty required ${field}: ${JSON.stringify(value)}`, async (t) => {
      await assertRejected(t, { ...validQuote(), [field]: value })
    })
  }
}

for (const field of ['name', 'phone', 'city', 'message']) {
  for (const value of [null, 123, true, [], ['unexpected'], { nested: 'unexpected' }]) {
    test(`rejects non-string ${field}: ${JSON.stringify(value)}`, async (t) => {
      await assertRejected(t, { ...validQuote(), [field]: value })
    })
  }
}

for (const [field, limit] of Object.entries({ name: 120, phone: 40, city: 120, message: 2000 })) {
  test(`rejects ${field} beyond ${limit} characters`, async (t) => {
    await assertRejected(t, { ...validQuote(), [field]: 'x'.repeat(limit + 1) })
  })
  test(`rejects overlong raw ${field} even when padding would trim away`, async (t) => {
    await assertRejected(t, { ...validQuote(), [field]: `${' '.repeat(limit)}x` })
  })
}

for (const root of [null, [], ['unexpected'], 'unexpected', 123, true]) {
  test(`rejects non-object JSON root: ${JSON.stringify(root)}`, async (t) => {
    await assertRejected(t, root)
  })
}

for (const items of [null, 'unexpected', 123, true, {}, [], Array.from({ length: 31 }, () => validQuote().items[0])]) {
  test(`rejects invalid items collection: ${Array.isArray(items) ? `array(${items.length})` : JSON.stringify(items)}`, async (t) => {
    await assertRejected(t, { ...validQuote(), items })
  })
}

for (const item of [null, 'unexpected', 123, true, [], ['unexpected']]) {
  test(`rejects non-object product item: ${JSON.stringify(item)}`, async (t) => {
    await assertRejected(t, { ...validQuote(), items: [item] })
  })
}

for (const [field, limit] of Object.entries({ product: 120, measurements: 1000 })) {
  test(`rejects missing required item ${field}`, async (t) => {
    const quote = validQuote()
    delete quote.items[0][field]
    await assertRejected(t, quote)
  })
  for (const value of ['', '   ', null, 123, true, [], ['unexpected'], { nested: 'unexpected' }]) {
    test(`rejects invalid item ${field}: ${JSON.stringify(value)}`, async (t) => {
      const quote = validQuote()
      quote.items[0][field] = value
      await assertRejected(t, quote)
    })
  }
  test(`rejects item ${field} beyond ${limit} characters`, async (t) => {
    const quote = validQuote()
    quote.items[0][field] = 'x'.repeat(limit + 1)
    await assertRejected(t, quote)
  })
  test(`rejects overlong raw item ${field} despite whitespace trimming`, async (t) => {
    const quote = validQuote()
    quote.items[0][field] = `${' '.repeat(limit)}x`
    await assertRejected(t, quote)
  })
}

test('rejects unexpected nested root fields without reflecting their contents', async (t) => {
  await assertRejected(t, { ...validQuote(), unexpected: { secret: 'attacker-payload-private-sentinel' } })
})

test('rejects unknown product fields without reflecting their contents', async (t) => {
  const quote = validQuote()
  quote.items[0].unexpected = { secret: 'attacker-payload-private-sentinel' }
  await assertRejected(t, quote)
})

for (const field of ['__proto__', 'constructor', 'prototype']) {
  test(`rejects unknown reserved field ${field}`, async (t) => {
    const quote = JSON.parse(JSON.stringify(validQuote()).replace(/}$/, `,"${field}":{"polluted":true}}`))
    await assertRejected(t, quote)
    assert.equal({}.polluted, undefined)
  })
}

// The current form has no email input. Unsupported email values must be rejected
// rather than silently adding an unrequested reply-to/email feature.
for (const email of ['not-an-email', 'person@@example.test', `${'a'.repeat(400)}@example.test`]) {
  test(`rejects unsupported ${email.length > 254 ? 'excessively long' : 'malformed'} email (${email.length} chars)`, async (t) => {
    await assertRejected(t, { ...validQuote(), email })
  })
}

for (const field of ['from', 'to', 'cc', 'bcc', 'replyTo', 'subject', 'QUOTE_EMAIL_TO', 'recipient', 'recipients', 'quoteEmailTo']) {
  test(`visitor cannot override email header or recipient configuration ${field}`, async (t) => {
    await assertRejected(t, { ...validQuote(), [field]: 'attacker-payload-private-sentinel@evil.test' })
  })
}

for (const name of ['Maria\r\nBcc: victim@evil.test', 'Maria\nBcc: victim@evil.test', 'Maria\rBcc: victim@evil.test', 'Maria\r\n']) {
  test(`rejects CR/LF subject injection: ${JSON.stringify(name)}`, async (t) => {
    await assertRejected(t, { ...validQuote(), name })
  })
}

test('body-only newlines cannot alter trusted mail recipients or headers', async (t) => {
  const server = await fixture(t)
  const quote = validQuote()
  quote.message = 'Hello\r\nTo: victim@evil.test\r\nBcc: victim@evil.test'
  quote.items[0].measurements = '1 metre\r\nSubject: changed'
  const response = await post(server, quote)
  assert.equal(response.status, 200)
  assert.equal(server.sent[0].to, fakeEnv.QUOTE_EMAIL_TO)
  assert.equal(server.sent[0].from, fakeEnv.SMTP_FROM)
  assert.equal(server.sent[0].replyTo, fakeEnv.SMTP_USER)
  assert.equal(server.sent[0].bcc, undefined)
  assert.equal(server.sent[0].cc, undefined)
  assert.doesNotMatch(server.sent[0].subject, /[\r\n]|changed/)
})

for (const raw of ['{"name":', '{"name":"attacker-payload-private-sentinel",}', '']) {
  test(`rejects malformed or empty JSON: ${JSON.stringify(raw)}`, async (t) => {
    const server = await fixture(t)
    const response = await request(server, { raw, headers: { 'Content-Type': 'application/json' } })
    assert.equal(response.status, 400)
    assertSafe(response)
    assert.equal(server.transports.length, 0)
  })
}

test('rejects JSON above the 64 KiB byte cap before SMTP creation', async (t) => {
  const server = await fixture(t)
  const response = await post(server, { ...validQuote(), message: 'x'.repeat(64 * 1024) })
  assert.equal(response.status, 413)
  assertSafe(response)
  assert.equal(server.transports.length, 0)
})

test('enforces body byte cap for multibyte UTF-8 even within individual field limits', async (t) => {
  const server = await fixture(t)
  const quote = validQuote()
  quote.items = Array.from({ length: 30 }, () => ({ product: 'é'.repeat(120), measurements: 'é'.repeat(1000) }))
  assert.ok(Buffer.byteLength(JSON.stringify(quote)) > 64 * 1024)
  const response = await post(server, quote)
  assert.equal(response.status, 413)
  assertSafe(response)
  assert.equal(server.transports.length, 0)
})

for (const contentType of [undefined, 'text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=test', 'application/octet-stream']) {
  test(`rejects inappropriate Content-Type: ${contentType ?? '(missing)'}`, async (t) => {
    const server = await fixture(t)
    const response = await request(server, {
      raw: JSON.stringify(validQuote()),
      headers: contentType ? { 'Content-Type': contentType } : {},
    })
    assert.equal(response.status, 415)
    assertSafe(response)
    assert.equal(server.transports.length, 0)
  })
}

test('rejects compressed requests rather than inflating attacker-controlled bodies', async (t) => {
  const server = await fixture(t)
  const response = await post(server, validQuote(), { 'Content-Encoding': 'gzip' })
  assert.equal(response.status, 415)
  assertSafe(response)
  assert.equal(server.transports.length, 0)
})

test('configured origin can submit quotes and receives exact CORS access', async (t) => {
  const server = await fixture(t)
  const response = await post(server, validQuote(), { Origin: fakeEnv.FRONTEND_URL })
  assert.equal(response.status, 200)
  assert.equal(response.headers['access-control-allow-origin'], fakeEnv.FRONTEND_URL)
  assert.notEqual(response.headers['access-control-allow-credentials'], 'true')
  assert.equal(server.sent.length, 1)
})

test('configured-origin preflight permits POST and Content-Type', async (t) => {
  const server = await fixture(t)
  const response = await request(server, {
    method: 'OPTIONS',
    headers: {
      Origin: fakeEnv.FRONTEND_URL,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type',
    },
  })
  assert.equal(response.status, 204)
  assert.equal(response.headers['access-control-allow-origin'], fakeEnv.FRONTEND_URL)
  assert.match(response.headers['access-control-allow-methods'], /\bPOST\b/)
  assert.match(response.headers['access-control-allow-headers'], /content-type/i)
  assertHeaders(response)
  assert.equal(server.transports.length, 0)
})

for (const origin of ['https://evil.example.test', `${fakeEnv.FRONTEND_URL}.evil.test`, 'null']) {
  test(`unauthorized Origin cannot send mail or obtain CORS access: ${origin}`, async (t) => {
    const server = await fixture(t)
    const response = await post(server, validQuote(), { Origin: origin })
    assert.equal(response.status, 403)
    assert.equal(response.headers['access-control-allow-origin'], undefined)
    assertSafe(response)
    assert.equal(server.transports.length, 0)
    const preflight = await request(server, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
    })
    assert.equal(preflight.headers['access-control-allow-origin'], undefined)
    assert.equal(server.transports.length, 0)
  })
}

test('non-browser clients without Origin can submit valid quotes', async (t) => {
  const server = await fixture(t)
  const response = await post(server)
  assert.equal(response.status, 200)
  assert.equal(response.headers['access-control-allow-origin'], undefined)
  assert.equal(server.sent.length, 1)
})

test('ninth quote request is limited and spoofed forwarding headers cannot bypass it', async (t) => {
  const server = await fixture(t)
  assert.equal(server.app.get('trust proxy'), false)
  for (let index = 0; index < 8; index += 1) {
    const response = await post(server, validQuote(), {
      'X-Forwarded-For': `198.51.100.${index + 1}`,
      'X-Real-IP': `203.0.113.${index + 1}`,
      Forwarded: `for=192.0.2.${index + 1}`,
    })
    assert.equal(response.status, 200)
  }
  const response = await post(server, validQuote(), { 'X-Forwarded-For': '198.51.100.250' })
  assert.equal(response.status, 429)
  assert.ok(Number(response.headers['retry-after']) > 0)
  assert.ok(Number(response.headers['retry-after']) <= 900)
  assertSafe(response)
  assert.equal(server.sent.length, 8)
})

const invalidRequests = [
  ['validation failures', (server) => post(server, {}), 400],
  ['malformed JSON', (server) => request(server, { raw: '{', headers: { 'Content-Type': 'application/json' } }), 400],
  ['oversized JSON', (server) => post(server, { message: 'x'.repeat(64 * 1024) }), 413],
  ['wrong content types', (server) => post(server, validQuote(), { 'Content-Type': 'text/plain' }), 415],
  ['forbidden origins', (server) => post(server, validQuote(), { Origin: 'https://evil.example.test' }), 403],
]
for (const [label, invalidRequest, status] of invalidRequests) {
  test(`${label} preserve all mail slots and keep their rejection after mail capacity is exhausted`, async (t) => {
    const server = await fixture(t)
    for (let index = 0; index < 8; index += 1) assert.equal((await invalidRequest(server)).status, status)
    assert.equal(server.transports.length, 0)
    for (let index = 0; index < 8; index += 1) assert.equal((await post(server)).status, 200)
    const response = await post(server)
    assert.equal(response.status, 429)
    assertSafe(response)
    const invalidAfterLimit = await invalidRequest(server)
    assert.equal(invalidAfterLimit.status, status)
    assertSafe(invalidAfterLimit)
    assert.equal(server.transports.length, 8)
    assert.equal(server.sent.length, 8)
  })
}

test('malformed and IPv6 forwarding identities cannot create additional mail capacity', async (t) => {
  const server = await fixture(t)
  const identities = [
    '2001:db8::1',
    '::ffff:192.0.2.1',
    '[2001:db8::2]:443',
    '198.51.100.1, 2001:db8::3',
    'not-an-address',
    'unknown',
    '192.0.2.1:1234',
    '',
  ]
  for (const identity of identities) {
    const response = await post(server, validQuote(), {
      'X-Forwarded-For': identity,
      'X-Real-IP': identity,
      Forwarded: `for="${identity}"`,
    })
    assert.equal(response.status, 200)
  }
  const limited = await post(server, validQuote(), {
    'X-Forwarded-For': '2001:db8::ffff',
    'X-Real-IP': '198.51.100.255',
    Forwarded: 'for="[2001:db8::ffff]:443";proto=https',
  })
  assert.equal(limited.status, 429)
  assertSafe(limited)
  assert.equal(server.transports.length, 8)
})

test('simulated changing socket peers cannot create mail capacity and Express IP is never consulted', async (t) => {
  const server = await fixture(t)
  const apparentPeers = [
    '10.128.0.1', '10.128.0.2', '192.0.2.10', '2001:db8::10',
    '::ffff:192.0.2.10', '127.0.0.1', '::1', '2001:db8::20', '198.51.100.200',
  ]
  let simulatedPeerCount = 0
  // Test-only simulation before Express runs; actual traffic stays on loopback.
  server.server.prependListener('request', (incoming) => {
    Object.defineProperty(incoming.socket, 'remoteAddress', {
      configurable: true,
      value: apparentPeers[simulatedPeerCount++],
    })
  })
  Object.defineProperty(server.app.request, 'ip', {
    configurable: true,
    get() { assert.fail('Admission must not infer customer identity from proxy peers.') },
  })
  for (let index = 0; index < 8; index += 1) {
    assert.equal((await post(server, validQuote(), { 'X-Forwarded-For': `192.0.2.${index + 1}` })).status, 200)
  }
  assert.equal((await post(server)).status, 429)
  assert.equal(simulatedPeerCount, apparentPeers.length)
  assert.equal(server.transports.length, 8)
  assert.equal(server.logs.length, 0)
})

test('the 121st quote attempt is rejected before parsing while health and unknown routes remain exempt', async (t) => {
  const server = await fixture(t, { now: () => 0 })
  for (let index = 0; index < 120; index += 1) {
    const [, invalidRequest, status] = invalidRequests[index % invalidRequests.length]
    assert.equal((await invalidRequest(server)).status, status)
    const health = await request(server, { method: 'GET', path: '/api/health' })
    assert.equal(health.status, 200)
    assert.deepEqual(health.body, { ok: true })
    const unknown = await request(server, { path: '/api/unknown' })
    assert.equal(unknown.status, 404)
  }
  const limited = await request(server, {
    raw: '{',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '2001:db8::1234' },
  })
  assert.equal(limited.status, 429)
  assert.equal(limited.headers['retry-after'], '60')
  assertSafe(limited)
  assert.equal((await post(server)).status, 429)
  assert.equal((await request(server, { method: 'GET', path: '/api/health' })).status, 200)
  assert.equal((await request(server, { path: '/api/unknown' })).status, 404)
  assert.equal(server.transports.length, 0)
})

test('the short request window recovers without replenishing exhausted mail capacity', async (t) => {
  let timestamp = 0
  const server = await fixture(t, { now: () => timestamp })
  for (let index = 0; index < 8; index += 1) assert.equal((await post(server)).status, 200)
  for (let index = 0; index < 112; index += 1) assert.equal((await post(server, {})).status, 400)
  const limited = await post(server, {})
  assert.equal(limited.status, 429)
  assert.equal(limited.headers['retry-after'], '60')
  timestamp = 59_999
  const almostReset = await post(server, {})
  assert.equal(almostReset.status, 429)
  assert.equal(almostReset.headers['retry-after'], '1')
  timestamp = 60_000
  assert.equal((await post(server, {})).status, 400)
  const mailLimited = await post(server)
  assert.equal(mailLimited.status, 429)
  assert.equal(mailLimited.headers['retry-after'], '840')
  assertSafe(mailLimited)
  assert.equal(server.transports.length, 8)
})

test('mail expiry starts at the first eligible quote rather than preceding invalid traffic', async (t) => {
  let timestamp = 0
  const server = await fixture(t, { now: () => timestamp })
  assert.equal((await post(server, {})).status, 400)
  timestamp = 60_000
  for (let index = 0; index < 8; index += 1) assert.equal((await post(server)).status, 200)
  timestamp = 900_000
  const limited = await post(server)
  assert.equal(limited.status, 429)
  assert.equal(limited.headers['retry-after'], '60')
  timestamp = 960_000
  assert.equal((await post(server)).status, 200)
  assert.equal(server.transports.length, 9)
})

test('concurrent requests reserve mail capacity before awaiting SMTP completion', async (t) => {
  let releaseMail
  const mailCompletion = new Promise((resolve) => { releaseMail = resolve })
  const server = await fixture(t, { sendMail: () => mailCompletion })
  const pending = Array.from({ length: 9 }, () => post(server))
  try {
    const firstCompleted = await Promise.race(pending)
    assert.equal(firstCompleted.status, 429)
    assertSafe(firstCompleted)
    assert.equal(server.transports.length, 8)
    assert.equal(server.sent.length, 8)
    releaseMail()
    const responses = await Promise.all(pending)
    assert.equal(responses.filter(({ status }) => status === 200).length, 8)
    assert.equal(responses.filter(({ status }) => status === 429).length, 1)
    assert.equal(server.transports.length, 8)
  } finally {
    releaseMail()
    await Promise.allSettled(pending)
  }
})

test('separate application instances retain independent mail budgets', async (t) => {
  const first = await fixture(t)
  const second = await fixture(t)
  for (let index = 0; index < 8; index += 1) assert.equal((await post(first)).status, 200)
  assert.equal((await post(first)).status, 429)
  assert.equal((await post(second)).status, 200)
  assert.equal(first.transports.length, 8)
  assert.equal(second.transports.length, 1)
})

test('health is exempt from quote quota before and after the quote limit', async (t) => {
  const server = await fixture(t)
  const checkHealth = async () => {
    for (let index = 0; index < 12; index += 1) {
      const response = await request(server, { method: 'GET', path: '/api/health' })
      assert.equal(response.status, 200)
      assert.deepEqual(response.body, { ok: true })
      assertHeaders(response)
    }
  }
  await checkHealth()
  for (let index = 0; index < 8; index += 1) assert.equal((await post(server)).status, 200)
  assert.equal((await post(server)).status, 429)
  await checkHealth()
  assert.equal(server.sent.length, 8)
})

test('quote quota resets at 15 minutes and Retry-After uses remaining time', async (t) => {
  let timestamp = 1_800_000_000_000
  const server = await fixture(t, { now: () => timestamp })
  for (let index = 0; index < 8; index += 1) assert.equal((await post(server)).status, 200)
  timestamp += 14 * 60 * 1000
  const limited = await post(server)
  assert.equal(limited.status, 429)
  assert.equal(limited.headers['retry-after'], '60')
  timestamp += 60 * 1000
  for (let index = 0; index < 8; index += 1) assert.equal((await post(server)).status, 200)
  assert.equal((await post(server)).status, 429)
  assert.equal(server.sent.length, 16)
})

const providerError = (code) => Object.assign(new Error([
  fakeEnv.SMTP_USER,
  fakeEnv.SMTP_PASS,
  fakeEnv.SMTP_HOST,
  'provider-auth-private-sentinel',
  'environment-private-sentinel',
  'C:\\filesystem-private-sentinel\\server\\index.js',
].join(' ')), {
  code,
  response: '535 provider-auth-private-sentinel',
  command: `AUTH PLAIN ${fakeEnv.SMTP_PASS}`,
  environment: { SMTP_PASS: fakeEnv.SMTP_PASS },
})

for (const failureStage of ['delivery', 'transport construction', 'missing configuration']) {
  test(`${failureStage} failures consume mail reservations without refunds`, async (t) => {
    const server = await fixture(t, failureStage === 'delivery'
      ? { sendMail: async () => { throw providerError('EAUTH') } }
      : failureStage === 'transport construction'
        ? { createTransport: () => { throw providerError('EAUTH') } }
        : { env: { SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '' } })
    for (let index = 0; index < 8; index += 1) {
      const response = await post(server)
      assert.equal(response.status, 500)
      assertSafe(response)
    }
    const limited = await post(server)
    assert.equal(limited.status, 429)
    assertSafe(limited)
    assert.equal(server.transports.length, failureStage === 'missing configuration' ? 0 : 8)
    assert.equal(server.sent.length, failureStage === 'delivery' ? 8 : 0)
    assert.equal(server.logs.length, 8)
  })
}

for (const code of ['EAUTH', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'arbitrary-provider-private-sentinel']) {
  test(`SMTP ${code} returns a generic response and logs no provider details`, async (t) => {
    const server = await fixture(t, { sendMail: async () => { throw providerError(code) } })
    const response = await post(server)
    assert.equal(response.status, 500)
    assertSafe(response)
    assert.deepEqual(Object.keys(response.body), ['message'])
    assert.doesNotMatch(response.text, /EAUTH|ECONNECTION|ETIMEDOUT|ESOCKET|535|AUTH PLAIN|arbitrary-provider/)
    assert.equal(server.sent.length, 1)
    assert.ok(server.logs.length > 0)
    const logs = JSON.stringify(server.logs)
    for (const marker of [fakeEnv.SMTP_USER, fakeEnv.SMTP_PASS, fakeEnv.SMTP_HOST, 'provider-auth-private-sentinel', 'environment-private-sentinel', 'filesystem-private-sentinel', 'arbitrary-provider-private-sentinel', 'AUTH PLAIN']) {
      assert.ok(!logs.includes(marker), `Logs exposed forbidden marker: ${marker}`)
    }
    for (const entry of server.logs) {
      assert.ok(entry.args.every((argument) => !(argument instanceof Error)), 'Logs must not receive provider Error objects.')
    }
  })
}

test('transport-construction failures receive the same safe response', async (t) => {
  const server = await fixture(t, { createTransport: () => { throw providerError('EAUTH') } })
  const response = await post(server)
  assert.equal(response.status, 500)
  assertSafe(response)
  assert.equal(server.sent.length, 0)
  assert.ok(!JSON.stringify(server.logs).includes(fakeEnv.SMTP_PASS))
})

test('missing SMTP configuration stays private and never invokes a transport', async (t) => {
  const server = await fixture(t, { env: { SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '' } })
  const response = await post(server)
  assert.equal(response.status, 500)
  assertSafe(response)
  assert.equal(server.transports.length, 0)
  assert.ok(!JSON.stringify(server.logs).includes('SMTP_PASS'))
})

for (const environment of ['test', 'development', 'production']) {
  test(`security headers and HSTS policy apply in ${environment}`, async (t) => {
    const server = await fixture(t, { env: { NODE_ENV: environment } })
    const health = await request(server, { method: 'GET', path: '/api/health' })
    assert.equal(health.status, 200)
    assertHeaders(health, environment === 'production')
    const success = await post(server)
    assert.equal(success.status, 200)
    assertHeaders(success, environment === 'production')
    const invalid = await post(server, {})
    assert.equal(invalid.status, 400)
    assertHeaders(invalid, environment === 'production')
    const malformed = await request(server, { raw: '{', headers: { 'Content-Type': 'application/json' } })
    assert.equal(malformed.status, 400)
    assertHeaders(malformed, environment === 'production')
  })
}

for (const path of ['/', '/index.html', '/assets/globalfer-capa.jpg', '/nested/frontend/route', '/api/unknown']) {
  test(`API-only server returns safe JSON 404 for GET ${path}`, async (t) => {
    const server = await fixture(t)
    const response = await request(server, { method: 'GET', path })
    assert.equal(response.status, 404)
    assert.deepEqual(response.body, { message: 'Rota não encontrada.' })
    assertSafe(response)
    assert.equal(server.transports.length, 0)
    assert.equal(server.sent.length, 0)
  })
}

test('unknown API POST does not create a transport or serve the frontend', async (t) => {
  const server = await fixture(t)
  const response = await request(server, { path: '/api/unknown' })
  assert.equal(response.status, 404)
  assertSafe(response)
  assert.equal(server.transports.length, 0)
  assert.equal(server.sent.length, 0)
})

test('health succeeds with all SMTP configuration absent and exposes only availability', async (t) => {
  const server = await fixture(t, {
    env: {
      SMTP_HOST: undefined, SMTP_PORT: undefined, SMTP_SECURE: undefined,
      SMTP_USER: undefined, SMTP_PASS: undefined, SMTP_FROM: undefined,
    },
  })
  const response = await request(server, { method: 'GET', path: '/api/health' })
  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { ok: true })
  assertHeaders(response)
  assert.equal(server.transports.length, 0)
  assert.equal(server.sent.length, 0)
})

test('production Firebase origin works while paths, trailing slashes and local origins remain rejected', async (t) => {
  const origin = 'https://globalfer-site.web.app'
  const server = await fixture(t, { env: { FRONTEND_URL: origin } })
  const allowed = await post(server, validQuote(), { Origin: origin })
  assert.equal(allowed.status, 200)
  assert.equal(allowed.headers['access-control-allow-origin'], origin)
  for (const invalid of [`${origin}/`, `${origin}/path`, 'http://127.0.0.1:5173']) {
    const response = await post(server, validQuote(), { Origin: invalid })
    assert.equal(response.status, 403)
    assert.equal(response.headers['access-control-allow-origin'], undefined)
    assertSafe(response)
  }
  assert.equal(server.sent.length, 1)
})

test('framework URL-decoding failures reach the safe final error handler', async (t) => {
  const server = await fixture(t)
  const response = await request(server, { method: 'GET', path: '/%E0%A4%A' })
  assert.equal(response.status, 400)
  assertSafe(response)
  assert.equal(server.transports.length, 0)
})

// Synthetic credentials and routing values: these fixtures must never reach Meta.
const whatsappEnv = {
  WHATSAPP_ENABLED: 'true',
  WHATSAPP_GRAPH_API_VERSION: 'v26.0',
  WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
  WHATSAPP_TO: '+15555550123',
  WHATSAPP_TEMPLATE_NAME: 'globalfer_new_quote_test',
  WHATSAPP_TEMPLATE_LANGUAGE: 'pt_BR',
  WHATSAPP_ACCESS_TOKEN: 'synthetic-whatsapp-token-private-sentinel',
}
const privateQuote = () => ({
  name: 'customer-name-private-sentinel',
  phone: 'customer-phone-private-sentinel',
  city: 'customer-city-private-sentinel',
  message: 'customer-message-private-sentinel',
  items: [{ product: 'customer-product-private-sentinel', measurements: 'customer-measurements-private-sentinel' }],
})
const whatsappProviderResponse = (ok = true) => ({
  ok,
  status: ok ? 200 : 401,
  body: { async cancel() {} },
  async json() {
    return ok ? { messaging_product: 'whatsapp', messages: [{ id: 'wamid.fake-whatsapp-message-id' }] } : {
      error: { message: `meta-provider-private-sentinel ${whatsappEnv.WHATSAPP_ACCESS_TOKEN}`, code: 190 },
    }
  },
  async text() { return `meta-provider-private-sentinel ${whatsappEnv.WHATSAPP_ACCESS_TOKEN}` },
})

async function whatsappFixture(t, { env = {}, fetchImpl, timeoutMs = 1000, ...options } = {}) {
  const whatsappCalls = []
  const server = await fixture(t, {
    ...options,
    env: { ...whatsappEnv, ...env },
    createWhatsAppNotifier: ({ env: notifierEnv, logger }) => createWhatsAppNotifier({
      env: notifierEnv,
      logger,
      timeoutMs,
      fetchImpl: (...args) => {
        whatsappCalls.push(args)
        return fetchImpl ? fetchImpl(...args) : Promise.resolve(whatsappProviderResponse())
      },
    }),
  })
  return { ...server, whatsappCalls }
}

function assertWhatsAppPrivate(server, response, quote = privateQuote()) {
  assertSafe(response)
  const output = `${response.text}\n${JSON.stringify(server.logs)}`
  for (const marker of [
    ...Object.values(whatsappEnv).filter((value) => value.length > 10),
    whatsappEnv.WHATSAPP_TO.slice(1),
    'meta-provider-private-sentinel',
    ...[quote.name, quote.phone, quote.city, quote.message],
    ...quote.items.flatMap(({ product, measurements }) => [product, measurements]),
    'Authorization',
    'Bearer',
  ]) {
    if (marker) assert.ok(!output.includes(marker), `Response or logs exposed private marker: ${marker}`)
  }
  for (const entry of server.logs) {
    assert.ok(entry.args.every((argument) => typeof argument === 'string'), 'Log only fixed string categories.')
  }
}

function assertQuoteSuccess(response) {
  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { message: 'Solicita\u00e7\u00e3o enviada com sucesso.' })
}

test('WhatsApp disabled performs no provider call and preserves the existing email response', async (t) => {
  const server = await whatsappFixture(t, { env: { WHATSAPP_ENABLED: 'false' } })
  const response = await post(server, privateQuote())
  assertQuoteSuccess(response)
  assert.equal(server.sent.length, 1)
  assert.equal(server.whatsappCalls.length, 0)
  assert.deepEqual(server.logs, [])
  assertWhatsAppPrivate(server, response)
})

test('successful email makes one enabled WhatsApp attempt with only the server configured destination', async (t) => {
  const server = await whatsappFixture(t)
  const response = await post(server, privateQuote())
  assertQuoteSuccess(response)
  assert.equal(server.sent.length, 1)
  assert.equal(server.whatsappCalls.length, 1)
  const [url, options] = server.whatsappCalls[0]
  assert.equal(url, `https://graph.facebook.com/${whatsappEnv.WHATSAPP_GRAPH_API_VERSION}/${whatsappEnv.WHATSAPP_PHONE_NUMBER_ID}/messages`)
  assert.equal(options.method, 'POST')
  assert.equal(new Headers(options.headers).get('authorization'), `Bearer ${whatsappEnv.WHATSAPP_ACCESS_TOKEN}`)
  const payload = JSON.parse(options.body)
  assert.equal(payload.type, 'template')
  assert.equal(payload.messaging_product, 'whatsapp')
  assert.equal(payload.to, whatsappEnv.WHATSAPP_TO.slice(1))
  assert.equal(payload.template.name, whatsappEnv.WHATSAPP_TEMPLATE_NAME)
  assert.equal(payload.template.language.code, whatsappEnv.WHATSAPP_TEMPLATE_LANGUAGE)
  assert.deepEqual(server.logs, [])
  assertWhatsAppPrivate(server, response)
})

for (const failure of ['HTTP rejection', 'network rejection']) {
  test(`WhatsApp ${failure} after email success returns the original success and redacts all private data`, async (t) => {
    const quote = privateQuote()
    const server = await whatsappFixture(t, {
      fetchImpl: async () => {
        if (failure === 'HTTP rejection') return whatsappProviderResponse(false)
        throw Object.assign(new Error([
          'meta-provider-private-sentinel', whatsappEnv.WHATSAPP_ACCESS_TOKEN,
          whatsappEnv.WHATSAPP_TO, JSON.stringify(quote),
        ].join(' ')), { response: quote, code: 190 })
      },
    })
    const response = await post(server, quote)
    assertQuoteSuccess(response)
    assert.equal(server.sent.length, 1)
    assert.equal(server.whatsappCalls.length, 1)
    assert.deepEqual(server.logs.map(({ args }) => args), [['[whatsapp] delivery_failed']])
    assertWhatsAppPrivate(server, response, quote)
  })
}

test('WhatsApp timeout aborts the provider request and preserves HTTP success after email', async (t) => {
  let aborted = false
  const server = await whatsappFixture(t, {
    timeoutMs: 20,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        aborted = true
        reject(new Error(`meta-provider-private-sentinel ${whatsappEnv.WHATSAPP_ACCESS_TOKEN}`))
      }, { once: true })
    }),
  })
  const response = await post(server, privateQuote())
  assertQuoteSuccess(response)
  assert.equal(aborted, true)
  assert.equal(server.sent.length, 1)
  assert.equal(server.whatsappCalls.length, 1)
  assert.deepEqual(server.logs.map(({ args }) => args), [['[whatsapp] delivery_failed']])
  assertWhatsAppPrivate(server, response)
})

test('invalid enabled WhatsApp configuration logs one safe category and cannot disrupt email', async (t) => {
  const server = await whatsappFixture(t, { env: { WHATSAPP_ACCESS_TOKEN: '' } })
  for (let index = 0; index < 2; index += 1) {
    const response = await post(server, privateQuote())
    assertQuoteSuccess(response)
    assertWhatsAppPrivate(server, response)
  }
  assert.equal(server.sent.length, 2)
  assert.equal(server.whatsappCalls.length, 0)
  assert.deepEqual(server.logs.map(({ args }) => args), [['[whatsapp] configuration_invalid']])
})

test('unexpected injected notifier rejection cannot turn an accepted email into a retry response', async (t) => {
  let attempts = 0
  const server = await fixture(t, {
    env: whatsappEnv,
    createWhatsAppNotifier: () => async () => {
      attempts += 1
      throw new Error(`meta-provider-private-sentinel ${whatsappEnv.WHATSAPP_ACCESS_TOKEN} ${JSON.stringify(privateQuote())}`)
    },
  })
  const response = await post(server, privateQuote())
  assertQuoteSuccess(response)
  assert.equal(server.sent.length, 1)
  assert.equal(attempts, 1)
  assert.deepEqual(server.logs.map(({ args }) => args), [['[whatsapp] delivery_failed']])
  assertWhatsAppPrivate(server, response)
})

for (const failureStage of ['SMTP delivery', 'SMTP transport creation', 'SMTP configuration']) {
  test(`${failureStage} failure never attempts WhatsApp and retains the generic email failure`, async (t) => {
    const server = await whatsappFixture(t, failureStage === 'SMTP delivery'
      ? { sendMail: async () => { throw providerError('EAUTH') } }
      : failureStage === 'SMTP transport creation'
        ? { createTransport: () => { throw providerError('EAUTH') } }
        : { env: { SMTP_HOST: '' } })
    const response = await post(server, privateQuote())
    assert.equal(response.status, 500)
    assert.equal(server.whatsappCalls.length, 0)
    assert.deepEqual(server.logs.map(({ args }) => args), [['[mail] delivery_failed']])
    assertWhatsAppPrivate(server, response)
  })
}

test('WhatsApp receives only normalized validated data after SMTP and completes before HTTP success', async (t) => {
  let releaseMail
  let releaseWhatsApp
  let markMailStarted
  let markWhatsAppStarted
  const mailCompletion = new Promise((resolve) => { releaseMail = resolve })
  const whatsappCompletion = new Promise((resolve) => { releaseWhatsApp = resolve })
  const mailStarted = new Promise((resolve) => { markMailStarted = resolve })
  const whatsappStarted = new Promise((resolve) => { markWhatsAppStarted = resolve })
  const received = []
  let factoryCalls = 0
  const server = await fixture(t, {
    env: whatsappEnv,
    sendMail: () => { markMailStarted(); return mailCompletion },
    createWhatsAppNotifier: ({ env, logger }) => {
      factoryCalls += 1
      assert.equal(env.WHATSAPP_TO, whatsappEnv.WHATSAPP_TO)
      assert.equal(typeof logger.error, 'function')
      return async (quote) => {
        received.push(quote)
        markWhatsAppStarted()
        await whatsappCompletion
      }
    },
  })
  const normalized = privateQuote()
  const padded = Object.fromEntries(Object.entries(normalized).map(([key, value]) => [
    key,
    key === 'items' ? value.map((item) => Object.fromEntries(Object.entries(item).map(([field, text]) => [field, `  ${text}  `]))) : `  ${value}  `,
  ]))
  const pendingResponse = post(server, padded)
  try {
    await mailStarted
    assert.deepEqual(received, [])
    releaseMail()
    await whatsappStarted
    assert.deepEqual(received, [normalized])
    const earlyResult = await Promise.race([
      pendingResponse.then(() => 'response'),
      new Promise((resolve) => setTimeout(() => resolve('waiting'), 20)),
    ])
    assert.equal(earlyResult, 'waiting', 'The request must await the bounded WhatsApp attempt.')
    releaseWhatsApp()
    const response = await pendingResponse
    assertQuoteSuccess(response)
    assert.equal(factoryCalls, 1)
    assert.equal(server.sent.length, 1)
    assertWhatsAppPrivate(server, response)
  } finally {
    releaseMail()
    releaseWhatsApp()
    await Promise.allSettled([pendingResponse])
  }
})

for (const field of [
  'whatsappTo', 'whatsapp_to', 'phoneNumberId', 'template', 'templateName',
  'recipient', 'to', 'cc', 'bcc', 'WHATSAPP_TO', 'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_TEMPLATE_NAME', 'WHATSAPP_ACCESS_TOKEN', 'templateLanguage', 'whatsappAccessToken',
]) {
  test(`request field ${field} cannot control WhatsApp routing, templates or credentials`, async (t) => {
    const server = await whatsappFixture(t)
    const quote = privateQuote()
    const response = await post(server, { ...quote, [field]: 'attacker-payload-private-sentinel' })
    assert.equal(response.status, 400)
    assert.equal(server.sent.length, 0)
    assert.equal(server.transports.length, 0)
    assert.equal(server.whatsappCalls.length, 0)
    assert.deepEqual(server.logs, [])
    assertWhatsAppPrivate(server, response, quote)
  })
}

test('WhatsApp shares the eight eligible quote reservations and cannot amplify notifications', async (t) => {
  const server = await whatsappFixture(t)
  for (const [, invalidRequest, expectedStatus] of invalidRequests) {
    assert.equal((await invalidRequest(server)).status, expectedStatus)
  }
  assert.equal(server.whatsappCalls.length, 0)
  assert.equal(server.sent.length, 0)
  for (let index = 0; index < 8; index += 1) {
    const response = await post(server, privateQuote(), { 'X-Forwarded-For': `198.51.100.${index + 1}` })
    assertQuoteSuccess(response)
    assert.equal(server.whatsappCalls.length, index + 1)
  }
  const limited = await post(server, privateQuote())
  assert.equal(limited.status, 429)
  assert.equal(server.sent.length, 8)
  assert.equal(server.whatsappCalls.length, 8)
  assertWhatsAppPrivate(server, limited)
})

test('WhatsApp failures do not refund notification reservations or cause automatic retries', async (t) => {
  const server = await whatsappFixture(t, { fetchImpl: async () => whatsappProviderResponse(false) })
  for (let index = 0; index < 8; index += 1) assertQuoteSuccess(await post(server, privateQuote()))
  const response = await post(server, privateQuote())
  assert.equal(response.status, 429)
  assert.equal(server.sent.length, 8)
  assert.equal(server.whatsappCalls.length, 8)
  assert.deepEqual(server.logs.map(({ args }) => args), Array.from({ length: 8 }, () => ['[whatsapp] delivery_failed']))
  assertWhatsAppPrivate(server, response)
})

test('WhatsApp summary leaves all 30 complete products and full fields in the email to both original recipients', async (t) => {
  const server = await whatsappFixture(t, { env: { QUOTE_EMAIL_TO: undefined } })
  const quote = {
    name: 'N'.repeat(120),
    phone: '1'.repeat(40),
    city: 'C'.repeat(120),
    message: `message-start-${'M'.repeat(1974)}-message-end`,
    items: Array.from({ length: 30 }, (_, index) => ({
      product: `product-${index + 1}-${'P'.repeat(105)}`,
      measurements: `measurements-${index + 1}-${'D'.repeat(960)}-complete`,
    })),
  }
  const response = await post(server, quote)
  assertQuoteSuccess(response)
  assert.equal(server.whatsappCalls.length, 1)
  assert.equal(server.sent.length, 1)
  const mail = server.sent[0]
  assert.equal(mail.to, defaultQuoteRecipients)
  assert.equal(mail.cc, undefined)
  assert.equal(mail.bcc, undefined)
  for (const fullValue of [quote.name, quote.phone, quote.city, quote.message, ...quote.items.flatMap(({ product, measurements }) => [product, measurements])]) {
    assert.ok(mail.text.includes(fullValue), 'Full email text must retain every quote field.')
    assert.ok(mail.html.includes(fullValue), 'Full email HTML must retain every quote field.')
  }
  assert.deepEqual(server.logs, [])
  assertWhatsAppPrivate(server, response, quote)
})
