import { build, loadEnv } from 'vite'

// A local verification build may omit the backend; a Hosting upload must not.
// Use the same production-mode public configuration that Vite will compile.
const env = loadEnv('production', process.cwd(), 'VITE_')
let api
try {
  api = new URL(env.VITE_API_URL)
} catch {
  throw new Error('Configure VITE_API_URL with the real HTTPS backend origin before preparing a Firebase deployment.')
}
if (api.protocol !== 'https:' || api.origin !== env.VITE_API_URL || api.origin === 'https://globalfer-site.web.app') {
  throw new Error('VITE_API_URL must be the separate HTTPS backend origin, without credentials, a path, query, fragment, or trailing slash.')
}
if (env.VITE_BASE_PATH && env.VITE_BASE_PATH !== '/') {
  throw new Error('Firebase Hosting requires VITE_BASE_PATH=/ or an unset value.')
}

// Rebuild after validation so a previously unconfigured dist cannot be uploaded.
await build({ mode: 'production', base: '/' })
