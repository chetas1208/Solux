import { aiConfig } from '@solux/config'
import type { FatalFlawDecision } from '@solux/shared'

export interface MiniMaxBriefingResult {
  audioUrl: string | null
  transcript: string
  durationEstimateSec: number
}

/**
 * MiniMax text-to-speech client for 60-second executive briefings.
 * Optional — app works without it.
 * Docs: https://www.minimax.io/platform/document/t2a%20v2
 */
export class MiniMaxClient {
  private readonly baseUrl = 'https://api.minimax.io/v1'

  static isAvailable(): boolean {
    return !!(aiConfig.minimaxApiKey && aiConfig.minimaxGroupId)
  }

  async generateBriefing(
    decision: FatalFlawDecision,
    executiveSummary: string,
  ): Promise<MiniMaxBriefingResult> {
    if (!MiniMaxClient.isAvailable()) {
      throw new Error('MiniMax not configured — set MINIMAX_API_KEY and MINIMAX_GROUP_ID')
    }

    const decisionLabel =
      decision.decision === 'GO'
        ? 'a GO decision'
        : decision.decision === 'INVESTIGATE'
          ? 'an INVESTIGATE decision — needs more data before commitment'
          : 'a KILL decision — site eliminated'

    const briefingText = `
Site screening result for ${decision.siteId}.
Solux has returned ${decisionLabel}.
Score: ${decision.scoreBreakdown.finalScore} out of 100.
Confidence: ${decision.scoreBreakdown.confidence} percent.
${executiveSummary}
${decision.killTriggers.length > 0 ? `Fatal flaws identified: ${decision.killTriggers.map((t) => t.description).join('. ')}.` : ''}
${decision.scoreBreakdown.missingDataWarnings.length > 0 ? `Missing data: ${decision.scoreBreakdown.missingDataWarnings.join('. ')}.` : ''}
Recommended immediate action: ${decision.decision === 'GO' ? 'Proceed to detailed feasibility study and PPA negotiation.' : decision.decision === 'INVESTIGATE' ? 'Collect missing data layers before making a commitment decision.' : 'Remove this site from the shortlist and redirect resources to higher-scoring candidates.'}`
      .trim()
      .replace(/\n+/g, ' ')

    const res = await fetch(`${this.baseUrl}/t2a_v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aiConfig.minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'speech-02-hd',
        text: briefingText,
        stream: false,
        voice_setting: {
          voice_id: 'male-qn-qingse',
          speed: 1.0,
          vol: 1.0,
          pitch: 0,
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: 'mp3',
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`MiniMax TTS error ${res.status}: ${body.slice(0, 200)}`)
    }

    const json = (await res.json()) as Record<string, unknown>
    const data = json['data'] as Record<string, unknown> | undefined
    const audioUrl = (data?.['audio_file'] as string | undefined) ?? null

    return {
      audioUrl,
      transcript: briefingText,
      durationEstimateSec: Math.round(briefingText.split(' ').length / 2.5),
    }
  }
}
