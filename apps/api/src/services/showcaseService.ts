import { v4 as uuid } from 'uuid'
import { getDb } from '../db/mongo.js'
import {
  SHOWCASE_CATALOG,
  catalogBySlug,
  normalizePromptKey,
  type ShowcaseEntry,
} from '../showcase/showcaseCatalog.js'
import {
  getProjectQuerySnapshot,
  saveProjectQuerySnapshot,
  getSummariesForProjects,
  type EnrichedProjectBrief,
} from '../db/repositories/projectSnapshotsRepo.js'
import { getProjectSpec, saveProjectSpec } from '../db/repositories/projects.js'
import { parseProjectPrompt } from '../agent/parseProjectPrompt.js'
import { saveAgentTrace } from '../db/repositories/agentTraceRepo.js'
import { runQueryPipeline } from './queryPipelineService.js'
import { isLlmAvailable } from '../agent/llmClient.js'

const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export async function upsertShowcaseBrief(entry: ShowcaseEntry): Promise<EnrichedProjectBrief> {
  const db = await getDb()
  const existing = await db.collection('projects').findOne({ showcaseSlug: entry.slug })
  const now = new Date().toISOString()

  if (existing) {
    await db.collection('projects').updateOne(
      { showcaseSlug: entry.slug },
      {
        $set: {
          name: entry.name,
          subtitle: entry.subtitle,
          regionLabel: entry.regionLabel,
          rawPrompt: entry.rawPrompt,
          defaultQuery: entry.defaultQuery,
          country: entry.country,
          updatedAt: now,
        },
      },
    )
    const { _id: _, ...rest } = existing as Record<string, unknown>
    return { ...(rest as EnrichedProjectBrief), name: entry.name, subtitle: entry.subtitle }
  }

  const id = uuid()
  const doc = {
    id,
    _id: id,
    rawPrompt: entry.rawPrompt,
    createdAt: now,
    showcaseSlug: entry.slug,
    name: entry.name,
    subtitle: entry.subtitle,
    regionLabel: entry.regionLabel,
    defaultQuery: entry.defaultQuery,
    country: entry.country,
  }
  await db.collection('projects').insertOne(doc as never)
  return doc as EnrichedProjectBrief
}

export async function ensureShowcaseProjects(): Promise<EnrichedProjectBrief[]> {
  const out: EnrichedProjectBrief[] = []
  for (const entry of SHOWCASE_CATALOG) {
    out.push(await upsertShowcaseBrief(entry))
  }
  return out
}

export async function listProjectsForUi(): Promise<EnrichedProjectBrief[]> {
  await ensureShowcaseProjects()
  const db = await getDb()

  const showcaseDocs = await db
    .collection('projects')
    .find({ showcaseSlug: { $exists: true, $ne: null } })
    .toArray()

  const showcaseKeys = new Set(SHOWCASE_CATALOG.map((e) => normalizePromptKey(e.rawPrompt)))
  const slugToBrief = new Map<string, EnrichedProjectBrief>()
  for (const doc of showcaseDocs) {
    const { _id: _, ...rest } = doc as Record<string, unknown>
    const brief = rest as EnrichedProjectBrief
    if (brief.showcaseSlug) slugToBrief.set(brief.showcaseSlug, brief)
  }

  const userDocs = await db
    .collection('projects')
    .find({ $or: [{ showcaseSlug: { $exists: false } }, { showcaseSlug: null }] })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray()

  const seenPrompts = new Set<string>()
  const dedupedUser: EnrichedProjectBrief[] = []
  for (const doc of userDocs) {
    const brief = doc as Record<string, unknown>
    const key = normalizePromptKey(String(brief.rawPrompt ?? ''))
    if (showcaseKeys.has(key)) continue
    if (seenPrompts.has(key)) continue
    seenPrompts.add(key)
    const { _id: _, ...rest } = brief
    dedupedUser.push(rest as EnrichedProjectBrief)
    if (dedupedUser.length >= 10) break
  }

  const showcase = SHOWCASE_CATALOG.map((e) => slugToBrief.get(e.slug)).filter(
    (p): p is EnrichedProjectBrief => Boolean(p),
  )

  const all = [...showcase, ...dedupedUser]
  const summaries = await getSummariesForProjects(all.map((p) => p.id))
  return all.map((p) => {
    const summary = summaries.get(p.id)
    return summary ? { ...p, summary } : p
  })
}

export async function warmShowcaseProject(projectId: string, force = false): Promise<boolean> {
  const db = await getDb()
  const brief = await db.collection('projects').findOne({ id: projectId })
  if (!brief?.showcaseSlug) return false

  const entry = catalogBySlug(String(brief.showcaseSlug))
  if (!entry) return false

  const existing = await getProjectQuerySnapshot(projectId)
  if (
    !force &&
    existing &&
    Date.now() - new Date(existing.updatedAt).getTime() < SNAPSHOT_MAX_AGE_MS &&
    existing.candidateCount > 0
  ) {
    return true
  }

  let spec = await getProjectSpec(projectId)
  if (!spec) {
    if (!isLlmAvailable()) return false
    const parsed = await parseProjectPrompt(entry.rawPrompt, projectId)
    await saveProjectSpec(parsed.spec)
    await saveAgentTrace(parsed.trace)
    spec = parsed.spec
  }

  const result = await runQueryPipeline({
    projectId,
    userPrompt: entry.defaultQuery,
    limit: 10,
    existingSpec: spec,
  })

  await saveProjectQuerySnapshot(projectId, result as unknown as Record<string, unknown>)
  return true
}

export async function warmAllShowcases(force = false): Promise<{ warmed: number; total: number }> {
  const projects = await ensureShowcaseProjects()
  let warmed = 0
  for (const p of projects) {
    if (await warmShowcaseProject(p.id, force)) warmed++
  }
  return { warmed, total: projects.length }
}

export async function getProjectLastQuery(projectId: string) {
  const snap = await getProjectQuerySnapshot(projectId)
  if (!snap) return null
  return snap.snapshot
}

export function showcaseFlyTo(slug: string) {
  return catalogBySlug(slug)?.flyTo ?? null
}
