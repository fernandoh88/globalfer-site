import assert from 'node:assert/strict'
import { after, mock, test } from 'node:test'

const forbiddenFetch = mock.method(globalThis, 'fetch', () => {
  assert.fail('Real Meta requests are forbidden in this test suite.')
})
after(() => assert.equal(forbiddenFetch.mock.callCount(), 0, 'No test may use the default network fetch.'))
const { buildWhatsAppTemplateParameters, createWhatsAppNotifier, whatsappTimeoutMs } = await import('../server/whatsapp.js')

const fakeEnv = {
  WHATSAPP_ENABLED: 'true',
  WHATSAPP_GRAPH_API_VERSION: 'v26.0',
  WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
  WHATSAPP_TO: '+15555550123',
  WHATSAPP_TEMPLATE_NAME: 'globalfer_new_quote',
  WHATSAPP_TEMPLATE_LANGUAGE: 'pt_BR',
  WHATSAPP_ACCESS_TOKEN: 'fake-whatsapp+token/private=sentinel',
}
const quote = () => ({
  name: 'Maria Silva', phone: '(14) 99999-0000', city: 'Marília',
  message: 'Favor informar o prazo.',
  items: [{ product: 'Tubo de aço', measurements: '2 peças de 6 metros' }],
})
const accepted = () => ({
  ok: true,
  json: async () => ({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.fake-acceptance' }] }),
})
const fixture = ({ env = {}, fetchImpl = async () => accepted(), timeoutMs } = {}) => {
  const calls = []
  const logs = []
  const notify = createWhatsAppNotifier({
    env: { ...fakeEnv, ...env },
    logger: { error: (...args) => logs.push(args) },
    timeoutMs,
    fetchImpl: (...args) => { calls.push(args); return fetchImpl(...args) },
  })
  return { notify, calls, logs }
}

test('Meta request uses the configured version and sender, internal Bearer, and five positional template parameters', async () => {
  const { notify, calls, logs } = fixture()
  await notify(quote())
  assert.equal(calls.length, 1)
  const [url, options] = calls[0]
  assert.equal(url, 'https://graph.facebook.com/v26.0/123456789012345/messages')
  assert.equal(options.method, 'POST')
  assert.deepEqual(options.headers, {
    Authorization: `Bearer ${fakeEnv.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json',
  })
  assert.equal(options.redirect, 'error')
  assert.ok(options.signal instanceof AbortSignal)
  assert.deepEqual(JSON.parse(options.body), {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: '15555550123', type: 'template',
    template: {
      name: 'globalfer_new_quote', language: { code: 'pt_BR' },
      components: [{ type: 'body', parameters: [
        { type: 'text', text: 'Maria Silva' },
        { type: 'text', text: '(14) 99999-0000' },
        { type: 'text', text: 'Marília' },
        { type: 'text', text: '1. Tubo de aço — Medidas: 2 peças de 6 metros' },
        { type: 'text', text: 'Favor informar o prazo.' },
      ] }],
    },
  })
  assert.ok(!(url + options.body).includes(fakeEnv.WHATSAPP_ACCESS_TOKEN))
  assert.deepEqual(logs, [])
})

for (const enabled of [undefined, 'false']) {
  test(`WhatsApp ${enabled ?? 'unset'} needs no configuration and never calls fetch`, async () => {
    const logs = []
    const notify = createWhatsAppNotifier({ env: { WHATSAPP_ENABLED: enabled }, logger: { error: (...args) => logs.push(args) } })
    await notify(quote())
    assert.deepEqual(logs, [])
  })
}

for (const key of Object.keys(fakeEnv).filter((key) => key !== 'WHATSAPP_ENABLED')) {
  test(`missing ${key} safely disables delivery`, async () => {
    const { notify, calls, logs } = fixture({ env: { [key]: undefined } })
    await notify(quote())
    await notify(quote())
    assert.equal(calls.length, 0)
    assert.deepEqual(logs, [['[whatsapp] configuration_invalid']])
  })
}

for (const [key, value] of [
  ['WHATSAPP_ENABLED', 'TRUE'],
  ['WHATSAPP_ENABLED', '1'],
  ['WHATSAPP_GRAPH_API_VERSION', 'v26.0/other'],
  ['WHATSAPP_PHONE_NUMBER_ID', '../me'],
  ['WHATSAPP_PHONE_NUMBER_ID', '123?access_token=attacker'],
  ['WHATSAPP_TO', '15555550123'],
  ['WHATSAPP_TO', '+01555550123'],
  ['WHATSAPP_TO', '+15555550123123456'],
  ['WHATSAPP_TO', '+15555550123,+15555550124'],
  ['WHATSAPP_TO', '+1 555 555 0123'],
  ['WHATSAPP_TEMPLATE_NAME', 'Template Name'],
  ['WHATSAPP_TEMPLATE_LANGUAGE', 'pt-BR'],
  ['WHATSAPP_ACCESS_TOKEN', 'replace-with-development-token'],
  ['WHATSAPP_ACCESS_TOKEN', 'fake-token\r\nAuthorization: injected'],
  ['WHATSAPP_ACCESS_TOKEN', 'fake token private sentinel'],
  ['WHATSAPP_ACCESS_TOKEN', ''],
]) {
  test(`invalid ${key} is redacted and cannot send (${typeof value === 'string' ? value.length : 0} characters)`, async () => {
    const { notify, calls, logs } = fixture({ env: { [key]: value } })
    await notify(quote())
    assert.equal(calls.length, 0)
    assert.deepEqual(logs, [['[whatsapp] configuration_invalid']])
  })
}

test('HTTP provider failures discard the body and never retry', async () => {
  let bodyReads = 0
  const { notify, calls, logs } = fixture({ fetchImpl: async () => ({
    ok: false, status: 429,
    json: () => { bodyReads += 1; return { error: fakeEnv.WHATSAPP_ACCESS_TOKEN } },
  }) })
  await notify(quote())
  assert.equal(bodyReads, 0)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][1].signal.aborted, true)
  assert.deepEqual(logs, [['[whatsapp] delivery_failed']])
})

for (const [label, fetchImpl] of [
  ['network rejection', async () => { throw new Error(JSON.stringify({ ...fakeEnv, quote: quote() })) }],
  ['synchronous fetch exception', () => { throw new Error(fakeEnv.WHATSAPP_ACCESS_TOKEN) }],
  ['invalid JSON', async () => ({ ok: true, json: async () => { throw new Error('private provider body') } })],
  ['missing message acknowledgement', async () => ({ ok: true, json: async () => ({ messaging_product: 'whatsapp', messages: [] }) })],
  ['provider error in a 200 body', async () => ({ ok: true, json: async () => ({ ...await accepted().json(), error: { message: fakeEnv.WHATSAPP_ACCESS_TOKEN } }) })],
]) {
  test(`${label} emits only one fixed failure category`, async () => {
    const { notify, calls, logs } = fixture({ fetchImpl })
    await assert.doesNotReject(notify(quote()))
    assert.equal(calls.length, 1)
    assert.deepEqual(logs, [['[whatsapp] delivery_failed']])
  })
}

for (const stage of ['fetch', 'response body']) {
  test(`deadline covers stalled ${stage}, aborts, and does not require the provider to honor abort`, { timeout: 2000 }, async () => {
    const stalled = new Promise(() => {})
    const { notify, calls, logs } = fixture({
      timeoutMs: 20,
      fetchImpl: () => stage === 'fetch' ? stalled : Promise.resolve({ ok: true, json: () => stalled }),
    })
    await notify(quote())
    assert.equal(calls.length, 1)
    assert.equal(calls[0][1].signal.aborted, true)
    assert.deepEqual(logs, [['[whatsapp] delivery_failed']])
    assert.equal(whatsappTimeoutMs, 5000)
  })
}

test('summary preserves useful quote fields and makes an empty message explicit', () => {
  const data = quote()
  data.message = ''
  const texts = buildWhatsAppTemplateParameters(data).map(({ text }) => text)
  assert.deepEqual(texts.slice(0, 3), [data.name, data.phone, data.city])
  assert.ok(texts[3].includes(data.items[0].product))
  assert.ok(texts[3].includes(data.items[0].measurements))
  assert.equal(texts[4], 'Não informado.')
})

test('thirty maximum-size products and messages produce a deterministic bounded summary without mutating email data', () => {
  const data = {
    name: 'N'.repeat(120), phone: '9'.repeat(40), city: 'C'.repeat(120), message: 'M'.repeat(2000),
    items: Array.from({ length: 30 }, (_, index) => ({ product: `Produto ${index + 1} ${'P'.repeat(105)}`, measurements: 'D'.repeat(1000) })),
  }
  const original = JSON.stringify(data)
  const parameters = buildWhatsAppTemplateParameters(data)
  assert.deepEqual(parameters, buildWhatsAppTemplateParameters(data))
  assert.equal(JSON.stringify(data), original)
  for (const [index, limit] of [80, 40, 80, 400, 200].entries()) {
    assert.ok(parameters[index].text.length <= limit)
    assert.equal(parameters[index].type, 'text')
  }
  const products = parameters[3].text
  assert.ok(products.includes('Produto 1'))
  assert.ok(products.includes('Medidas:'))
  const included = [...products.matchAll(/(?:^|; )\d+\. /g)].length
  assert.ok(included > 0 && included <= 5)
  assert.ok(products.endsWith(`(+${30 - included} produtos no e-mail)`))
  assert.ok(parameters[4].text.endsWith('…'))
  const templateBody = 'Novo orçamento recebido pelo site Globalfer.\n\nNome: {{1}}\nTelefone: {{2}}\nCidade: {{3}}\n\nProdutos:\n{{4}}\n\nMensagem:\n{{5}}\n\nVerifique também o e-mail da Globalfer para os detalhes completos.'
  const rendered = templateBody.replace(/\{\{([1-5])\}\}/g, (_, index) => parameters[Number(index) - 1].text)
  assert.ok(rendered.length <= 1024)
})

test('small products retain at most five entries and an accurate omitted count', () => {
  const data = quote()
  data.items = Array.from({ length: 6 }, (_, index) => ({ product: `P${index + 1}`, measurements: '1m' }))
  const products = buildWhatsAppTemplateParameters(data)[3].text
  assert.match(products, /5\. P5/)
  assert.doesNotMatch(products, /P6/)
  assert.ok(products.endsWith('(+1 produtos no e-mail)'))
})

test('text parameters collapse tabs, line breaks, repeated spaces and controls; repair unpaired surrogates', () => {
  const value = 'A\r\n\t    B\u0000C\uD800D\uDC00E'
  const data = { name: value, phone: value, city: value, message: value, items: [{ product: value, measurements: value }] }
  for (const { text } of buildWhatsAppTemplateParameters(data)) {
    assert.doesNotMatch(text, /[\t\r\n\p{Cc}]| {2}/u)
    assert.doesNotThrow(() => encodeURIComponent(text), 'Text must contain no unpaired surrogates.')
    assert.ok(text.includes('A B C�D�E'))
  }
})

for (const grapheme of ['😀', 'e\u0301', '👩🏽‍🔧', '👨‍👩‍👧‍👦']) {
  test(`truncation does not split a Unicode grapheme of ${grapheme.length} UTF-16 units`, () => {
    const data = quote()
    data.message = grapheme.repeat(250)
    const message = buildWhatsAppTemplateParameters(data)[4].text
    assert.ok(message.length <= 200)
    assert.ok(message.endsWith('…'))
    const prefix = message.slice(0, -1)
    assert.equal(prefix.length % grapheme.length, 0)
    assert.equal(prefix, grapheme.repeat(prefix.length / grapheme.length))
  })
}

test('a single oversized combining sequence is omitted as one grapheme', () => {
  const data = quote()
  data.message = `e${'\u0301'.repeat(1000)}`
  assert.equal(buildWhatsAppTemplateParameters(data)[4].text, '…')
})
