import { MongoClient, type Db } from 'mongodb'
import { dbConfig } from '@solux/config'
import { setupSpecIndexes } from './indexes.js'

let client: MongoClient | null = null
let db: Db | null = null

export async function getDb(): Promise<Db> {
  if (db) return db
  if (!dbConfig.uri) {
    throw new Error(
      'MONGODB_URI is not configured. Set it in .env to connect to MongoDB Atlas.',
    )
  }
  client = new MongoClient(dbConfig.uri, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 300000,
  })
  await client.connect()
  db = client.db(dbConfig.dbName)
  return db
}

export async function closeDb(): Promise<void> {
  await client?.close()
  client = null
  db = null
}

export async function setupIndexes(): Promise<void> {
  const database = await getDb()

  // candidate_sites — 2dsphere for geospatial queries
  await database.collection('candidate_sites').createIndexes([
    { key: { geometry: '2dsphere' }, name: 'geometry_2dsphere' },
    { key: { projectId: 1 }, name: 'projectId' },
    { key: { 'centroid.coordinates': '2dsphere' }, name: 'centroid_2dsphere' },
  ])

  // projects
  await database.collection('projects').createIndexes([
    { key: { createdAt: -1 }, name: 'createdAt_desc' },
    { key: { userId: 1 }, name: 'userId', sparse: true },
  ])

  // evidence_items — vector-search-ready schema (embedding field defined, index not required)
  await database.collection('evidence_items').createIndexes([
    { key: { siteId: 1 }, name: 'siteId' },
    { key: { projectId: 1 }, name: 'projectId' },
    { key: { source: 1 }, name: 'source' },
    // embedding field exists for Atlas Vector Search — create via Atlas UI if needed
  ])

  // score_layers
  await database.collection('score_layers').createIndexes([
    { key: { siteId: 1 }, unique: true, name: 'siteId_unique' },
    { key: { projectId: 1 }, name: 'projectId' },
    { key: { 'scoreBreakdown.finalDecision': 1 }, name: 'finalDecision' },
  ])

  // agent_traces
  await database.collection('agent_traces').createIndexes([
    { key: { projectId: 1 }, name: 'projectId' },
    { key: { startedAt: -1 }, name: 'startedAt_desc' },
  ])

  // parsed_project_specs
  await database.collection('parsed_project_specs').createIndexes([
    { key: { briefId: 1 }, unique: true, name: 'briefId_unique' },
  ])

  // reports
  await database.collection('reports').createIndexes([
    { key: { projectId: 1 }, name: 'projectId' },
    { key: { siteId: 1 }, name: 'siteId' },
    { key: { generatedAt: -1 }, name: 'generatedAt_desc' },
    { key: { 'scoreBreakdown.finalDecision': 1 }, name: 'decision' },
  ])

  // data_source_runs
  await database.collection('data_source_runs').createIndexes([
    { key: { projectId: 1 }, name: 'projectId' },
    { key: { sourceId: 1 }, name: 'sourceId' },
    { key: { startedAt: -1 }, name: 'startedAt_desc' },
  ])

  await setupSpecIndexes(database)
  console.log('MongoDB indexes set up successfully')
}
