import { getDb } from '../db/mongo.js'
import { v4 as uuid } from 'uuid'

const DATA_ROOT = process.env['DATA_ROOT'] ?? '/data/solux'

export async function getLearningLoopStatus() {
  const db = await getDb().catch(() => null)
  let queryCount = 0
  let feedbackCount = 0

  if (db) {
    queryCount = await db.collection('query_runs').countDocuments()
    feedbackCount = await db.collection('feedback_events').countDocuments()
  }

  const policyPath = `${DATA_ROOT}/learning/scoring_policy_active.json`
  let policyVersion = 'v0.1.0-baseline'
  try {
    const { readFile } = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    if (existsSync(policyPath)) {
      const p = JSON.parse(await readFile(policyPath, 'utf8')) as { scoringPolicyVersion?: string }
      policyVersion = p.scoringPolicyVersion ?? policyVersion
    }
  } catch {
    /* use baseline */
  }

  return {
    active: true,
    scoringPolicyVersion: policyVersion,
    queryRunsCount: queryCount,
    feedbackEventsCount: feedbackCount,
    immutableNote: 'Raw source evidence is immutable.',
    message: 'Learning loop active — updates scoring weights only after evaluation.',
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
  return doc
}
