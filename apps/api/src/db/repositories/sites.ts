import { v4 as uuid } from 'uuid'
import { getDb } from '../mongo.js'
import type { CandidateSite, ScoreBreakdown, FatalFlawDecision } from '@solux/shared'

export async function insertSites(sites: CandidateSite[]): Promise<void> {
  if (sites.length === 0) return
  const db = await getDb()
  const docs = sites.map((s) => ({ ...s, _id: s.id }))
  await db.collection('candidate_sites').insertMany(docs as never[])
}

export async function getSite(id: string): Promise<CandidateSite | null> {
  const db = await getDb()
  const doc = await db.collection('candidate_sites').findOne({ id })
  if (!doc) return null
  const { _id: _, ...rest } = doc as Record<string, unknown>
  return rest as CandidateSite
}

export async function getSitesByProject(projectId: string): Promise<CandidateSite[]> {
  const db = await getDb()
  const docs = await db.collection('candidate_sites').find({ projectId }).toArray()
  return docs.map(({ _id: _, ...rest }) => rest as CandidateSite)
}

export async function saveScoreBreakdown(score: ScoreBreakdown): Promise<void> {
  const db = await getDb()
  await db
    .collection('score_layers')
    .replaceOne({ siteId: score.siteId }, { ...score, _id: score.siteId } as never, { upsert: true })
}

export async function getScoreBreakdown(siteId: string): Promise<ScoreBreakdown | null> {
  const db = await getDb()
  const doc = await db.collection('score_layers').findOne({ siteId })
  if (!doc) return null
  const { _id: _, ...rest } = doc as Record<string, unknown>
  return rest as ScoreBreakdown
}

export async function getScoresByProject(projectId: string): Promise<ScoreBreakdown[]> {
  const db = await getDb()
  const docs = await db.collection('score_layers').find({ projectId }).toArray()
  return docs.map(({ _id: _, ...rest }) => rest as ScoreBreakdown)
}

export async function saveFatalFlawDecision(decision: FatalFlawDecision): Promise<void> {
  const db = await getDb()
  await db
    .collection('reports')
    .replaceOne(
      { siteId: decision.siteId },
      { ...decision, _id: decision.id } as never,
      { upsert: true },
    )
}

export async function getFatalFlawDecision(siteId: string): Promise<FatalFlawDecision | null> {
  const db = await getDb()
  const doc = await db.collection('reports').findOne({ siteId })
  if (!doc) return null
  const { _id: _, ...rest } = doc as Record<string, unknown>
  return rest as FatalFlawDecision
}
