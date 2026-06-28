import { describe, it, expect } from 'vitest'
import { scoreSolarOutput } from '../solarOutputScore.js'
import { scoreGridConnectivity } from '../gridConnectivityScore.js'
import { computeFinalDecision } from '../finalDecision.js'
import type { CandidateSite, EvidenceItem } from '@solux/shared'

const noEvidence: EvidenceItem[] = []

describe('scoreSolarOutput', () => {
  it('returns low score for GHI < 3.5', () => {
    const result = scoreSolarOutput(3.0, noEvidence)
    expect(result.powerOutputScore).toBeLessThan(30)
  })

  it('returns moderate score for GHI 4.5–5.5', () => {
    const result = scoreSolarOutput(5.0, noEvidence)
    expect(result.powerOutputScore).toBeGreaterThanOrEqual(50)
    expect(result.powerOutputScore).toBeLessThanOrEqual(70)
  })

  it('returns high score for GHI > 6.0', () => {
    const result = scoreSolarOutput(6.2, noEvidence)
    expect(result.powerOutputScore).toBeGreaterThan(75)
  })

  it('never exceeds 100', () => {
    const result = scoreSolarOutput(10.0, noEvidence)
    expect(result.powerOutputScore).toBeLessThanOrEqual(100)
  })

  it('includes assumptions', () => {
    const result = scoreSolarOutput(5.0, noEvidence)
    expect(result.assumptions.length).toBeGreaterThan(0)
  })
})

describe('scoreGridConnectivity', () => {
  it('returns KILL trigger when distance exceeds threshold', () => {
    const result = scoreGridConnectivity(
      {
        nearestLineDistanceKm: 40,
        nearestLineVoltageKV: 110,
        nearestSubstationDistanceKm: null,
        roadAccessDistanceKm: 2,
        source: 'openstreetmap',
        evidenceItems: [],
      },
      25,
      33,
      noEvidence,
    )
    expect(result.killTrigger).not.toBeNull()
    expect(result.gridConnectivityScore).toBeLessThan(30)
  })

  it('returns high score for very close line', () => {
    const result = scoreGridConnectivity(
      {
        nearestLineDistanceKm: 1,
        nearestLineVoltageKV: 132,
        nearestSubstationDistanceKm: 5,
        roadAccessDistanceKm: 0.5,
        source: 'openstreetmap',
        evidenceItems: [],
      },
      25,
      33,
      noEvidence,
    )
    expect(result.killTrigger).toBeNull()
    expect(result.gridConnectivityScore).toBeGreaterThan(90)
  })

  it('kills when voltage below minimum', () => {
    const result = scoreGridConnectivity(
      {
        nearestLineDistanceKm: 5,
        nearestLineVoltageKV: 11,
        nearestSubstationDistanceKm: null,
        roadAccessDistanceKm: 1,
        source: 'openstreetmap',
        evidenceItems: [],
      },
      25,
      33,
      noEvidence,
    )
    expect(result.killTrigger).not.toBeNull()
  })
})

describe('computeFinalDecision', () => {
  const mockSite: CandidateSite = {
    id: 'test-site-id',
    projectId: 'test-project-id',
    specId: 'test-spec-id',
    name: 'Test Site',
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    },
    centroid: { type: 'Point', coordinates: [0.5, 0.5] },
    siteType: 'land',
    country: 'India',
    areaKm2: 100,
    generationMethod: 'grid_cell',
    createdAt: new Date().toISOString(),
  }

  it('returns GO for high scores with no kill triggers', () => {
    const { fatalFlawDecision } = computeFinalDecision(
      {
        siteId: 'test-site-id',
        projectId: 'test-project-id',
        powerOutputScore: 85,
        vegetationTradeoffScore: 80,
        gridConnectivityScore: 90,
        buildabilityScore: 75,
        storageFeasibilityScore: 70,
        powerLossScore: 80,
        atmosphereRiskScore: 75,
        killTriggers: [],
        missingDataWarnings: [],
        evidenceIds: [],
        dataConfidenceAvg: 0.88,
      },
      mockSite,
    )
    expect(fatalFlawDecision.decision).toBe('GO')
  })

  it('returns KILL when kill triggers present', () => {
    const { fatalFlawDecision } = computeFinalDecision(
      {
        siteId: 'test-site-id',
        projectId: 'test-project-id',
        powerOutputScore: 85,
        vegetationTradeoffScore: 80,
        gridConnectivityScore: 10,
        buildabilityScore: 75,
        storageFeasibilityScore: 70,
        powerLossScore: 80,
        atmosphereRiskScore: 75,
        killTriggers: [{ dimension: 'grid', description: 'No grid within 25 km' }],
        missingDataWarnings: [],
        evidenceIds: [],
        dataConfidenceAvg: 0.88,
      },
      mockSite,
    )
    expect(fatalFlawDecision.decision).toBe('KILL')
  })

  it('returns INVESTIGATE for low confidence', () => {
    const { fatalFlawDecision } = computeFinalDecision(
      {
        siteId: 'test-site-id',
        projectId: 'test-project-id',
        powerOutputScore: 75,
        vegetationTradeoffScore: 70,
        gridConnectivityScore: 65,
        buildabilityScore: 70,
        storageFeasibilityScore: 65,
        powerLossScore: 70,
        atmosphereRiskScore: 70,
        killTriggers: [],
        missingDataWarnings: ['Land cover data missing', 'Weather data missing'],
        evidenceIds: [],
        dataConfidenceAvg: 0.4,
      },
      mockSite,
    )
    expect(fatalFlawDecision.decision).toBe('INVESTIGATE')
  })
})
