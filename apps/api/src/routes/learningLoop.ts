import { Hono } from 'hono'
import { getLearningLoopStatus } from '../services/learningLoopService.js'

export const learningLoopRouter = new Hono()

learningLoopRouter.get('/status', async (c) => {
  const status = await getLearningLoopStatus()
  return c.json({ data: status })
})
