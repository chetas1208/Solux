import type { Decision } from '@solux/shared'
import type { ConfidenceLevel, DecisionToken } from '~/types/ui'

export function decisionClass(decision: Decision | DecisionToken | string | undefined): string {
  if (decision === 'GO') return 'decision-go'
  if (decision === 'INVESTIGATE') return 'decision-investigate'
  if (decision === 'KILL') return 'decision-kill'
  return 'bg-zinc-800 border border-zinc-700 text-zinc-500'
}

export function decisionLabel(decision: Decision | DecisionToken): string {
  const labels: Record<Decision, string> = {
    GO: 'Worth pursuing. No critical fatal flaws detected from configured data sources.',
    INVESTIGATE: 'Promising, but confidence is limited by missing or uncertain evidence.',
    KILL: 'Do not pursue before resolving fatal flaws.',
  }
  return labels[decision]
}

export function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= 70) return 'HIGH_CONFIDENCE'
  if (score >= 45) return 'MEDIUM_CONFIDENCE'
  return 'LOW_CONFIDENCE'
}

export function confidenceClass(level: ConfidenceLevel): string {
  const map: Record<ConfidenceLevel, string> = {
    HIGH_CONFIDENCE: 'confidence-high',
    MEDIUM_CONFIDENCE: 'confidence-medium',
    LOW_CONFIDENCE: 'confidence-low',
  }
  return map[level]
}

export function developmentRisk(scoreBreakdown: {
  buildabilityScore: number
  atmosphereRiskScore: number
  powerLossScore: number
  topFatalFlaws: string[]
}): number {
  const flawPenalty = Math.min(scoreBreakdown.topFatalFlaws.length * 8, 30)
  const risk =
    100 -
    (scoreBreakdown.buildabilityScore * 0.35 +
      scoreBreakdown.atmosphereRiskScore * 0.25 +
      scoreBreakdown.powerLossScore * 0.25)
  return Math.min(100, Math.max(0, Math.round(risk + flawPenalty)))
}

export function siteTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    land: 'Land',
    reservoir: 'Reservoir',
    canal: 'Canal',
    lake: 'Lake',
    coastal_shallow: 'Shallow coastal',
  }
  return labels[type] ?? type
}
