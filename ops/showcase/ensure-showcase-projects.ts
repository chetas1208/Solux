#!/usr/bin/env tsx
/**
 * Ensures five distinct showcase projects exist and warms query snapshots
 * (real pipeline — ranked sites, map-ready, learning events logged silently).
 */
import 'dotenv/config'
import { ensureShowcaseProjects, warmAllShowcases } from '../../apps/api/src/services/showcaseService.js'
import { setupSpecIndexes } from '../../apps/api/src/db/indexes.js'
import { getDb } from '../../apps/api/src/db/mongo.js'

async function main() {
  const force = process.argv.includes('--force')
  const db = await getDb()
  await setupSpecIndexes(db)

  const projects = await ensureShowcaseProjects()
  console.log(`Showcase projects: ${projects.length}`)
  for (const p of projects) {
    console.log(`  · ${p.showcaseSlug} → ${p.id} (${p.name})`)
  }

  console.log(force ? 'Warming all snapshots (force)…' : 'Warming missing/stale snapshots…')
  const { warmed, total } = await warmAllShowcases(force)
  console.log(`Done: ${warmed}/${total} projects have map-ready results.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
