import { getDb } from '../mongo.js'
import type { ProjectBrief } from '@solux/shared'

export interface ProjectQuerySnapshot {
  projectId: string
  queryId: string
  snapshot: Record<string, unknown>
  candidateCount: number
  avgConfidence: number
  avgScore: number
  topDecision: string
  datasetVersion: string
  updatedAt: string
}

export async function saveProjectQuerySnapshot(
  projectId: string,
  queryResult: Record<string, unknown>,
): Promise<ProjectQuerySnapshot> {
  const db = await getDb()
  const ranked = (queryResult.rankedSites as Array<Record<string, unknown>>) ?? []
  const doc: ProjectQuerySnapshot = {
    projectId,
    queryId: String(queryResult.queryId ?? ''),
    snapshot: queryResult,
    candidateCount: ranked.length,
    avgConfidence: ranked.length
      ? ranked.reduce((s, r) => s + Number(r.confidence ?? 0), 0) / ranked.length
      : 0,
    avgScore: ranked.length
      ? ranked.reduce((s, r) => s + Number(r.finalScore ?? 0), 0) / ranked.length
      : 0,
    topDecision: String(ranked[0]?.decision ?? 'INVESTIGATE'),
    datasetVersion: String(queryResult.datasetVersion ?? 'v0.1'),
    updatedAt: new Date().toISOString(),
  }
  await db.collection('project_query_snapshots').updateOne(
    { projectId },
    { $set: doc },
    { upsert: true },
  )
  return doc
}

export async function getProjectQuerySnapshot(projectId: string): Promise<ProjectQuerySnapshot | null> {
  const db = await getDb()
  const doc = await db.collection('project_query_snapshots').findOne({ projectId })
  if (!doc) return null
  const { _id: _, ...rest } = doc as Record<string, unknown>
  return rest as ProjectQuerySnapshot
}

export interface ProjectListSummary {
  candidateCount: number
  avgConfidence: number
  avgScore: number
  topDecision: string
  datasetVersion: string
  hasResults: boolean
  updatedAt?: string
}

export async function getSummariesForProjects(
  projectIds: string[],
): Promise<Map<string, ProjectListSummary>> {
  const db = await getDb()
  const docs = await db
    .collection('project_query_snapshots')
    .find({ projectId: { $in: projectIds } })
    .toArray()
  const map = new Map<string, ProjectListSummary>()
  for (const doc of docs) {
    const d = doc as Record<string, unknown>
    map.set(String(d.projectId), {
      candidateCount: Number(d.candidateCount ?? 0),
      avgConfidence: Number(d.avgConfidence ?? 0),
      avgScore: Number(d.avgScore ?? 0),
      topDecision: String(d.topDecision ?? 'INVESTIGATE'),
      datasetVersion: String(d.datasetVersion ?? 'v0.1'),
      hasResults: Number(d.candidateCount ?? 0) > 0,
      updatedAt: String(d.updatedAt ?? ''),
    })
  }
  return map
}

export type EnrichedProjectBrief = ProjectBrief & {
  showcaseSlug?: string
  name?: string
  subtitle?: string
  regionLabel?: string
  summary?: ProjectListSummary
}
