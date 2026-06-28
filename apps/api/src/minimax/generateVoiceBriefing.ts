import { MiniMaxClient } from './minimaxClient.js'
import type { FatalFlawReport } from '../agent/schemas.js'

const MAX_WORDS = 150 // ~60 seconds at 2.5 wps

/**
 * Generates a spoken executive briefing from the screening report.
 * Returns null with reason if MiniMax not configured.
 * Speech is capped at ~60 seconds (MAX_WORDS words).
 */
export async function generateVoiceBriefing(report: FatalFlawReport): Promise<{
  audioUrl: string | null
  durationSec: number
  skippedReason: string | null
}> {
  if (!MiniMaxClient.isAvailable()) {
    return {
      audioUrl: null,
      durationSec: 0,
      skippedReason: MiniMaxClient.unavailableReason() ?? 'MiniMax not configured',
    }
  }

  const script = buildScript(report)

  try {
    const client = new MiniMaxClient()
    const { audioUrl, durationSec } = await client.textToSpeech(script)
    return { audioUrl, durationSec, skippedReason: null }
  } catch (err) {
    return { audioUrl: null, durationSec: 0, skippedReason: String(err) }
  }
}

function buildScript(report: FatalFlawReport): string {
  const decision = report.decision === 'GO'
    ? 'passes all fatal-flaw checks and is approved for development'
    : report.decision === 'INVESTIGATE'
      ? 'requires further investigation before a go decision'
      : 'is rejected due to a fatal constraint'

  const topFinding = report.keyFindings[0] ?? 'No specific findings recorded.'
  const topStep = report.recommendedNextSteps[0] ?? 'No next steps specified.'

  const lines = [
    `Solux site screening report for ${report.siteId}.`,
    `Decision: ${decision}.`,
    `Score: ${report.scoreBreakdown.finalScore} out of 100, confidence ${report.scoreBreakdown.confidence} percent.`,
    topFinding,
    `Recommended next step: ${topStep}`,
  ]

  return truncateToWords(lines.join(' '), MAX_WORDS)
}

function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(' ')
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ') + '.'
}
