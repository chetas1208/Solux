import { getDb } from '../mongo.js'
import type { FatalFlawReport } from '../../agent/schemas.js'

export async function saveReport(report: FatalFlawReport): Promise<void> {
  const db = await getDb()
  await db
    .collection('reports')
    .replaceOne({ id: report.id }, { ...report, _id: report.id } as never, { upsert: true })
}

export async function getReport(id: string): Promise<FatalFlawReport | null> {
  const db = await getDb()
  const doc = await db.collection('reports').findOne({ id })
  if (!doc) return null
  const { _id: _, ...rest } = doc as Record<string, unknown>
  return rest as FatalFlawReport
}

export async function listReportsByProject(projectId: string): Promise<FatalFlawReport[]> {
  const db = await getDb()
  const docs = await db
    .collection('reports')
    .find({ projectId })
    .sort({ generatedAt: -1 })
    .toArray()
  return docs.map(({ _id: _, ...rest }) => rest as FatalFlawReport)
}

export async function listReportsBySite(siteId: string): Promise<FatalFlawReport[]> {
  const db = await getDb()
  const docs = await db
    .collection('reports')
    .find({ siteId })
    .sort({ generatedAt: -1 })
    .toArray()
  return docs.map(({ _id: _, ...rest }) => rest as FatalFlawReport)
}
