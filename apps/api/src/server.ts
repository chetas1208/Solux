import { serve } from '@hono/node-server'
import { env } from './config/env.js'
import app from './app.js'

const port = env.PORT
const host = env.API_HOST
console.log(`Solux API starting on http://${host}:${port}`)

serve({ fetch: app.fetch, port, hostname: host })

export default app
