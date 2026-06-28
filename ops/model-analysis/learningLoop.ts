import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dataRoot, envPath, writeJson } from './config.js'

export interface ScoringPolicy {
  scoringPolicyVersion: string
  updatedAt: string
  reason: string
  evidenceCount: number
  feedbackCount: number
  queryRunCount: number
  previousWeights: Record<string, number>
  newWeights: Record<string, number>
  evaluationResult: {
    activated: boolean
    precisionAt10?: number
    ndcgAt20?: number
    unsupportedClaimRate?: number
    notes: string[]
  }
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  solarOutput: 0.25,
  gridConnectivity: 0.2,
  buildability: 0.15,
  vegetationConflict: 0.15,
  waterFeasibility: 0.1,
  missingDataPenalty: 0.15,
}

async function loadPolicy(): Promise<ScoringPolicy> {
  const path = join(dataRoot(), 'learning/scoring_policy_active.json')
  if (existsSync(path)) {
    return JSON.parse(await readFile(path, 'utf8')) as ScoringPolicy
  }
  return {
    scoringPolicyVersion: 'v0.1.0-baseline',
    updatedAt: new Date().toISOString(),
    reason: 'Initial deterministic baseline — no feedback yet',
    evidenceCount: 0,
    feedbackCount: 0,
    queryRunCount: 0,
    previousWeights: { ...DEFAULT_WEIGHTS },
    newWeights: { ...DEFAULT_WEIGHTS },
    evaluationResult: {
      activated: true,
      notes: ['Raw source evidence is immutable.'],
    },
  }
}

export async function getLearningLoopStatus() {
  const policy = await loadPolicy()
  const eventsPath = join(dataRoot(), 'learning/query_events.jsonl')
  let queryRunCount = 0
  if (existsSync(eventsPath)) {
    const lines = (await readFile(eventsPath, 'utf8')).trim().split('\n').filter(Boolean)
    queryRunCount = lines.length
  }
  return {
    active: true,
    policy,
    queryRunCount,
    feedbackCount: policy.feedbackCount,
    message: 'Learning loop active — updates scoring weights only, never raw evidence.',
  }
}

export async function recordQueryEvent(event: Record<string, unknown>) {
  const dir = join(dataRoot(), 'learning')
  await mkdir(dir, { recursive: true })
  const line = JSON.stringify({ ...event, createdAt: new Date().toISOString() }) + '\n'
  await writeFile(join(dir, 'query_events.jsonl'), line, { flag: 'a' })
}

export async function recordFeedback(feedback: Record<string, unknown>) {
  const dir = join(dataRoot(), 'learning')
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, 'feedback_events.jsonl'),
    JSON.stringify({ ...feedback, createdAt: new Date().toISOString() }) + '\n',
    { flag: 'a' },
  )
}

if (process.argv.includes('--status-only')) {
  getLearningLoopStatus().then((s) => {
    console.log(JSON.stringify(s, null, 2))
  })
}
