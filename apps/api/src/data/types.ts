import type { Point, DataSourceStatus, EvidenceItem } from '@solux/shared'

export interface SolarResourceResult {
  ghiKwhM2Day: number
  dniKwhM2Day: number
  temperatureC: number
  source: DataSourceStatus['id']
  evidenceItems: EvidenceItem[]
}

export interface LandCoverResult {
  landCoverClass: string
  vegetationDensity: 'none' | 'sparse' | 'moderate' | 'dense' | 'protected'
  slopeAngleDeg: number
  isProtectedArea: boolean
  protectedAreaName: string | null
  source: DataSourceStatus['id']
  evidenceItems: EvidenceItem[]
}

export interface GridProximityResult {
  nearestLineVoltageKV: number | null
  nearestLineDistanceKm: number
  nearestSubstationDistanceKm: number | null
  roadAccessDistanceKm: number
  source: DataSourceStatus['id']
  evidenceItems: EvidenceItem[]
}

export interface WeatherRiskResult {
  aerosolOpticalDepth: number | null
  annualDustDaysEstimate: number | null
  cycloneRiskZone: boolean
  floodRiskZone: boolean
  avgWindSpeedMs: number | null
  source: DataSourceStatus['id']
  evidenceItems: EvidenceItem[]
}

export interface WaterConditionsResult {
  depthM: number | null
  waveHeightHsM: number | null
  currentSpeedMs: number | null
  tidalRangeM: number | null
  isCalm: boolean
  source: DataSourceStatus['id']
  evidenceItems: EvidenceItem[]
}

/** Interface every data provider must implement. */
export interface SolarResourceProvider {
  isAvailable(): boolean
  unavailableReason(): string | undefined
  fetch(centroid: Point, projectId: string, siteId: string): Promise<SolarResourceResult>
}

export interface LandCoverProvider {
  isAvailable(): boolean
  unavailableReason(): string | undefined
  fetch(centroid: Point, projectId: string, siteId: string): Promise<LandCoverResult>
}

export interface GridProvider {
  isAvailable(): boolean
  unavailableReason(): string | undefined
  fetch(centroid: Point, projectId: string, siteId: string): Promise<GridProximityResult>
}

export interface WeatherProvider {
  isAvailable(): boolean
  unavailableReason(): string | undefined
  fetch(centroid: Point, projectId: string, siteId: string): Promise<WeatherRiskResult>
}

export interface WaterConditionsProvider {
  isAvailable(): boolean
  unavailableReason(): string | undefined
  fetch(centroid: Point, projectId: string, siteId: string): Promise<WaterConditionsResult>
}
