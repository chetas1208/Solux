import { Hono } from 'hono'
import { listReportsByProject, getReport } from '../db/repositories/reportsRepo.js'

export const reportsRouter = new Hono()

reportsRouter.get('/', async (c) => {
  const projectId = c.req.query('projectId')
  if (!projectId) return c.json({ error: 'projectId query param required' }, 400)
  const reports = await listReportsByProject(projectId)
  return c.json({ data: reports })
})

reportsRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const report = await getReport(id)
  if (!report) return c.json({ error: 'Report not found' }, 404)
  return c.json({ data: report })
})
