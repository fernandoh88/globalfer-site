import assert from 'node:assert/strict'
import { EventEmitter, once } from 'node:events'
import http from 'node:http'
import { setImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import { installShutdown } from '../server/shutdown.js'

async function fixture(t, handler, timeoutMs = 1_000) {
  const server = http.createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => {
    server.close(() => resolve())
    server.closeAllConnections()
  }))

  const signals = new EventEmitter()
  const exits = []
  const logs = []
  let resolveExit
  const exited = new Promise((resolve) => { resolveExit = resolve })
  const cleanup = installShutdown(server, {
    signals,
    timeoutMs,
    exit: (code) => { exits.push(code); resolveExit(code) },
    logger: { log: (message) => logs.push(message), error: (message) => logs.push(message) },
  })
  t.after(cleanup)
  return { server, signals, exits, logs, exited }
}

function request(server) {
  return new Promise((resolve) => {
    const outgoing = http.get({
      host: '127.0.0.1',
      port: server.address().port,
      headers: { Connection: 'close' },
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
      response.on('error', (error) => resolve({ error }))
    })
    outgoing.on('error', (error) => resolve({ error }))
    outgoing.setTimeout(2_000, () => outgoing.destroy(new Error('Loopback request timed out.')))
  })
}

test('shutdown stops accepting requests and drains an active response once across repeated signals', async (t) => {
  let resolveStarted
  const started = new Promise((resolve) => { resolveStarted = resolve })
  const lifecycle = await fixture(t, (_request, response) => resolveStarted(response))
  const pending = request(lifecycle.server)
  const response = await started

  lifecycle.signals.emit('SIGTERM')
  lifecycle.signals.emit('SIGINT')
  lifecycle.signals.emit('SIGTERM')
  assert.equal(lifecycle.server.listening, false)
  assert.deepEqual(lifecycle.exits, [])
  assert.deepEqual(lifecycle.logs, ['[server] shutdown_started'])

  response.end('completed')
  assert.deepEqual(await pending, { status: 200, body: 'completed' })
  assert.equal(await lifecycle.exited, 0)
  assert.deepEqual(lifecycle.exits, [0])
  assert.equal(lifecycle.signals.listenerCount('SIGTERM'), 0)
  assert.equal(lifecycle.signals.listenerCount('SIGINT'), 0)
})

test('shutdown deadline closes a stalled connection and exits once with a safe failure category', async (t) => {
  let resolveStarted
  const started = new Promise((resolve) => { resolveStarted = resolve })
  const lifecycle = await fixture(t, (incoming) => resolveStarted(incoming.socket), 100)
  const pending = request(lifecycle.server)
  const socket = await started

  lifecycle.signals.emit('SIGINT')
  lifecycle.signals.emit('SIGTERM')
  assert.equal(await lifecycle.exited, 1)
  assert.equal(socket.destroyed, true)
  assert.ok((await pending).error instanceof Error)
  await setImmediate()
  assert.deepEqual(lifecycle.exits, [1])
  assert.deepEqual(lifecycle.logs, ['[server] shutdown_started', '[server] shutdown_timeout'])
  assert.equal(lifecycle.signals.listenerCount('SIGTERM'), 0)
  assert.equal(lifecycle.signals.listenerCount('SIGINT'), 0)
})

test('shutdown of an already closed server reports only a fixed failure category', async (t) => {
  const lifecycle = await fixture(t, (_request, response) => response.end())
  await new Promise((resolve) => lifecycle.server.close(resolve))

  lifecycle.signals.emit('SIGTERM')
  assert.equal(await lifecycle.exited, 1)
  assert.deepEqual(lifecycle.exits, [1])
  assert.deepEqual(lifecycle.logs, ['[server] shutdown_started', '[server] shutdown_failed'])
})
