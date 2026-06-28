import { Hono } from 'hono'
import { getSite, getScoreBreakdown, getFatalFlawDecision } from '../db/repositories/sites.js'
import { getEvidenceForSite } from '../db/repositories/evidence.js'
import { saveAgentTrace } from '../db/repositories/agentTraceRepo.js'
import { saveReport, getReport } from '../db/repositories/reportsRepo.js'
import { generateGroundedReport } from '../agent/generateGroundedReport.js'
import { verifyReportClaims } from '../agent/verifyReportClaims.js'
import { isLlmAvailable, llmUnavailableReason } from '../agent/llmClient.js'
import { MiniMaxClient } from '../minimax/minimaxClient.js'
import { generateVoiceBriefing } from '../minimax/generateVoiceBriefing.js'

export const sitesRouter = new Hono()

sitesRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const site = await getSite(id)
  if (!site) return c.json({ error: 'Site not found' }, 404)
  const score = await getScoreBreakdown(id)
  return c.json({ data: { site, scoreBreakdown: score } })
})

sitesRouter.get('/:id/evidence', async (c) => {
  const id = c.req.param('id')
  const evidence = await getEvidenceForSite(id)
  return c.json({ data: evidence })
})

sitesRouter.get('/:id/report', async (c) => {
  const id = c.req.param('id')
  const site = await getSite(id)
  if (!site) return c.json({ error: 'Site not found' }, 404)

  const score = await getScoreBreakdown(id)
  if (!score) return c.json({ error: 'Site not scored yet' }, 404)

  const decision = await getFatalFlawDecision(id)
  if (!decision) return c.json({ error: 'Site not scored yet' }, 404)

  // Return cached report if exists
  const existingReport = await getReport(id)
  if (existingReport) {
    return c.json({ data: { report: existingReport, cached: true } })
  }

  if (!isLlmAvailable()) {
    return c.json(
      { error: 'LLM not configured', detail: llmUnavailableReason() },
      503,
    )
  }

  const evidence = await getEvidenceForSite(id)

  try {
    const { report, trace } = await generateGroundedReport(
      {
        id: site.id,
        name: site.name,
        siteType: site.siteType,
        country: site.country,
        areaKm2: site.areaKm2,
        centroid: site.centroid.coordinates as [number, number],
      },
      { ...score, usedMojoKernel: false },
      decision.killTriggers ?? [],
      evidence,
      site.projectId,
    )

    // Second-pass verification with report model
    const verified = await verifyReportClaims(report, evidence)
    const finalReport = {
      ...report,
      claimVerification: verified,
      hallucinationScore: verified.hallucinationScore,
    }

    await saveReport(finalReport)
    await saveAgentTrace(trace)

    return c.json({ data: { report: finalReport, cached: false } })
  } catch (err) {
    return c.json({ error: 'Report generation failed', detail: String(err) }, 500)
  }
})

sitesRouter.post('/:id/report/briefing', async (c) => {
  const id = c.req.param('id')

  const report = await getReport(id)
  if (!report) {
    return c.json(
      { error: 'Report not found', detail: 'Call GET /v1/sites/:id/report first' },
      404,
    )
  }

  const result = await generateVoiceBriefing(report)

  if (!MiniMaxClient.isAvailable()) {
    return c.json(
      {
        error: 'MiniMax not configured',
        detail: result.skippedReason,
        miniMaxAvailable: false,
      },
      503,
    )
  }

  if (result.skippedReason) {
    return c.json({ error: 'Briefing generation failed', detail: result.skippedReason }, 500)
  }

  return c.json({
    data: {
      audioUrl: result.audioUrl,
      durationSec: result.durationSec,
      miniMaxAvailable: true,
    },
  })
})
