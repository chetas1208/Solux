import type { Db, Filter, Document } from 'mongodb'
import { getDb } from '../mongo.js'
import { v4 as uuid } from 'uuid'

export interface CandidateSiteSummary {
  candidateId: string
  datasetVersion: string
  country: string
  state: string
  centroid: { type: 'Point'; coordinates: [number, number] }
  bbox?: [number, number, number, number]
  siteSurfaceType: string
  finalScore: number
  confidence: number
  decision: string
  topFatalFlaws: string[]
  topPositiveFactors: string[]
  evidenceIds: string[]
  spacesObjectRefs: Record<string, string>
  missingDataFlags?: string[]
  ingestedAt: Date
}

async function col<T extends Document = Document>(name: string) {
  const db = await getDb()
  return db.collection<T>(name)
}

export async function upsertDatasetCatalogVersion(doc: Record<string, unknown>) {
  const c = await col('dataset_catalog_versions')
  const datasetVersion = String(doc.datasetVersion)
  await c.updateOne(
    { datasetVersion },
    { $set: { ...doc, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  )
}

export async function getActiveDatasetCatalogVersion(): Promise<Record<string, unknown> | null> {
  const c = await col('dataset_catalog_versions')
  return c.findOne({}, { sort: { createdAt: -1 } })
}

export async function bulkUpsertCandidateSummaries(summaries: CandidateSiteSummary[]) {
  if (!summaries.length) return 0
  const c = await col('candidate_site_summaries')
  const ops = summaries.map((s) => ({
    updateOne: {
      filter: { datasetVersion: s.datasetVersion, candidateId: s.candidateId },
      update: { $set: s },
      upsert: true,
    },
  }))
  const res = await c.bulkWrite(ops, { ordered: false })
  return res.upsertedCount + res.modifiedCount
}

export async function insertCandidateSummariesBatch(summaries: CandidateSiteSummary[]) {
  if (!summaries.length) return 0
  const c = await col('candidate_site_summaries')
  const res = await c.insertMany(summaries, { ordered: false })
  return res.insertedCount
}

export async function bulkUpsertCandidateRefs(refs: Record<string, unknown>[]) {
  if (!refs.length) return 0
  const c = await col('candidate_site_refs')
  const ops = refs.map((r) => ({
    updateOne: {
      filter: { datasetVersion: r.datasetVersion, candidateId: r.candidateId },
      update: { $set: r },
      upsert: true,
    },
  }))
  const res = await c.bulkWrite(ops, { ordered: false })
  return res.upsertedCount + res.modifiedCount
}

export async function queryCandidateSummaries(filter: Filter<Document>, limit: number) {
  const c = await col('candidate_site_summaries')
  return c.find(filter).sort({ finalScore: -1 }).limit(limit).toArray()
}

export async function countCandidateSummaries(filter: Filter<Document> = {}) {
  const c = await col('candidate_site_summaries')
  return c.countDocuments(filter)
}

export async function insertQueryRun(doc: Record<string, unknown>) {
  const c = await col('query_runs')
  const record = { _id: uuid(), ...doc, createdAt: new Date() }
  await c.insertOne(record)
  return record
}

export async function updateQueryRun(queryId: string, patch: Record<string, unknown>) {
  const c = await col('query_runs')
  await c.updateOne({ queryId }, { $set: { ...patch, updatedAt: new Date() } })
}

export async function insertParsedSpec(doc: Record<string, unknown>) {
  const c = await col('parsed_project_specs')
  const record = { _id: uuid(), ...doc, createdAt: new Date() }
  await c.insertOne(record)
  return record
}

export async function insertFatalFlawReport(doc: Record<string, unknown>) {
  const c = await col('fatal_flaw_reports')
  const record = { _id: uuid(), ...doc, createdAt: new Date() }
  await c.insertOne(record)
  return record
}

export async function insertModelOutputRefs(refs: Record<string, unknown>[]) {
  if (!refs.length) return
  const c = await col('model_output_refs')
  await c.bulkWrite(
    refs.map((r) => ({
      updateOne: {
        filter: { datasetVersion: r.datasetVersion, candidateId: r.candidateId },
        update: { $set: { ...r, createdAt: new Date() } },
        upsert: true,
      },
    })),
    { ordered: false },
  )
}

export async function insertLearningEvent(doc: Record<string, unknown>) {
  const c = await col('learning_events')
  const record = { _id: uuid(), ...doc, createdAt: new Date() }
  await c.insertOne(record)
  return record
}

export async function insertFeedbackEvent(doc: Record<string, unknown>) {
  const c = await col('feedback_events')
  const record = { _id: uuid(), ...doc, createdAt: new Date() }
  await c.insertOne(record)
  return record
}

export async function getActiveScoringPolicy(): Promise<Record<string, unknown> | null> {
  const c = await col('scoring_policies')
  return c.findOne({ active: true }, { sort: { createdAt: -1 } })
}

export async function ensureBaselineScoringPolicy() {
  const c = await col('scoring_policies')
  const existing = await c.findOne({ version: 'v0.1.0-baseline' })
  if (existing) return existing
  const doc = {
    version: 'v0.1.0-baseline',
    active: true,
    weights: {
      solarOutput: 0.25,
      gridConnectivity: 0.2,
      buildability: 0.15,
      vegetationConflict: 0.15,
      waterFeasibility: 0.1,
      missingDataPenalty: 0.15,
    },
    createdAt: new Date(),
    notes: 'Deterministic baseline — model rerank is ordering only',
  }
  await c.insertOne(doc)
  return doc
}

export async function insertSystemReadinessSnapshot(doc: Record<string, unknown>) {
  const c = await col('system_readiness_snapshots')
  const record = { _id: uuid(), ...doc, createdAt: new Date() }
  await c.insertOne(record)
  return record
}

export async function listQueryRuns(limit = 20) {
  const c = await col('query_runs')
  return c.find({}).sort({ createdAt: -1 }).limit(limit).toArray()
}

export async function listFeedbackEvents(limit = 50) {
  const c = await col('feedback_events')
  return c.find({}).sort({ createdAt: -1 }).limit(limit).toArray()
}

export async function listLearningEvents(limit = 50) {
  const c = await col('learning_events')
  return c.find({}).sort({ createdAt: -1 }).limit(limit).toArray()
}

export async function getModelRerankByCandidateIds(
  datasetVersion: string,
  candidateIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const c = await col('model_output_refs')
  const rows = await c
    .find({ datasetVersion, candidateId: { $in: candidateIds } })
    .toArray()
  return new Map(rows.map((r) => [String(r.candidateId), r as Record<string, unknown>]))
}
