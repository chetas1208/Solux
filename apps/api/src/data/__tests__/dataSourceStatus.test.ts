import { describe, it, expect, vi, beforeEach } from 'vitest'

// Env is loaded at import time — mock before importing
vi.mock('../../config/env.js', () => ({
  env: {
    NREL_API_KEY: '',
    PVGIS_BASE_URL: 'https://re.jrc.ec.europa.eu/api/v5_2',
    GLOBAL_SOLAR_ATLAS_DATA_DIR: '',
    USPVDB_DATA_DIR: '',
    GEBCO_DATA_DIR: '',
    COPERNICUS_MARINE_CONFIG: '',
  },
}))

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}))

import { getDataSourceStatuses } from '../dataSourceStatus.js'

describe('getDataSourceStatuses', () => {
  it('returns statuses for all known sources', async () => {
    const statuses = await getDataSourceStatuses(false)
    expect(statuses.length).toBeGreaterThanOrEqual(5)
  })

  it('marks nrel_nsrdb unavailable when key missing', async () => {
    const statuses = await getDataSourceStatuses(false)
    const nrel = statuses.find((s) => s.id === 'nrel_nsrdb')
    expect(nrel).toBeDefined()
    expect(nrel!.available).toBe(false)
    expect(nrel!.unavailableReason).toMatch(/NREL_API_KEY/)
  })

  it('marks pvgis available (no key required, API reachable by default)', async () => {
    const statuses = await getDataSourceStatuses(false)
    const pvgis = statuses.find((s) => s.id === 'pvgis')
    expect(pvgis).toBeDefined()
    expect(pvgis!.available).toBe(true)
  })

  it('marks local datasets unavailable when dirs not set', async () => {
    const statuses = await getDataSourceStatuses(false)
    const gsa = statuses.find((s) => s.id === 'global_solar_atlas')
    const gebco = statuses.find((s) => s.id === 'gebco')
    expect(gsa!.available).toBe(false)
    expect(gebco!.available).toBe(false)
  })

  it('includes lastCheckedAt timestamp', async () => {
    const statuses = await getDataSourceStatuses(false)
    const before = Date.now() - 2000
    for (const s of statuses) {
      if (s.lastCheckedAt) {
        expect(new Date(s.lastCheckedAt).getTime()).toBeGreaterThan(before)
      }
    }
  })
})
