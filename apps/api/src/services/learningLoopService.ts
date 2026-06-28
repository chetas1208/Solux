import { getDb } from '../db/mongo.js'
import { v4 as uuid } from 'uuid'
import {
  listQueryRuns,
  listFeedbackEvents,
  listLearningEvents,
  getActiveScoringPolicy,
  ensureBaselineScoringPolicy,
} from '../db/repositories/lakeRepositories.js'

const DATA_ROOT = process.env['DATA_ROOT'] ?? '/data/solux'

export async function getLearningLoopStatus() {
  const db = await getDb().catch(() => null)
  let policy: Record<string, unknown> = { version: 'v0.1.0-baseline' }
  if (db) {
    policy = ((await getActiveScoringPolicy()) ?? (await ensureBaselineScoringPolicy())) as Record<
      string,
      unknown
    >
  }

  let queryRuns: unknown[] = []
  let feedbackEvents: unknown[] = []
  let learningEvents: unknown[] = []

  if (db) {
    queryRuns = await listQueryRuns(20)
    feedbackEvents = await listFeedbackEvents(20)
    learningEvents = await listLearningEvents(20)
  }

  let lastPolicyEvaluation: Record<string, unknown> | null = null
  let pendingPolicyCandidate: Record<string, unknown> | null = null
  try {
    const { readFile } = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const { join } = await import('node:path')
    const evalPath = join(DATA_ROOT, 'learning/policy_evaluation_latest.json')
    const pendingPath = join(DATA_ROOT, 'learning/policy_candidate_pending.json')
    if (existsSync(evalPath)) {
      lastPolicyEvaluation = JSON.parse(await readFile(evalPath, 'utf8')) as Record<string, unknown>
    }
    if (existsSync(pendingPath)) {
      pendingPolicyCandidate = JSON.parse(await readFile(pendingPath, 'utf8')) as Record<string, unknown>
    }
  } catch {
    /* optional local policy files */
  }

  return {
    activePolicyVersion: String(policy.version ?? 'v0.1.0-baseline'),
    queryRuns,
    feedbackEvents,
    lastPolicyEvaluation,
    lastActivatedPolicy: policy,
    pendingPolicyCandidate,
    metrics: {
      queryRunCount: queryRuns.length,
      feedbackEventCount: feedbackEvents.length,
      learningEventCount: learningEvents.length,
    },
    notes: [
      'Raw source evidence is immutable.',
      'Existing reports are not silently changed.',
      'Policy updates require evaluation before activation.',
    ],
    active: true,
    immutableNote: 'Raw source evidence is immutable.',
    message: 'Learning loop active — updates scoring weights only after evaluation.',
    scoringPolicyVersion: String(policy.version ?? 'v0.1.0-baseline'),
    queryRunsCount: queryRuns.length,
    feedbackEventsCount: feedbackEvents.length,
  }
}

export async function logQueryRun(event: Record<string, unknown>) {
  const db = await getDb()
  const doc = { _id: uuid(), ...event, createdAt: new Date() }
  await db.collection('query_runs').insertOne(doc)
  return doc
}

export async function logFeedback(event: Record<string, unknown>) {
  const db = await getDb()
  const doc = { _id: uuid(), ...event, createdAt: new Date() }
  await db.collection('feedback_events').insertOne(doc)
  await db.collection('learning_events').insertOne({
    _id: uuid(),
    type: 'feedback',
    ...event,
    createdAt: new Date(),
  })
  return doc
}

export async function logLearningEvent(event: Record<string, unknown>) {
  const db = await getDb()
  const doc = { _id: uuid(), ...event, createdAt: new Date() }
  await db.collection('learning_events').insertOne(doc)
  return doc
}
