#!/usr/bin/env tsx
/**
 * Sets up MongoDB indexes for Solux.
 * Run: pnpm db:indexes
 */
import { setupIndexes, closeDb } from '../../apps/api/src/db/mongo.js'

async function main() {
  console.log('Setting up MongoDB indexes...')
  await setupIndexes()
  await closeDb()
  console.log('Done.')
}

main().catch((err) => {
  console.error('Index setup failed:', err)
  process.exit(1)
})
