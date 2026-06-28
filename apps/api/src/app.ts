import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './config/env.js'
import { projectsRouter } from './routes/projects.js'
import { sitesRouter } from './routes/sites.js'
import { reportsRouter } from './routes/reports.js'
import { dataSourcesRouter } from './routes/dataSources.js'
import { mapProvidersRouter } from './routes/mapProviders.js'
import { learningLoopRouter } from './routes/learningLoop.js'
import { datasetCatalogRouter } from './routes/datasetCatalog.js'
import { modelOutputsRouter } from './routes/modelOutputs.js'

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
app.route('/v1/map-providers', mapProvidersRouter)
app.route('/v1/dataset', datasetCatalogRouter)
app.route('/v1/model-outputs', modelOutputsRouter)
app.route('/v1/learning-loop', learningLoopRouter)

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error('[API Error]', err)
  return c.json({ error: 'Internal server error', detail: (err as Error).message }, 500)
})

export default app
