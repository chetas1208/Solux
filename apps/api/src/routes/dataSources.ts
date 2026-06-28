import { Hono } from 'hono'
import { getDataSourceStatuses } from '../data/dataSourceStatus.js'

export const dataSourcesRouter = new Hono()

dataSourcesRouter.get('/', async (c) => {
  const deep = c.req.query('deep') === 'true'
  const statuses = await getDataSourceStatuses(deep)
  const available = statuses.filter((s) => s.available).length
  return c.json({
    data: statuses,
    meta: { total: statuses.length, available },
  })
})
