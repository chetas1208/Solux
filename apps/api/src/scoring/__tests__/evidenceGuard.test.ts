import { describe, it, expect } from 'vitest'
import { checkReportClaims } from '../../agent/evidenceGuard.js'
import type { EvidenceItem } from '@solux/shared'

const baseEvidence: EvidenceItem[] = [
  {
    id: 'ev-1',
    siteId: 's1',
    projectId: 'p1',
    source: 'pvgis',
    retrievedAt: new Date().toISOString(),
    description: 'PVGIS annual GHI for site',
    value: { annualKwh: 1825, ghiKwhM2Day: 5.0 },
    unit: 'kWh/m²/year',
    dataConfidence: 0.88,
  },
  {
    id: 'ev-2',
    siteId: 's1',
    projectId: 'p1',
    source: 'openstreetmap',
    retrievedAt: new Date().toISOString(),
    description: 'Nearest transmission line 8 km at 110 kV',
    value: { distanceKm: 8, voltageKV: 110 },
    unit: 'km',
    dataConfidence: 0.72,
  },
]

describe('checkReportClaims', () => {
  it('passes report with claims grounded in evidence', () => {
    const text = 'GHI is 5.0 kWh/m²/day. Grid line 8 km at 110 kV.'
    const result = checkReportClaims(text, baseEvidence)
    expect(result.passed).toBe(true)
    expect(result.unsupportedClaimFraction).toBeLessThan(0.3)
  })

  it('fails report with completely unsupported numeric claims', () => {
    const text = 'The site has 9.8 MW peak demand. Tidal range 7.4 meters. 99.5 kV voltage.'
    const result = checkReportClaims(text, baseEvidence)
    // Most claims not in evidence
    expect(result.totalClaims).toBeGreaterThan(0)
  })

  it('handles empty evidence gracefully', () => {
    const text = 'Solar resource is excellent at 6.2 kWh/m²/day.'
    const result = checkReportClaims(text, [])
    expect(result.passed).toBe(false)
  })

  it('returns fraction 0 for no numeric claims', () => {
    const text = 'Site is in a good location with strong grid access.'
    const result = checkReportClaims(text, baseEvidence)
    expect(result.totalClaims).toBe(0)
    expect(result.unsupportedClaimFraction).toBe(0)
  })
})
