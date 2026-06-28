import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PIPELINE_DIR } from './config.js'

export interface DataSourceDef {
  id: string
  label: string
  category: string
  countries: string[]
  downloadMethod: 'api' | 'direct' | 'zenodo' | 'manual' | 'overpass'
  apiUrl?: string
  rawDir: string
  license: string
  licenseUrl: string
  citation: string
  referenceUrls: string[]
  manualDownload: boolean
  notes?: string
}

interface Manifest {
  version: string
  generatedAt: string
  sources: DataSourceDef[]
}

let _registry: DataSourceDef[] | null = null

export function getSourceRegistry(): DataSourceDef[] {
  if (_registry) return _registry
  const manifestPath = resolve(PIPELINE_DIR, 'data-sources.manifest.json')
  const raw = readFileSync(manifestPath, 'utf8')
  const manifest: Manifest = JSON.parse(raw)
  _registry = manifest.sources
  return _registry
}

export function getSourceById(id: string): DataSourceDef | undefined {
  return getSourceRegistry().find(s => s.id === id)
}

export function getSourcesByCategory(category: string): DataSourceDef[] {
  return getSourceRegistry().filter(s => s.category === category)
}

export function getSourcesByCountry(country: string): DataSourceDef[] {
  return getSourceRegistry().filter(s => s.countries.includes(country))
}
