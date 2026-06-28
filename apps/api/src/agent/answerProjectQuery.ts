import { generateText, isLlmAvailable, parseJsonFromLlm } from './llmClient.js'
import type { ProjectSpec, CandidateSite, ScoreBreakdown } from '@solux/shared'

export interface QueryAnswer {
  answer: string
  highlightSiteIds: string[]
}

interface SiteContext {
  id: string
  name: string
  decision?: string
  finalScore?: number
  confidence?: number
  country?: string
}

export async function answerProjectQuery(opts: {
  userQuery: string
  spec: ProjectSpec
  sites: CandidateSite[]
  scores: ScoreBreakdown[]
}): Promise<QueryAnswer> {
  const scoreMap = new Map(opts.scores.map((s) => [s.siteId, s]))
  const ranked: SiteContext[] = opts.sites
    .map((site) => {
      const score = scoreMap.get(site.id)
      return {
        id: site.id,
        name: site.name,
        decision: score?.decision,
        finalScore: score?.finalScore,
        confidence: score?.confidence,
        country: site.country,
      }
    })
    .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0))
    .slice(0, 15)

  if (!isLlmAvailable()) {
    return deterministicAnswer(opts.userQuery, ranked)
  }

  const prompt = `You are Solux, a solar site screening analyst. Answer the user's question using ONLY the project spec and ranked site list below. Do not invent sites or scores.

Project: ${opts.spec.name}
Region: ${opts.spec.targetRegion ?? 'unspecified'}
Country: ${opts.spec.targetCountry}
Technology: ${opts.spec.technology}

Top sites (by score):
${ranked.map((s, i) => `${i + 1}. ${s.name} — ${s.decision ?? 'unscored'} score=${s.finalScore ?? '?'} conf=${s.confidence ?? '?'}`).join('\n')}

User question: ${opts.userQuery}

Return JSON only:
{
  "answer": "2-4 sentence direct answer grounded in the site list",
  "highlightSiteIds": ["site ids from the list most relevant to the question, max 5"]
}`

  try {
    const result = await generateText(prompt, { jsonMode: true, modelHint: 'fast' })
    const parsed = parseJsonFromLlm(result.text) as { answer?: string; highlightSiteIds?: string[] }
    const validIds = new Set(ranked.map((s) => s.id))
    const highlights = (parsed.highlightSiteIds ?? [])
      .filter((id) => validIds.has(id))
      .slice(0, 5)
    return {
      answer: parsed.answer?.trim() || deterministicAnswer(opts.userQuery, ranked).answer,
      highlightSiteIds: highlights.length ? highlights : ranked.slice(0, 3).map((s) => s.id),
    }
  } catch {
    return deterministicAnswer(opts.userQuery, ranked)
  }
}

function deterministicAnswer(query: string, ranked: SiteContext[]): QueryAnswer {
  if (!ranked.length) {
    return {
      answer:
        'No screened sites yet. Parse your requirement and run screening to populate the 3D Earth with candidate cells.',
      highlightSiteIds: [],
    }
  }

  const top = ranked.slice(0, 3)
  const go = ranked.filter((s) => s.decision === 'GO')
  const investigate = ranked.filter((s) => s.decision === 'INVESTIGATE')

  let answer = `Based on ${ranked.length} ranked cells, top site is ${top[0]!.name} (score ${top[0]!.finalScore ?? '—'}, ${top[0]!.decision ?? 'pending'}).`
  if (go.length) answer += ` ${go.length} GO site(s) in this run.`
  else if (investigate.length) answer += ` ${investigate.length} INVESTIGATE — none cleared GO threshold yet.`
  if (/where|region|area|location/i.test(query)) {
    answer += ` Highlighting top-ranked cells on the globe.`
  }

  return { answer, highlightSiteIds: top.map((s) => s.id) }
}
