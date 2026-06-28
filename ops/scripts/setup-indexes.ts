#!/usr/bin/env tsx
/**
 * Sets up MongoDB indexes for Solux.
 * Run: pnpm db:indexes
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const root = resolve(import.meta.dirname, '../..')
if (existsSync(resolve(root, '.env'))) {
  loadEnv({ path: resolve(root, '.env'), override: true })
}

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
