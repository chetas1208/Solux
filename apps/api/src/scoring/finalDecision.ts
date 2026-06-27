import { v4 as uuid } from 'uuid'
import type { ScoreBreakdown, FatalFlawDecision, CandidateSite } from '@solux/shared'

const WEIGHTS = {
  powerOutputScore: 0.25,
  gridConnectivityScore: 0.20,
  buildabilityScore: 0.15,
  vegetationTradeoffScore: 0.15,
  storageFeasibilityScore: 0.10,
  atmosphereRiskScore: 0.05,
  powerLossScore: 0.05,
  waterFeasibilityScore: 0.05,
}

export interface ScoringInput {
  siteId: string
  projectId: string
  powerOutputScore: number
  vegetationTradeoffScore: number
  gridConnectivityScore: number
  buildabilityScore: number
  storageFeasibilityScore: number
  powerLossScore: number
  atmosphereRiskScore: number
  waterFeasibilityScore?: number
  killTriggers: Array<{ dimension: string; description: string; evidenceId?: string }>
  missingDataWarnings: string[]
  evidenceIds: string[]
  dataConfidenceAvg: number
}

export function computeFinalDecision(
  input: ScoringInput,
  site: CandidateSite,
): { scoreBreakdown: ScoreBreakdown; fatalFlawDecision: FatalFlawDecision } {
  const isWaterSite = ['reservoir', 'canal', 'lake', 'coastal_shallow'].includes(site.siteType)

  const effectiveWaterScore = isWaterSite ? (input.waterFeasibilityScore ?? 40) : undefined

  // Compute weighted final score
  let weightedSum = 0
  let weightTotal = 0

  const dimensionScores: Record<string, number> = {
    powerOutputScore: input.powerOutputScore,
    gridConnectivityScore: input.gridConnectivityScore,
    buildabilityScore: input.buildabilityScore,
    vegetationTradeoffScore: input.vegetationTradeoffScore,
    storageFeasibilityScore: input.storageFeasibilityScore,
    atmosphereRiskScore: input.atmosphereRiskScore,
    powerLossScore: input.powerLossScore,
  }

  if (isWaterSite && effectiveWaterScore !== undefined) {
    dimensionScores['waterFeasibilityScore'] = effectiveWaterScore
  }

  for (const [key, weight] of Object.entries(WEIGHTS)) {
    if (key === 'waterFeasibilityScore' && !isWaterSite) continue
    const score = dimensionScores[key]
    if (score !== undefined) {
      weightedSum += score * weight
      weightTotal += weight
    }
  }

  const rawFinalScore = weightTotal > 0 ? weightedSum / weightTotal : 50

  // Confidence: penalise for missing data layers
  const missingPenalty = input.missingDataWarnings.length * 8
  const confidence = Math.max(
    20,
    Math.round(input.dataConfidenceAvg * 100 - missingPenalty),
  )

  // Decision
  let decision: 'GO' | 'INVESTIGATE' | 'KILL'

  if (input.killTriggers.length > 0) {
    decision = 'KILL'
  } else if (rawFinalScore >= 70 && confidence >= 65) {
    decision = 'GO'
  } else if (rawFinalScore >= 45 || confidence < 65) {
    decision = 'INVESTIGATE'
  } else {
    decision = 'KILL'
  }

  // Top factors
  const topPositiveFactors: string[] = []
  const topFatalFlaws: string[] = input.killTriggers.map((t) => t.description)

  if (input.powerOutputScore >= 70) topPositiveFactors.push(`Strong solar resource: ${input.powerOutputScore}/100`)
  if (input.gridConnectivityScore >= 70) topPositiveFactors.push(`Good grid access: ${input.gridConnectivityScore}/100`)
  if (input.buildabilityScore >= 70) topPositiveFactors.push(`Suitable terrain: ${input.buildabilityScore}/100`)
  if (isWaterSite && (effectiveWaterScore ?? 0) >= 70) topPositiveFactors.push(`Viable water site: ${effectiveWaterScore}/100`)

  if (input.powerOutputScore < 45) topFatalFlaws.push(`Low solar resource: ${input.powerOutputScore}/100`)
  if (input.gridConnectivityScore < 40) topFatalFlaws.push(`Poor grid connectivity: ${input.gridConnectivityScore}/100`)

  const now = new Date().toISOString()

  const scoreBreakdown: ScoreBreakdown = {
    siteId: input.siteId,
    projectId: input.projectId,
    finalScore: Math.round(rawFinalScore),
    finalDecision: decision,
    confidence,
    powerOutputScore: input.powerOutputScore,
    vegetationTradeoffScore: input.vegetationTradeoffScore,
    gridConnectivityScore: input.gridConnectivityScore,
    buildabilityScore: input.buildabilityScore,
    storageFeasibilityScore: input.storageFeasibilityScore,
    powerLossScore: input.powerLossScore,
    atmosphereRiskScore: input.atmosphereRiskScore,
    waterFeasibilityScore: effectiveWaterScore,
    topPositiveFactors: topPositiveFactors.slice(0, 5),
    topFatalFlaws: topFatalFlaws.slice(0, 5),
    missingDataWarnings: input.missingDataWarnings,
    evidenceIds: input.evidenceIds,
    scoredAt: now,
  }

  const headline =
    decision === 'GO'
      ? `${site.name} passes all fatal-flaw checks — proceed to detailed feasibility`
      : decision === 'INVESTIGATE'
        ? `${site.name} shows promise but requires investigation before commitment`
        : `${site.name} — KILL: ${topFatalFlaws[0] ?? 'Score below minimum threshold'}`

  const fatalFlawDecision: FatalFlawDecision = {
    id: uuid(),
    siteId: input.siteId,
    projectId: input.projectId,
    decision,
    headline,
    summary: buildSummary(scoreBreakdown, input.killTriggers),
    killTriggers: input.killTriggers,
    scoreBreakdown,
    generatedAt: now,
    unsupportedClaimFraction: 0, // set by evidence guard after report generation
  }

  return { scoreBreakdown, fatalFlawDecision }
}

function buildSummary(
  s: ScoreBreakdown,
  killTriggers: Array<{ dimension: string; description: string }>,
): string {
  if (killTriggers.length > 0) {
    return `Site eliminated due to ${killTriggers.length} fatal flaw(s): ${killTriggers.map((t) => t.description).join('; ')}.`
  }
  if (s.finalDecision === 'GO') {
    return `Site scores ${s.finalScore}/100 with ${s.confidence}% confidence. Solar resource, grid access, and buildability all pass thresholds. Recommend proceeding to PPA negotiation and detailed engineering.`
  }
  return `Site scores ${s.finalScore}/100 but confidence is ${s.confidence}%. Missing data: ${s.missingDataWarnings.join(', ') || 'none'}. Recommend targeted data collection before commitment.`
}

/** Rank sites by finalScore descending, with GO > INVESTIGATE > KILL ordering. */
export function rankSites(
  decisions: FatalFlawDecision[],
): FatalFlawDecision[] {
  const order = { GO: 0, INVESTIGATE: 1, KILL: 2 }
  return [...decisions].sort((a, b) => {
    const decisionDiff = order[a.decision] - order[b.decision]
    if (decisionDiff !== 0) return decisionDiff
    return b.scoreBreakdown.finalScore - a.scoreBreakdown.finalScore
  })
}
