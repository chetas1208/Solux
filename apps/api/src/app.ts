import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './config/env.js'
import { projectsRouter } from './routes/projects.js'
import { sitesRouter } from './routes/sites.js'
import { reportsRouter } from './routes/reports.js'
import { dataSourcesRouter } from './routes/dataSources.js'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
)

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  }),
)

app.route('/v1/projects', projectsRouter)
app.route('/v1/sites', sitesRouter)
app.route('/v1/reports', reportsRouter)
app.route('/v1/data-sources', dataSourcesRouter)

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error('[API Error]', err)
  return c.json({ error: 'Internal server error', detail: (err as Error).message }, 500)
})

export default app
