import { v4 as uuid } from 'uuid'
import { getDb } from '../mongo.js'
import type { ProjectBrief, ProjectSpec } from '@solux/shared'

export async function createProjectBrief(rawPrompt: string): Promise<ProjectBrief> {
  const db = await getDb()
  const doc: ProjectBrief = {
    id: uuid(),
    rawPrompt,
    createdAt: new Date().toISOString(),
  }
  await db.collection<ProjectBrief>('projects').insertOne({ ...doc, _id: doc.id } as never)
  return doc
}

export async function getProjectBrief(id: string): Promise<ProjectBrief | null> {
  const db = await getDb()
  const doc = await db.collection('projects').findOne({ id })
  if (!doc) return null
  const { _id: _, ...rest } = doc as Record<string, unknown>
  return rest as ProjectBrief
}

export async function listProjectBriefs(): Promise<ProjectBrief[]> {
  const db = await getDb()
  const docs = await db.collection('projects').find({}).sort({ createdAt: -1 }).limit(50).toArray()
  return docs.map(({ _id: _, ...rest }) => rest as ProjectBrief)
}

export async function saveProjectSpec(spec: ProjectSpec): Promise<void> {
  const db = await getDb()
  const { id, ...fields } = spec
  await db.collection('parsed_project_specs').updateOne(
    { briefId: spec.briefId },
    { $set: fields, $setOnInsert: { _id: id } },
    { upsert: true },
  )
}

export async function getProjectSpec(briefId: string): Promise<ProjectSpec | null> {
  const db = await getDb()
  const doc = await db.collection('parsed_project_specs').findOne({ briefId })
  if (!doc) return null
  const { _id: _, ...rest } = doc as Record<string, unknown>
  return rest as ProjectSpec
}
