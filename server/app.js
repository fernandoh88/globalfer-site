import cors from 'cors'
import express from 'express'
import nodemailer from 'nodemailer'
import { performance } from 'node:perf_hooks'

const maxProducts = 30
const requestWindowMs = 60 * 1000
const maxRequestsPerWindow = 120
const mailWindowMs = 15 * 60 * 1000
const maxMailAttemptsPerWindow = 8
const limits = { name: 120, phone: 40, city: 120, message: 2000, product: 120, measurements: 1000 }
const quoteFields = new Set(['name', 'phone', 'city', 'message', 'items'])
const itemFields = new Set(['product', 'measurements'])

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const validateQuote = (quote) => {
  const errors = []
  if (!isObject(quote)) {
    return { errors: ['Dados do orçamento inválidos.'], data: null }
  }
  if (Object.keys(quote).some((key) => !quoteFields.has(key))) {
    errors.push('Campos não permitidos no orçamento.')
  }

  const readString = (object, key, label, required = true) => {
    if (!required && !Object.hasOwn(object, key)) return ''
    const value = object[key]
    if (typeof value !== 'string') {
      errors.push(`${label}: informe um texto válido.`)
      return ''
    }
    if (value.length > limits[key]) errors.push(`${label}: texto muito longo.`)
    const clean = value.trim()
    if (required && !clean) errors.push(`${label}: campo obrigatório.`)
    return clean
  }

  const name = readString(quote, 'name', 'Nome')
  const phone = readString(quote, 'phone', 'Telefone / WhatsApp')
  const city = readString(quote, 'city', 'Cidade')
  const message = readString(quote, 'message', 'Mensagem', false)
  // Name is the only visitor-controlled value used in an email header.
  if (typeof quote.name === 'string' && /[\r\n]/.test(quote.name)) {
    errors.push('Nome: quebras de linha não são permitidas.')
  }

  const items = Array.isArray(quote.items) ? quote.items : []
  if (!Array.isArray(quote.items)) errors.push('Produtos: informe uma lista válida.')
  if (items.length === 0) errors.push('Adicione pelo menos um produto.')
  if (items.length > maxProducts) errors.push(`O limite é de ${maxProducts} produtos por orçamento.`)

  const cleanItems = items.slice(0, maxProducts).map((item, index) => {
    if (!isObject(item)) {
      errors.push(`Produto ${index + 1}: dados inválidos.`)
      return { product: '', measurements: '' }
    }
    if (Object.keys(item).some((key) => !itemFields.has(key))) {
      errors.push(`Produto ${index + 1}: campos não permitidos.`)
    }
    return {
      product: readString(item, 'product', `Produto ${index + 1}`),
      measurements: readString(item, 'measurements', `Produto ${index + 1}: medidas`),
    }
  })

  return { errors, data: { name, phone, city, message, items: cleanItems } }
}

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const buildTextEmail = ({ name, phone, city, message, items }) => {
  const productLines = items
    .map((item, index) => `${index + 1}. Produto: ${item.product}\n   Medidas/detalhes: ${item.measurements}`)
    .join('\n\n')
  return [
    'Nova solicitação de orçamento pelo site Globalfer.',
    '',
    `Nome: ${name}`,
    `Telefone / WhatsApp: ${phone}`,
    `Cidade: ${city}`,
    '',
    'Produtos solicitados:',
    productLines,
    '',
    'Mensagem:',
    message || 'Não informado.',
  ].join('\n')
}

const buildHtmlEmail = ({ name, phone, city, message, items }) => `
  <div style="font-family: Arial, sans-serif; color: #1f2933; line-height: 1.5;">
    <h2 style="margin: 0 0 16px; color: #101722;">Nova solicitação de orçamento</h2>
    <p><strong>Nome:</strong> ${escapeHtml(name)}</p>
    <p><strong>Telefone / WhatsApp:</strong> ${escapeHtml(phone)}</p>
    <p><strong>Cidade:</strong> ${escapeHtml(city)}</p>
    <h3 style="margin-top: 24px; color: #101722;">Produtos solicitados</h3>
    ${items.map((item, index) => `
      <div style="border: 1px solid #d8dee6; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
        <p style="margin: 0 0 8px;"><strong>Produto ${index + 1}:</strong> ${escapeHtml(item.product)}</p>
        <p style="margin: 0;"><strong>Medidas/detalhes:</strong><br>${escapeHtml(item.measurements).replaceAll('\n', '<br>')}</p>
      </div>
    `).join('')}
    <h3 style="margin-top: 24px; color: #101722;">Mensagem</h3>
    <p>${escapeHtml(message || 'Não informado.').replaceAll('\n', '<br>')}</p>
  </div>
`

export const createApp = ({
  env = process.env,
  createTransport = nodemailer.createTransport,
  logger = console,
  now = () => performance.now(),
} = {}) => {
  const app = express()
  const frontendUrl = env.FRONTEND_URL || 'http://127.0.0.1:5173'
  const quoteEmailTo = env.QUOTE_EMAIL_TO || 'globalfer_marilia@yahoo.com.br'

  app.disable('x-powered-by')
  // No documented direct Cloud Run topology justifies trusting forwarding headers.
  app.set('trust proxy', false)
  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('X-Frame-Options', 'DENY')
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    if (env.NODE_ENV === 'production') {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
    next()
  })
  app.use(cors({
    origin: (origin, callback) => callback(null, origin === frontendUrl),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  }))

  // Explicit process budgets: proxy peers and caller-supplied headers are not identities.
  // Two counters retain no IP addresses or quote data. The default clock is monotonic.
  const createBudget = (maximum, windowMs) => {
    let startedAt
    let count = 0
    return (response) => {
      const currentTime = now()
      if (startedAt === undefined || currentTime - startedAt >= windowMs) {
        startedAt = currentTime
        count = 0
      }
      if (count >= maximum) {
        const remainingMs = windowMs - Math.max(0, currentTime - startedAt)
        response.setHeader('Retry-After', Math.max(1, Math.ceil(remainingMs / 1000)))
        response.status(429).json({ message: 'Muitas solicitações. Tente novamente mais tarde.' })
        return false
      }
      count += 1
      return true
    }
  }
  const admitQuoteRequest = createBudget(maxRequestsPerWindow, requestWindowMs)
  const reserveMailAttempt = createBudget(maxMailAttemptsPerWindow, mailWindowMs)
  const rateLimitQuote = (_request, response, next) => {
    if (admitQuoteRequest(response)) next()
  }

  const checkQuoteRequest = (request, response, next) => {
    const origin = request.get('Origin')
    if (origin !== undefined && origin !== frontendUrl) {
      return response.status(403).json({ message: 'Origem não permitida.' })
    }
    const contentType = request.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase()
    if (contentType !== 'application/json') {
      return response.status(415).json({ message: 'Envie os dados como JSON.' })
    }
    return next()
  }

  const createTransporter = () => {
    if (['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'].some((key) => !env[key])) {
      throw new Error('mail_configuration_invalid')
    }
    return createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT),
      secure: env.SMTP_SECURE === 'true',
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      dnsTimeout: 10_000,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      disableFileAccess: true,
      disableUrlAccess: true,
    })
  }

  app.get('/api/health', (request, response) => {
    response.json({ ok: true })
  })

  // Maximum ASCII form: 30 * (120 + 1000) + 2280 characters, plus JSON syntax.
  // 64 KiB also caps total UTF-8 bytes; not every field can be maximal Unicode at once.
  const parseQuote = express.json({ limit: '64kb', strict: true, inflate: false })
  app.post('/api/orcamento', rateLimitQuote, checkQuoteRequest, parseQuote, async (request, response) => {
    const { errors, data } = validateQuote(request.body)
    if (errors.length > 0) {
      return response.status(400).json({ message: 'Revise os dados do orçamento.', errors })
    }
    // Reserve synchronously before SMTP; failed/ambiguous attempts are not refunded.
    if (!reserveMailAttempt(response)) return
    try {
      const transporter = createTransporter()
      await transporter.sendMail({
        from: env.SMTP_FROM || env.SMTP_USER,
        to: quoteEmailTo,
        replyTo: env.SMTP_USER,
        subject: `Solicitação de orçamento - ${data.name}`,
        text: buildTextEmail(data),
        html: buildHtmlEmail(data),
      })
      return response.json({ message: 'Solicitação enviada com sucesso.' })
    } catch {
      // Provider errors (including their codes) may contain credentials or other secrets.
      logger.error('[mail] delivery_failed')
      return response.status(500).json({
        message: 'Não foi possível enviar o orçamento agora. Tente novamente em instantes.',
      })
    }
  })

  // Firebase Hosting (or Vite locally) serves the frontend; this process is API-only.
  app.all('*', (request, response) => {
    response.status(404).json({ message: 'Rota não encontrada.' })
  })

  // Last, so parser, route and framework failures all get client-safe responses.
  app.use((error, request, response, next) => {
    if (response.headersSent) {
      logger.error('[server] response_failed')
      return response.destroy()
    }
    if (error.status === 413) {
      return response.status(413).json({ message: 'O orçamento excede o tamanho permitido.' })
    }
    if (error.status === 415) {
      return response.status(415).json({ message: 'Formato de JSON não suportado.' })
    }
    if (error.status === 400) {
      return response.status(400).json({ message: 'JSON inválido.' })
    }
    logger.error('[server] request_failed')
    return response.status(500).json({ message: 'Erro interno do servidor.' })
  })

  return app
}
