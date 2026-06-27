import type { EvidenceItem } from '@solux/shared'

export interface GuardResult {
  passed: boolean
  unsupportedClaimFraction: number
  unsupportedClaims: string[]
  supportedClaims: string[]
  totalClaims: number
}

/**
 * Checks report claims against retrieved evidence.
 * Rejects numeric claims that cannot be traced to an evidence item.
 *
 * Heuristic: extract numeric values and named locations from text,
 * check each against evidence values and descriptions.
 */
export function checkReportClaims(
  reportText: string,
  evidence: EvidenceItem[],
): GuardResult {
  const claims = extractClaims(reportText)
  const supported: string[] = []
  const unsupported: string[] = []

  for (const claim of claims) {
    if (isClaimSupported(claim, evidence)) {
      supported.push(claim)
    } else {
      unsupported.push(claim)
    }
  }

  const total = claims.length
  const unsupportedFraction = total === 0 ? 0 : unsupported.length / total

  return {
    passed: unsupportedFraction < 0.3, // fail if > 30% claims unsupported
    unsupportedClaimFraction: unsupportedFraction,
    unsupportedClaims: unsupported,
    supportedClaims: supported,
    totalClaims: total,
  }
}

/** Extracts checkable claim fragments from report text. */
function extractClaims(text: string): string[] {
  const claims: string[] = []

  // Numeric claims with units (e.g. "5.2 kWh/m²/day", "12 km", "33 kV")
  const numericPattern =
    /(\d+(?:\.\d+)?)\s*(kWh\/m²\/day|kWh\/m2\/day|km|kV|MW|MWh|m\/s|meters|m\b|%)/gi
  let match: RegExpExecArray | null
  while ((match = numericPattern.exec(text)) !== null) {
    claims.push(`${match[1]} ${match[2]}`)
  }

  return claims
}

/** Checks if a claim fragment appears in the evidence. */
function isClaimSupported(claim: string, evidence: EvidenceItem[]): boolean {
  const claimLower = claim.toLowerCase()

  for (const ev of evidence) {
    const valueStr = JSON.stringify(ev.value).toLowerCase()
    const descStr = ev.description.toLowerCase()
    const metaStr = JSON.stringify(ev.metadata ?? {}).toLowerCase()

    if (valueStr.includes(claimLower) || descStr.includes(claimLower) || metaStr.includes(claimLower)) {
      return true
    }

    // Numeric tolerance check: extract number from claim and compare with evidence values
    const claimNum = parseFloat(claim)
    if (!isNaN(claimNum)) {
      const evidenceNums = extractNumbers(valueStr)
      for (const evNum of evidenceNums) {
        if (Math.abs(claimNum - evNum) / Math.max(Math.abs(claimNum), 1) < 0.15) {
          return true
        }
      }
    }
  }

  return false
}

function extractNumbers(str: string): number[] {
  const matches = str.match(/\d+(?:\.\d+)?/g) ?? []
  return matches.map(Number)
}
