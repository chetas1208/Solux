import { getDb } from '../mongo.js'
import type { ProjectBrief } from '@solux/shared'

export interface ProjectQuerySnapshot {
  projectId: string
  queryId: string
  snapshot: Record<string, unknown>
  candidateCount: number
  avgConfidence: number
  avgScore: number
  scoreMin: number
  scoreMax: number
  avgSolar: number
  avgGrid: number
  primaryStates: string[]
  topSiteLabel: string
  topDecision: string
  datasetVersion: string
  updatedAt: string
}

function buildSummaryFields(ranked: Array<Record<string, unknown>>) {
  const scores = ranked.map((r) => Number(r.finalScore ?? 0))
  const confidences = ranked.map((r) => Number(r.confidence ?? 0))
  const solars = ranked.map((r) => Number(r.solarScore ?? 0)).filter((n) => n > 0)
  const grids = ranked.map((r) => Number(r.gridScore ?? 0)).filter((n) => n > 0)
  const stateCounts = new Map<string, number>()
  for (const r of ranked) {
    const st = String(r.state ?? '').trim()
    if (st) stateCounts.set(st, (stateCounts.get(st) ?? 0) + 1)
  }
  const primaryStates = [...stateCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s)

  const top = ranked[0]
  const topSiteLabel =
    String(top?.displayLabel ?? top?.locality ?? top?.state ?? '').trim() ||
    (top?.centroid
      ? `${Number((top.centroid as { coordinates?: number[] }).coordinates?.[1] ?? 0).toFixed(2)}°N`
      : '')

  return {
    candidateCount: ranked.length,
    avgConfidence: confidences.length
      ? confidences.reduce((s, n) => s + n, 0) / confidences.length
      : 0,
    avgScore: scores.length ? scores.reduce((s, n) => s + n, 0) / scores.length : 0,
    scoreMin: scores.length ? Math.min(...scores) : 0,
    scoreMax: scores.length ? Math.max(...scores) : 0,
    avgSolar: solars.length ? solars.reduce((s, n) => s + n, 0) / solars.length : 0,
    avgGrid: grids.length ? grids.reduce((s, n) => s + n, 0) / grids.length : 0,
    primaryStates,
    topSiteLabel,
    topDecision: String(top?.decision ?? 'INVESTIGATE'),
  }
}

export async function saveProjectQuerySnapshot(
  projectId: string,
  queryResult: Record<string, unknown>,
): Promise<ProjectQuerySnapshot> {
  const db = await getDb()
  const ranked = (queryResult.rankedSites as Array<Record<string, unknown>>) ?? []
  const fields = buildSummaryFields(ranked)
  const doc: ProjectQuerySnapshot = {
    projectId,
    queryId: String(queryResult.queryId ?? ''),
    snapshot: queryResult,
    datasetVersion: String(queryResult.datasetVersion ?? 'v0.1'),
    updatedAt: new Date().toISOString(),
    ...fields,
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
  scoreMin: number
  scoreMax: number
  avgSolar: number
  avgGrid: number
  primaryStates: string[]
  topSiteLabel: string
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
      scoreMin: Number(d.scoreMin ?? 0),
      scoreMax: Number(d.scoreMax ?? 0),
      avgSolar: Number(d.avgSolar ?? 0),
      avgGrid: Number(d.avgGrid ?? 0),
      primaryStates: Array.isArray(d.primaryStates) ? (d.primaryStates as string[]) : [],
      topSiteLabel: String(d.topSiteLabel ?? ''),
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
