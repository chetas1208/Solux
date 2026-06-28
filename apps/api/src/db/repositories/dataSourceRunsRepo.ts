import { v4 as uuid } from 'uuid'
import { getDb } from '../mongo.js'

export interface DataSourceRun {
  id: string
  sourceId: string
  projectId: string
  siteId?: string
  startedAt: string
  completedAt?: string
  status: 'success' | 'error' | 'unavailable'
  errorMessage?: string
  recordsReturned?: number
}

export async function recordDataSourceRun(
  run: Omit<DataSourceRun, 'id'>,
): Promise<DataSourceRun> {
  const db = await getDb()
  const doc: DataSourceRun = { id: uuid(), ...run }
  await db.collection('data_source_runs').insertOne({ ...doc, _id: doc.id } as never)
  return doc
}

export async function listDataSourceRuns(projectId: string): Promise<DataSourceRun[]> {
  const db = await getDb()
  const docs = await db
    .collection('data_source_runs')
    .find({ projectId })
    .sort({ startedAt: -1 })
    .limit(100)
    .toArray()
  return docs.map(({ _id: _, ...rest }) => rest as DataSourceRun)
}
