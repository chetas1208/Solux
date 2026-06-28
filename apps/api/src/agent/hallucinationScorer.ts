import type { EvidenceItem, ReportClaim, ClaimVerificationResult } from './schemas.js'

const NUMERIC_PATTERN = /(\d+(?:\.\d+)?)\s*(kWh\/m²\/day|kWh\/m2\/day|kWh\/kWp\/year|km|kV|MW|MWh|m\/s|m\b|meters|%|°C|GW|ha|km²)/gi

/** Extract checkable numeric claims from a block of text. */
export function extractNumericClaims(text: string): string[] {
  const claims: string[] = []
  const re = new RegExp(NUMERIC_PATTERN.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    claims.push(`${m[1]} ${m[2]}`)
  }
  return [...new Set(claims)]
}

/** Check if a single numeric claim is traceable to at least one evidence item. */
export function isNumericClaimSupported(claim: string, evidence: EvidenceItem[]): boolean {
  const claimNum = parseFloat(claim)
  const unit = claim.replace(/[\d.]+\s*/, '').trim().toLowerCase()

  for (const ev of evidence) {
    const valStr = JSON.stringify(ev.value ?? {}).toLowerCase()
    const descStr = ev.description.toLowerCase()
    const unitStr = (ev.unit ?? '').toLowerCase()

    // Unit match helps narrow — skip if units are clearly incompatible
    const unitCompatible =
      !unit ||
      unitStr.includes(unit) ||
      descStr.includes(unit) ||
      valStr.includes(unit)

    if (!unitCompatible) continue

    // Exact substring match
    if (valStr.includes(String(claimNum)) || descStr.includes(claim.toLowerCase())) {
      return true
    }

    // Numeric tolerance: within 20% or ±0.5 for small values
    const nums = extractNumbers(valStr)
    for (const n of nums) {
      const absDiff = Math.abs(claimNum - n)
      const relDiff = Math.abs(claimNum) > 1 ? absDiff / Math.abs(claimNum) : absDiff
      if (relDiff < 0.20 || absDiff < 0.5) return true
    }
  }
  return false
}

function extractNumbers(str: string): number[] {
  return (str.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
}

/** Score an entire text block against retrieved evidence. */
export function scoreHallucination(
  text: string,
  evidence: EvidenceItem[],
): ClaimVerificationResult {
  const rawClaims = extractNumericClaims(text)

  if (rawClaims.length === 0) {
    return {
      claims: [],
      totalClaims: 0,
      supportedClaims: 0,
      unsupportedClaims: 0,
      hallucinationScore: 0,
      passed: true,
    }
  }

  const claims: ReportClaim[] = rawClaims.map((c) => {
    const supported = isNumericClaimSupported(c, evidence)
    return {
      text: c,
      claimType: 'numeric',
      supported,
      confidence: supported ? 0.85 : 0.1,
    }
  })

  const supported = claims.filter((c) => c.supported).length
  const unsupported = claims.length - supported
  const hallucinationScore = claims.length > 0 ? unsupported / claims.length : 0

  return {
    claims,
    totalClaims: claims.length,
    supportedClaims: supported,
    unsupportedClaims: unsupported,
    hallucinationScore,
    passed: hallucinationScore < 0.30,
  }
}
