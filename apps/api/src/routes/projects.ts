import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  createProjectBrief,
  getProjectBrief,
  listProjectBriefs,
  saveProjectSpec,
  getProjectSpec,
} from '../db/repositories/projects.js'
import { getSitesByProject, getScoresByProject } from '../db/repositories/sites.js'
import { getEvidenceForProject } from '../db/repositories/evidence.js'
import { saveAgentTrace } from '../db/repositories/agentTraceRepo.js'
import { parseProjectPrompt } from '../agent/parseProjectPrompt.js'
import { GeminiClient } from '../agent/geminiClient.js'
import { runScreeningJob } from '../jobs/screeningJob.js'

export const projectsRouter = new Hono()

projectsRouter.post(
  '/',
  zValidator('json', z.object({ rawPrompt: z.string().min(10).max(4000) })),
  async (c) => {
    const { rawPrompt } = c.req.valid('json')
    const brief = await createProjectBrief(rawPrompt)
    return c.json({ data: brief }, 201)
  },
)

projectsRouter.get('/', async (c) => {
  const briefs = await listProjectBriefs()
  return c.json({ data: briefs })
})

projectsRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const brief = await getProjectBrief(id)
  if (!brief) return c.json({ error: 'Project not found' }, 404)
  const spec = await getProjectSpec(id)
  return c.json({ data: { brief, spec } })
})

projectsRouter.post('/:id/parse-prompt', async (c) => {
  const id = c.req.param('id')
  const brief = await getProjectBrief(id)
  if (!brief) return c.json({ error: 'Project not found' }, 404)

  if (!GeminiClient.isAvailable()) {
    return c.json(
      { error: 'Gemini not configured', detail: 'Set GEMINI_API_KEY in .env' },
      503,
    )
  }

  try {
    const { spec, trace } = await parseProjectPrompt(brief.rawPrompt, brief.id)
    await saveProjectSpec(spec)
    await saveAgentTrace(trace)
    return c.json({ data: { spec, traceId: trace.id } })
  } catch (err) {
    return c.json({ error: 'Parsing failed', detail: String(err) }, 500)
  }
})

projectsRouter.post('/:id/run-screening', async (c) => {
  const id = c.req.param('id')
  const spec = await getProjectSpec(id)
  if (!spec) {
    return c.json(
      { error: 'Project spec not found', detail: 'Run POST /v1/projects/:id/parse-prompt first' },
      400,
    )
  }

  try {
    const result = await runScreeningJob(spec)
    return c.json({
      data: {
        siteCount: result.sites.length,
        evidenceCount: result.evidenceCount,
        decisions: result.decisions.map((d) => ({
          siteId: d.siteId,
          siteName: result.sites.find((s) => s.id === d.siteId)?.name,
          decision: d.decision,
          finalScore: d.scoreBreakdown.finalScore,
          confidence: d.scoreBreakdown.confidence,
          headline: d.headline,
        })),
        errors: result.errors,
      },
    })
  } catch (err) {
    return c.json({ error: 'Screening failed', detail: String(err) }, 500)
  }
})

projectsRouter.get('/:id/sites', async (c) => {
  const id = c.req.param('id')
  const sites = await getSitesByProject(id)
  const scores = await getScoresByProject(id)
  const scoreMap = new Map(scores.map((s) => [s.siteId, s]))
  return c.json({
    data: sites.map((site) => ({
      ...site,
      scoreBreakdown: scoreMap.get(site.id) ?? null,
    })),
  })
})

projectsRouter.get('/:id/evidence', async (c) => {
  const id = c.req.param('id')
  const evidence = await getEvidenceForProject(id)
  return c.json({ data: evidence })
})
