import type { EvidenceItem } from '@solux/shared'
import type { WeatherRiskResult } from '../data/types.js'

export interface AtmosphereRiskResult {
  atmosphereRiskScore: number
  powerLossScore: number
  assumptions: string[]
  evidenceIds: string[]
}

/**
 * Scores atmosphere and weather risk.
 * Higher score = lower risk (same convention as all dimensions).
 *
 * TODO: Integrate NASA POWER for aerosol optical depth.
 */
export function scoreAtmosphereRisk(
  data: WeatherRiskResult | null,
  evidence: EvidenceItem[],
  missingDataWarnings: string[],
): AtmosphereRiskResult {
  const assumptions: string[] = [
    'Atmosphere risk uses aerosol optical depth (AOD) as proxy for dust/soiling loss',
    'Cyclone and flood risk from OSM/public databases — verify with local hazard maps',
    'O&M soiling cleaning costs not modelled',
    'Annual variability in irradiance not captured without multi-year data',
  ]

  if (!data) {
    missingDataWarnings.push(
      'Weather and aerosol data unavailable — atmosphere risk score is indicative only. Configure NASA POWER or ERA5.',
    )
    return {
      atmosphereRiskScore: 60,
      powerLossScore: 60,
      assumptions: [...assumptions, 'No weather data available'],
      evidenceIds: evidence.map((e) => e.id),
    }
  }

  let atmosphereScore = 80
  let powerLossScore = 80

  // AOD penalty (higher AOD = more soiling/dust loss)
  if (data.aerosolOpticalDepth !== null) {
    if (data.aerosolOpticalDepth > 0.5) {
      atmosphereScore -= 30
      powerLossScore -= 25
    } else if (data.aerosolOpticalDepth > 0.3) {
      atmosphereScore -= 15
      powerLossScore -= 10
    } else if (data.aerosolOpticalDepth > 0.2) {
      atmosphereScore -= 5
      powerLossScore -= 3
    }
  }

  // High dust-day regions
  if (data.annualDustDaysEstimate !== null) {
    if (data.annualDustDaysEstimate > 60) {
      atmosphereScore -= 20
      powerLossScore -= 15
    } else if (data.annualDustDaysEstimate > 30) {
      atmosphereScore -= 10
      powerLossScore -= 7
    }
  }

  // Cyclone risk zone — INVESTIGATE flag
  if (data.cycloneRiskZone) {
    atmosphereScore -= 20
    assumptions.push('Site in cyclone risk zone — structural loadings must meet IEC 61215 wind class standards')
  }

  // Flood risk
  if (data.floodRiskZone) {
    atmosphereScore -= 15
  }

  return {
    atmosphereRiskScore: Math.max(0, Math.min(100, Math.round(atmosphereScore))),
    powerLossScore: Math.max(0, Math.min(100, Math.round(powerLossScore))),
    assumptions,
    evidenceIds: evidence.map((e) => e.id),
  }
}
