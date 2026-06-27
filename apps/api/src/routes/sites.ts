import { Hono } from 'hono'
import { getSite, getScoreBreakdown, getFatalFlawDecision } from '../db/repositories/sites.js'
import { getEvidenceForSite, getAgentTraces } from '../db/repositories/evidence.js'
import { ReportGenerator } from '../agent/reportGenerator.js'
import { MiniMaxClient } from '../agent/minimaxClient.js'
import { checkReportClaims } from '../agent/evidenceGuard.js'
import { saveFatalFlawDecision, saveScoreBreakdown } from '../db/repositories/sites.js'
import { saveAgentTrace } from '../db/repositories/evidence.js'

export const sitesRouter = new Hono()

/** GET /v1/sites/:id */
sitesRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const site = await getSite(id)
  if (!site) return c.json({ error: 'Site not found' }, 404)
  const score = await getScoreBreakdown(id)
  return c.json({ data: { site, scoreBreakdown: score } })
})

/** GET /v1/sites/:id/report — generate or retrieve fatal-flaw report */
sitesRouter.get('/:id/report', async (c) => {
  const id = c.req.param('id')
  const site = await getSite(id)
  if (!site) return c.json({ error: 'Site not found' }, 404)

  const decision = await getFatalFlawDecision(id)
  if (!decision) return c.json({ error: 'Site has not been scored yet' }, 404)

  const evidence = await getEvidenceForSite(id)

  // Generate AI report if Gemini is available
  let aiReport = null
  let guardResult = null

  if (ReportGenerator && process.env['GEMINI_API_KEY']) {
    try {
      const generator = new ReportGenerator()
      const { report, trace } = await generator.generateSiteReport(
        site,
        decision,
        evidence,
        site.projectId,
      )
      await saveAgentTrace(trace)

      // Evidence guard
      const allText = [
        report.executiveSummary,
        ...report.keyFindings,
        ...report.recommendedNextSteps,
      ].join(' ')
      guardResult = checkReportClaims(allText, evidence)

      // Update hallucination fraction on decision
      const updatedDecision = { ...decision, unsupportedClaimFraction: guardResult.unsupportedClaimFraction }
      await saveFatalFlawDecision(updatedDecision)

      aiReport = { ...report, guardResult }
    } catch (err) {
      aiReport = null
    }
  }

  return c.json({
    data: {
      site,
      decision,
      evidence,
      aiReport,
      miniMaxAvailable: MiniMaxClient.isAvailable(),
    },
  })
})

/** POST /v1/sites/:id/report/briefing — generate MiniMax spoken briefing */
sitesRouter.post('/:id/report/briefing', async (c) => {
  const id = c.req.param('id')

  if (!MiniMaxClient.isAvailable()) {
    return c.json(
      {
        error: 'MiniMax not configured',
        detail: 'Set MINIMAX_API_KEY and MINIMAX_GROUP_ID in .env',
      },
      503,
    )
  }

  const decision = await getFatalFlawDecision(id)
  if (!decision) return c.json({ error: 'Site not scored yet' }, 404)

  const client = new MiniMaxClient()
  try {
    const result = await client.generateBriefing(decision, decision.summary)
    return c.json({ data: result })
  } catch (err) {
    return c.json({ error: 'MiniMax briefing failed', detail: String(err) }, 500)
  }
})

/** GET /v1/sites/:id/evidence */
sitesRouter.get('/:id/evidence', async (c) => {
  const id = c.req.param('id')
  const evidence = await getEvidenceForSite(id)
  return c.json({ data: evidence })
})
