import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  createProjectBrief,
  getProjectBrief,
  saveProjectSpec,
  getProjectSpec,
} from '../db/repositories/projects.js'
import { getSitesByProject, getScoresByProject } from '../db/repositories/sites.js'
import { getEvidenceForProject } from '../db/repositories/evidence.js'
import { saveAgentTrace } from '../db/repositories/agentTraceRepo.js'
import { parseProjectPrompt } from '../agent/parseProjectPrompt.js'
import { isLlmAvailable, llmUnavailableReason } from '../agent/llmClient.js'
import { runScreeningJob } from '../jobs/screeningJob.js'
import { getModelRerankForProject } from '../services/modelOutputService.js'
import { logFeedback } from '../services/learningLoopService.js'
import { runQueryPipeline } from '../services/queryPipelineService.js'
import {
  listProjectsForUi,
  getProjectLastQuery,
  warmAllShowcases,
  warmShowcaseProject,
} from '../services/showcaseService.js'
import { saveProjectQuerySnapshot } from '../db/repositories/projectSnapshotsRepo.js'

export const projectsRouter = new Hono()

const queryBodySchema = z
  .object({
    prompt: z.string().min(3).max(4000).optional(),
    query: z.string().min(3).max(4000).optional(),
    regionHint: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  })
  .refine((d) => Boolean(d.prompt || d.query), { message: 'prompt or query required' })

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
  const briefs = await listProjectsForUi()
  void warmAllShowcases(false).catch(() => undefined)
  return c.json({ data: briefs })
})

projectsRouter.get('/:id/last-query', async (c) => {
  const id = c.req.param('id')
  const brief = await getProjectBrief(id)
  if (!brief) return c.json({ error: 'Project not found' }, 404)

  let snapshot = await getProjectLastQuery(id)
  if (!snapshot) {
    await warmShowcaseProject(id, false)
    snapshot = await getProjectLastQuery(id)
  }
  if (!snapshot) return c.json({ error: 'No results yet' }, 404)
  return c.json({ data: snapshot })
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

  if (!isLlmAvailable()) {
    return c.json(
      { error: 'LLM not configured', detail: llmUnavailableReason() },
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

projectsRouter.get('/:id/model-rerank', async (c) => {
  const id = c.req.param('id')
  const rerank = await getModelRerankForProject(id)
  return c.json({ data: rerank })
})

projectsRouter.post(
  '/:id/query',
  zValidator('json', queryBodySchema),
  async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const userPrompt = body.prompt ?? body.query!
    const brief = await getProjectBrief(id)
    if (!brief) return c.json({ error: 'Project not found' }, 404)

    const existingSpec = await getProjectSpec(id)

    try {
      const result = await runQueryPipeline({
        projectId: id,
        userPrompt,
        regionHint: body.regionHint,
        limit: body.limit,
        existingSpec: existingSpec ?? null,
      })

      await saveProjectQuerySnapshot(id, result as unknown as Record<string, unknown>)

      return c.json({ data: result })
    } catch (err) {
      const msg = String(err)
      if (msg.includes('UNSUPPORTED_REGION')) {
        const countries = msg.replace('Error: UNSUPPORTED_REGION:', '').split(',').map((c) => c.trim())
        return c.json(
          {
            error: 'UNSUPPORTED_REGION',
            detail: `Solux currently supports solar screening in India and the United States. Unsupported: ${countries.join(', ')}`,
            unsupportedCountries: countries,
          },
          422,
        )
      }
      return c.json({ error: 'Query pipeline failed', detail: String(err) }, 500)
    }
  },
)

projectsRouter.post(
  '/:id/feedback',
  zValidator(
    'json',
    z.object({
      siteId: z.string(),
      verdict: z.enum(['accepted', 'rejected', 'corrected']),
      reason: z.string().optional(),
      rating: z.number().min(1).max(5).optional(),
      correction: z.string().optional(),
      missingSourceNote: z.string().optional(),
    }),
  ),
  async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    await logFeedback({ projectId: id, ...body })
    return c.json({
      data: {
        recorded: true,
        message: 'Feedback recorded — scoring policy updates only after evaluation.',
      },
    })
  },
)
