import { Hono } from 'hono'
import { getDatasetCatalog } from '../services/spacesCatalogService.js'

export const datasetCatalogRouter = new Hono()

datasetCatalogRouter.get('/catalog', async (c) => {
  const result = await getDatasetCatalog()
  return c.json({ data: result })
})
