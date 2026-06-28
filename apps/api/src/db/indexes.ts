import type { Db } from 'mongodb'

/** Spec MongoDB indexes — Spaces holds blobs; Mongo holds operational/query metadata. */
export async function setupSpecIndexes(database: Db): Promise<void> {
  await database.collection('projects').createIndexes([
    { key: { createdAt: -1 }, name: 'createdAt_desc' },
    { key: { showcaseSlug: 1 }, unique: true, sparse: true, name: 'showcaseSlug_unique' },
    { key: { id: 1 }, unique: true, name: 'id_unique' },
  ])

  await database.collection('project_query_snapshots').createIndexes([
    { key: { projectId: 1 }, unique: true, name: 'projectId_unique' },
    { key: { updatedAt: -1 }, name: 'updatedAt_desc' },
  ])

  await database.collection('parsed_project_specs').createIndexes([
    { key: { projectId: 1, createdAt: -1 }, name: 'projectId_createdAt' },
  ])

  await database.collection('query_runs').createIndexes([
    { key: { projectId: 1, createdAt: -1 }, name: 'projectId_createdAt' },
    { key: { queryId: 1 }, unique: true, name: 'queryId_unique' },
    { key: { state: 1 }, name: 'state', sparse: true },
  ])

  await database.collection('candidate_site_refs').createIndexes([
    { key: { datasetVersion: 1, candidateId: 1 }, unique: true, name: 'dataset_candidate_unique' },
    { key: { country: 1, state: 1, decision: 1 }, name: 'geo_decision' },
    { key: { finalScore: -1 }, name: 'finalScore_desc' },
    { key: { confidence: -1 }, name: 'confidence_desc' },
  ])

  await database.collection('candidate_site_summaries').createIndexes([
    { key: { geometry: '2dsphere' }, name: 'geometry_2dsphere', sparse: true },
    { key: { 'centroid.coordinates': '2dsphere' }, name: 'centroid_2dsphere', sparse: true },
    { key: { datasetVersion: 1, country: 1, state: 1 }, name: 'dataset_country_state' },
    { key: { decision: 1, finalScore: -1 }, name: 'decision_score' },
  ])

  await database.collection('evidence_refs').createIndexes([
    { key: { projectId: 1, candidateId: 1 }, name: 'project_candidate' },
    { key: { datasetVersion: 1, evidenceId: 1 }, name: 'dataset_evidence' },
  ])

  await database.collection('agent_traces').createIndexes([
    { key: { projectId: 1, queryId: 1, createdAt: -1 }, name: 'project_query_created', sparse: true },
    { key: { projectId: 1, startedAt: -1 }, name: 'project_started', sparse: true },
  ])

  await database.collection('fatal_flaw_reports').createIndexes([
    { key: { projectId: 1, queryId: 1, createdAt: -1 }, name: 'project_query_created' },
    { key: { queryId: 1 }, name: 'queryId', sparse: true },
  ])

  await database.collection('model_output_refs').createIndexes([
    { key: { datasetVersion: 1, candidateId: 1 }, name: 'dataset_candidate' },
    { key: { modelRunId: 1, createdAt: -1 }, name: 'modelRun_created', sparse: true },
  ])

  await database.collection('learning_events').createIndexes([
    { key: { projectId: 1, createdAt: -1 }, name: 'project_created' },
    { key: { scoringPolicyVersion: 1 }, name: 'policy_version', sparse: true },
    { key: { queryId: 1 }, name: 'queryId', sparse: true },
  ])

  await database.collection('feedback_events').createIndexes([
    { key: { projectId: 1, candidateId: 1, createdAt: -1 }, name: 'project_candidate_created' },
  ])

  await database.collection('scoring_policies').createIndexes([
    { key: { version: 1 }, unique: true, name: 'version_unique' },
    { key: { active: 1 }, name: 'active', sparse: true },
  ])

  await database.collection('dataset_catalog_versions').createIndexes([
    { key: { datasetVersion: 1 }, unique: true, name: 'datasetVersion_unique' },
    { key: { createdAt: -1 }, name: 'createdAt_desc' },
  ])

  await database.collection('system_readiness_snapshots').createIndexes([
    { key: { createdAt: -1 }, name: 'createdAt_desc' },
  ])

  // Legacy collections (screening per-project flow)
  await database.collection('candidate_sites').createIndexes([
    { key: { geometry: '2dsphere' }, name: 'geometry_2dsphere', sparse: true },
    { key: { projectId: 1 }, name: 'projectId' },
  ]).catch(() => undefined)

  await database.collection('score_layers').createIndexes([
    { key: { siteId: 1 }, unique: true, name: 'siteId_unique', sparse: true },
    { key: { projectId: 1 }, name: 'projectId' },
  ]).catch(() => undefined)
}
