import { getDb } from '../mongo.js'
import type { AgentTrace } from '../../agent/schemas.js'

export async function saveAgentTrace(trace: AgentTrace): Promise<void> {
  const db = await getDb()
  await db
    .collection('agent_traces')
    .replaceOne({ id: trace.id }, { ...trace, _id: trace.id } as never, { upsert: true })
}

export async function listAgentTraces(projectId: string, limit = 20): Promise<AgentTrace[]> {
  const db = await getDb()
  const docs = await db
    .collection('agent_traces')
    .find({ projectId })
    .sort({ startedAt: -1 })
    .limit(limit)
    .toArray()
  return docs.map(({ _id: _, ...rest }) => rest as AgentTrace)
}
