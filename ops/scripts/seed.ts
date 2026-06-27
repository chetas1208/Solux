#!/usr/bin/env tsx
/**
 * Seed script — creates one real project brief for testing.
 *
 * IMPORTANT: This script does NOT import fake data.
 * It creates a project brief with a real prompt and triggers
 * actual API calls to real data sources.
 *
 * Run: pnpm db:seed
 * Requires: MONGODB_URI, GEMINI_API_KEY set in .env
 */
import { createProjectBrief } from '../../apps/api/src/db/repositories/projects.js'
import { closeDb } from '../../apps/api/src/db/mongo.js'

const SAMPLE_PROMPTS = [
  {
    name: 'Gujarat-Rajasthan Screening',
    prompt:
      'Screen Gujarat and Rajasthan for 100 MW solar + 50 MW / 4h storage sites. Avoid dense vegetation. Prioritize grid access and low dust loss. Include shallow coastal and reservoir options if feasible.',
  },
  {
    name: 'Karnataka Floating Solar',
    prompt:
      'Find 50 MW floating solar candidates in Karnataka reservoirs. Maximum 2.5 m water depth. Must be within 15 km of a 66 kV or higher line.',
  },
  {
    name: 'Nevada Utility Scale',
    prompt:
      'Identify utility-scale solar sites in Nevada for 200 MW. Avoid protected desert areas. Require road access within 5 km. No storage required.',
  },
]

async function main() {
  console.log('Creating sample project briefs...')
  for (const sample of SAMPLE_PROMPTS) {
    const brief = await createProjectBrief(sample.prompt)
    console.log(`Created: ${brief.id} — ${sample.name}`)
    console.log(`  Next: POST /v1/projects/${brief.id}/parse-prompt`)
  }
  await closeDb()
  console.log('\nSeed complete. Run the API and parse these prompts to generate real screenings.')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
