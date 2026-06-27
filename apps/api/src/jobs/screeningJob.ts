import { v4 as uuid } from 'uuid'
import type { ProjectSpec, CandidateSite, EvidenceItem } from '@solux/shared'
import {
  splitRegionIntoGridCells,
  calculateAreaKm2,
  calculateCentroid,
  createBoundingBoxRegion,
} from '@solux/geo-utils'
import { getSolarProvider, getGridProvider, getWaterConditionsProvider } from '../data/dataRegistry.js'
import { scoreSolarOutput } from '../scoring/solarOutputScore.js'
import { scoreGridConnectivity } from '../scoring/gridConnectivityScore.js'
import { scoreBuildability } from '../scoring/buildabilityScore.js'
import { scoreStorageFeasibility } from '../scoring/storageFeasibilityScore.js'
import { scoreWaterFeasibility } from '../scoring/waterFeasibilityScore.js'
import { scoreAtmosphereRisk } from '../scoring/atmosphereRiskScore.js'
import { computeFinalDecision, rankSites } from '../scoring/finalDecision.js'
import { insertSites, saveScoreBreakdown, saveFatalFlawDecision } from '../db/repositories/sites.js'
import { insertEvidenceItems, saveAgentTrace } from '../db/repositories/evidence.js'
import type { FatalFlawDecision } from '@solux/shared'

/** How many km² each grid cell covers. */
const CELL_SIZE_KM = 15

/** Maximum number of cells to score per run (cost/time control). */
const MAX_CELLS = 20

export interface ScreeningJobResult {
  sites: CandidateSite[]
  decisions: FatalFlawDecision[]
  evidenceCount: number
  errors: string[]
}

/**
 * Main screening job. Generates grid cells, fetches data, scores each site.
 * Runs synchronously — move to a queue (BullMQ etc.) for production.
 */
export async function runScreeningJob(spec: ProjectSpec): Promise<ScreeningJobResult> {
  const projectId = spec.briefId
  const errors: string[] = []

  // 1. Generate candidate site grid
  const bbox = spec.searchBBox

  if (!bbox) {
    throw new Error(
      'No search area bounding box could be derived from the project spec. ' +
        'The region description could not be geocoded. Please provide more specific geographic constraints.',
    )
  }

  const cells = splitRegionIntoGridCells(bbox, CELL_SIZE_KM).slice(0, MAX_CELLS)

  const candidateSites: CandidateSite[] = cells.map((cell, i) => ({
    id: uuid(),
    projectId,
    specId: spec.id,
    name: `Cell-${i + 1} [${cell.centroid.coordinates[1].toFixed(2)}°N, ${cell.centroid.coordinates[0].toFixed(2)}°E]`,
    geometry: cell.geometry,
    centroid: cell.centroid,
    siteType: (spec.preferredSiteTypes[0] ?? 'land') as CandidateSite['siteType'],
    country: spec.targetCountry,
    areaKm2: calculateAreaKm2(cell.geometry),
    generationMethod: 'grid_cell',
    createdAt: new Date().toISOString(),
  }))

  await insertSites(candidateSites)

  // 2. Score each site
  const allEvidence: EvidenceItem[] = []
  const decisions: FatalFlawDecision[] = []

  const solarProvider = getSolarProvider(spec.targetCountry)
  const gridProvider = getGridProvider()
  const waterProvider = getWaterConditionsProvider()

  for (const site of candidateSites) {
    const siteEvidence: EvidenceItem[] = []
    const missingDataWarnings: string[] = []
    const killTriggers: Array<{ dimension: string; description: string; evidenceId?: string }> = []

    // Solar data
    let ghiKwhM2Day = 4.5 // fallback if all providers fail
    let solarEvidence: EvidenceItem[] = []
    try {
      const solarResult = await solarProvider.fetch(site.centroid, projectId, site.id)
      ghiKwhM2Day = solarResult.ghiKwhM2Day
      solarEvidence = solarResult.evidenceItems
      siteEvidence.push(...solarEvidence)
    } catch (err) {
      const msg = `Solar data fetch failed for ${site.name}: ${String(err)}`
      errors.push(msg)
      missingDataWarnings.push('Solar irradiance data could not be retrieved — score based on fallback assumptions')
    }

    const solarScore = scoreSolarOutput(ghiKwhM2Day, solarEvidence)

    // GHI kill trigger
    if (ghiKwhM2Day < spec.minGhiKwhM2Day) {
      killTriggers.push({
        dimension: 'solar_output',
        description: `GHI ${ghiKwhM2Day.toFixed(2)} kWh/m²/day below minimum ${spec.minGhiKwhM2Day} kWh/m²/day`,
      })
    }

    // Grid data
    let gridResult = null
    let gridEvidence: EvidenceItem[] = []
    try {
      const gr = await gridProvider.fetch(site.centroid, projectId, site.id)
      gridResult = gr
      gridEvidence = gr.evidenceItems
      siteEvidence.push(...gridEvidence)
    } catch (err) {
      errors.push(`Grid data fetch failed for ${site.name}: ${String(err)}`)
      missingDataWarnings.push('Grid proximity data unavailable')
    }

    const gridScore = gridResult
      ? scoreGridConnectivity(
          gridResult,
          spec.maxGridDistanceKm,
          spec.minGridVoltageKV,
          gridEvidence,
        )
      : { gridConnectivityScore: 50, killTrigger: null, assumptions: [], evidenceIds: [] }

    if (gridScore.killTrigger) {
      killTriggers.push({ dimension: 'grid', description: gridScore.killTrigger })
    }

    // Land cover (not yet implemented — pass null with warning)
    const buildabilityResult = scoreBuildability(
      null,
      spec.maxSlopeAngle,
      spec.avoidProtectedAreas,
      [],
      missingDataWarnings,
    )

    if (buildabilityResult.killTrigger) {
      killTriggers.push({ dimension: 'buildability', description: buildabilityResult.killTrigger })
    }

    // Storage
    const storageResult = scoreStorageFeasibility(
      gridResult,
      spec.storageCapacityMW,
      spec.storageHours,
      gridEvidence,
      missingDataWarnings,
    )

    // Atmosphere (not yet implemented)
    const atmosphereResult = scoreAtmosphereRisk(null, [], missingDataWarnings)

    // Water (only for water site types)
    const isWaterSite = ['reservoir', 'canal', 'lake', 'coastal_shallow'].includes(site.siteType)
    let waterFeasibilityScore: number | undefined
    let waterEvidence: EvidenceItem[] = []

    if (isWaterSite) {
      try {
        const wr = await waterProvider.fetch(site.centroid, projectId, site.id)
        waterEvidence = wr.evidenceItems
        siteEvidence.push(...waterEvidence)
        const waterResult = scoreWaterFeasibility(
          wr,
          site.siteType,
          spec.maxWaterDepthM,
          spec.maxWaveHeightM,
          waterEvidence,
          missingDataWarnings,
        )
        waterFeasibilityScore = waterResult.waterFeasibilityScore
        if (waterResult.killTrigger) {
          killTriggers.push({ dimension: 'water', description: waterResult.killTrigger })
        }
      } catch (err) {
        errors.push(`Water data fetch failed for ${site.name}: ${String(err)}`)
        missingDataWarnings.push('Water conditions data unavailable')
        waterFeasibilityScore = 40
      }
    }

    // Compute average data confidence
    const confidences = siteEvidence.map((e) => e.dataConfidence)
    const dataConfidenceAvg = confidences.length
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0.5

    const { scoreBreakdown, fatalFlawDecision } = computeFinalDecision(
      {
        siteId: site.id,
        projectId,
        powerOutputScore: solarScore.powerOutputScore,
        vegetationTradeoffScore: buildabilityResult.vegetationTradeoffScore,
        gridConnectivityScore: gridScore.gridConnectivityScore,
        buildabilityScore: buildabilityResult.buildabilityScore,
        storageFeasibilityScore: storageResult.storageFeasibilityScore,
        powerLossScore: atmosphereResult.powerLossScore,
        atmosphereRiskScore: atmosphereResult.atmosphereRiskScore,
        waterFeasibilityScore,
        killTriggers,
        missingDataWarnings,
        evidenceIds: siteEvidence.map((e) => e.id),
        dataConfidenceAvg,
      },
      site,
    )

    await saveScoreBreakdown(scoreBreakdown)
    await saveFatalFlawDecision(fatalFlawDecision)

    allEvidence.push(...siteEvidence)
    decisions.push(fatalFlawDecision)
  }

  await insertEvidenceItems(allEvidence)

  return {
    sites: candidateSites,
    decisions: rankSites(decisions),
    evidenceCount: allEvidence.length,
    errors,
  }
}
