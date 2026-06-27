import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { serverConfig } from '@solux/config'
import { getDataSourceStatuses } from './data/dataRegistry.js'
import { projectsRouter } from './routes/projects.js'
import { sitesRouter } from './routes/sites.js'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: serverConfig.corsOrigin,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
)

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    environment: serverConfig.nodeEnv,
  })
})

// Data source status
app.get('/v1/data-sources', (c) => {
  return c.json({ data: getDataSourceStatuses() })
})

// Routers
app.route('/v1/projects', projectsRouter)
app.route('/v1/sites', sitesRouter)

// 404
app.notFound((c) => c.json({ error: 'Not found' }, 404))

// Error handler
app.onError((err, c) => {
  console.error('[API Error]', err)
  return c.json({ error: 'Internal server error', detail: err.message }, 500)
})

const port = serverConfig.port
console.log(`Solux API starting on http://${serverConfig.host}:${port}`)

serve({
  fetch: app.fetch,
  port,
  hostname: serverConfig.host,
})

export default app
