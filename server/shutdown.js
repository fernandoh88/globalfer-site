export const installShutdown = (server, {
  signals = process,
  exit = (code) => process.exit(code),
  logger = console,
  timeoutMs = 8_000,
} = {}) => {
  let shuttingDown = false
  let finished = false
  let deadline

  const cleanup = () => {
    clearTimeout(deadline)
    signals.removeListener('SIGTERM', shutdown)
    signals.removeListener('SIGINT', shutdown)
  }

  const finish = (code, force = false) => {
    if (finished) return
    finished = true
    cleanup()
    if (force) server.closeAllConnections()
    exit(code)
  }

  const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true
    logger.log('[server] shutdown_started')
    deadline = setTimeout(() => {
      logger.error('[server] shutdown_timeout')
      finish(1, true)
    }, Math.min(timeoutMs, 8_000))
    deadline.unref()

    server.close((error) => {
      if (finished) return
      if (error) logger.error('[server] shutdown_failed')
      finish(error ? 1 : 0)
    })
    server.closeIdleConnections()
  }

  signals.on('SIGTERM', shutdown)
  signals.on('SIGINT', shutdown)
  return cleanup
}
