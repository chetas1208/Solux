import { getDb } from '../mongo.js'
import type { EvidenceItem, AgentTrace } from '@solux/shared'

export async function insertEvidenceItems(items: EvidenceItem[]): Promise<void> {
  if (items.length === 0) return
  const db = await getDb()
  const docs = items.map((e) => ({ ...e, _id: e.id }))
  await db.collection('evidence_items').insertMany(docs as never[])
}

export async function getEvidenceForSite(siteId: string): Promise<EvidenceItem[]> {
  const db = await getDb()
  const docs = await db.collection('evidence_items').find({ siteId }).toArray()
  return docs.map(({ _id: _, ...rest }) => rest as EvidenceItem)
}

export async function getEvidenceForProject(projectId: string): Promise<EvidenceItem[]> {
  const db = await getDb()
  const docs = await db.collection('evidence_items').find({ projectId }).toArray()
  return docs.map(({ _id: _, ...rest }) => rest as EvidenceItem)
}

export async function saveAgentTrace(trace: AgentTrace): Promise<void> {
  const db = await getDb()
  await db
    .collection('agent_traces')
    .replaceOne({ id: trace.id }, { ...trace, _id: trace.id } as never, { upsert: true })
}

export async function getAgentTraces(projectId: string): Promise<AgentTrace[]> {
  const db = await getDb()
  const docs = await db
    .collection('agent_traces')
    .find({ projectId })
    .sort({ startedAt: -1 })
    .toArray()
  return docs.map(({ _id: _, ...rest }) => rest as AgentTrace)
}
