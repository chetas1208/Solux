import { Hono } from 'hono'
import { getModelOutputStatus } from '../services/modelOutputService.js'

export const modelOutputsRouter = new Hono()

modelOutputsRouter.get('/status', async (c) => {
  const status = await getModelOutputStatus()
  return c.json({ data: status })
})
