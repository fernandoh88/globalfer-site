// Optional, server-configured Meta Cloud API notifications. Email is primary.
// See docs/whatsapp-notifications.md for the required approved body template.
export const whatsappTimeoutMs = 5_000
const parameterLimits = [80, 40, 80, 400, 200]
const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' })

const normalizeText = (value) => Array.from(value, (character) => (
  character.length === 1 && /[\uD800-\uDFFF]/.test(character) ? '\uFFFD' : character
)).join('').replace(/[\s\p{Cc}]+/gu, ' ').trim() || 'Não informado.'

// Count UTF-16 units conservatively, but only cut between complete graphemes.
const truncate = (value, limit) => {
  const text = normalizeText(value)
  if (text.length <= limit) return text
  let shortened = ''
  for (const { segment } of segmenter.segment(text)) {
    if (shortened.length + segment.length > limit - 1) break
    shortened += segment
  }
  return `${shortened.trimEnd()}…`
}

const summarizeProducts = (items) => {
  const entries = []
  const omittedSuffix = (count) => count > 0 ? `; (+${count} produtos no e-mail)` : ''
  for (const [index, item] of items.slice(0, 5).entries()) {
    const entry = `${index + 1}. ${truncate(item.product, 64)} — Medidas: ${truncate(item.measurements, 96)}`
    const candidate = [...entries, entry].join('; ')
    if ((candidate + omittedSuffix(items.length - index - 1)).length > parameterLimits[3]) break
    entries.push(entry)
  }
  return entries.join('; ') + omittedSuffix(items.length - entries.length)
}

// Input is exclusively the normalized result of app.js quote validation.
export const buildWhatsAppTemplateParameters = ({ name, phone, city, items, message }) => [
  name, phone, city, summarizeProducts(items), message,
].map((value, index) => ({ type: 'text', text: truncate(value, parameterLimits[index]) }))

const readConfiguration = (env) => {
  const configuration = {
    version: env.WHATSAPP_GRAPH_API_VERSION,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    to: env.WHATSAPP_TO,
    templateName: env.WHATSAPP_TEMPLATE_NAME,
    language: env.WHATSAPP_TEMPLATE_LANGUAGE,
    token: env.WHATSAPP_ACCESS_TOKEN,
  }
  if (Object.values(configuration).some((value) => typeof value !== 'string')) return null
  if (!/^v[1-9]\d{0,2}\.0$/.test(configuration.version)
    || !/^[1-9]\d{0,29}$/.test(configuration.phoneNumberId)
    || !/^\+[1-9]\d{1,14}$/.test(configuration.to)
    || !/^[a-z0-9_]{1,512}$/.test(configuration.templateName)
    || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(configuration.language)
    // Treat tokens as opaque; reject whitespace/control characters and placeholders.
    || !/^[\x21-\x7E]{16,4096}$/.test(configuration.token)
    || /^(replace|example|placeholder)/i.test(configuration.token)) return null
  return configuration
}

export const createWhatsAppNotifier = ({
  env = process.env,
  logger = console,
  fetchImpl = globalThis.fetch,
  timeoutMs = whatsappTimeoutMs,
} = {}) => {
  if (env.WHATSAPP_ENABLED === undefined || env.WHATSAPP_ENABLED === 'false') return async () => {}
  const configuration = env.WHATSAPP_ENABLED === 'true' ? readConfiguration(env) : null
  if (!configuration) {
    // One fixed startup category; no environment values or failed field names.
    logger.error('[whatsapp] configuration_invalid')
    return async () => {}
  }

  return async (quote) => {
    const controller = new AbortController()
    let timer
    try {
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: configuration.to.slice(1),
        type: 'template',
        template: {
          name: configuration.templateName,
          language: { code: configuration.language },
          components: [{ type: 'body', parameters: buildWhatsAppTemplateParameters(quote) }],
        },
      }
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new Error('whatsapp_timeout'))
        }, Math.min(timeoutMs, whatsappTimeoutMs))
      })
      const delivery = (async () => {
        const response = await fetchImpl(
          `https://graph.facebook.com/${configuration.version}/${configuration.phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${configuration.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
            redirect: 'error',
          },
        )
        // Do not read error bodies: they can contain secrets and quote content.
        if (!response.ok) throw new Error('whatsapp_rejected')
        const result = await response.json()
        if (result?.messaging_product !== 'whatsapp'
          || result?.error
          || !Array.isArray(result?.messages)
          || result.messages.length !== 1
          || typeof result.messages[0]?.id !== 'string'
          || !result.messages[0].id) throw new Error('whatsapp_invalid_acknowledgement')
      })()
      // Also bounds a stalled response body or an injected fetch ignoring abort.
      await Promise.race([delivery, deadline])
    } catch {
      logger.error('[whatsapp] delivery_failed')
    } finally {
      clearTimeout(timer)
      controller.abort()
    }
  }
}
