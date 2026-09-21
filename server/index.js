import 'dotenv/config'
import { createApp } from './app.js'
import { installShutdown } from './shutdown.js'

const port = Number(process.env.PORT || 3001)
const app = createApp()

try {
  const server = app.listen(port, () => {
    console.log('[server] listening')
  })
  server.on('error', () => {
    console.error('[server] startup_failed')
    process.exit(1)
  })
  installShutdown(server)
} catch {
  console.error('[server] startup_failed')
  process.exit(1)
}
