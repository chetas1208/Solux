/** Parse DuckDB/Mongo missing_data_flags — may be array or bracket string. */
export function parseMissingDataFlags(v: unknown): string[] {
  if (v == null) return []
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  const s = String(v).trim()
  if (!s) return []
  if (s.startsWith('[') && s.endsWith(']')) {
    return s
      .slice(1, -1)
      .split(',')
      .map((x) => x.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
  }
  return [s]
}

export function formatMissingFlagLabel(flag: string): string {
  return flag.replace(/_/g, ' ')
}

/** Haversine distance in km between [lon, lat] points. */
export function kmBetween(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const [lon1, lat1] = a
  const [lon2, lat2] = b
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

export interface RankableCandidate {
  candidateId: string
  finalScore?: number
  confidence?: number
  centroid?: { coordinates?: [number, number] }
  solarScore?: number
  gridScore?: number
  vegetationScore?: number
}

/** Break score ties and pick geographically spread top N. */
export function diversifyCandidates<T extends RankableCandidate>(
  candidates: T[],
  limit: number,
  minKm = 28,
): T[] {
  const sorted = [...candidates].sort((a, b) => {
    const ds = (b.finalScore ?? 0) - (a.finalScore ?? 0)
    if (ds !== 0) return ds
    const solar = (b.solarScore ?? 0) - (a.solarScore ?? 0)
    if (solar !== 0) return solar
    const grid = (b.gridScore ?? 0) - (a.gridScore ?? 0)
    if (grid !== 0) return grid
    return String(a.candidateId).localeCompare(String(b.candidateId))
  })

  const picked: T[] = []
  for (const c of sorted) {
    if (picked.length >= limit) break
    const coords = c.centroid?.coordinates
    if (!coords || coords.length < 2) {
      picked.push(c)
      continue
    }
    const crowded = picked.some((p) => {
      const pc = p.centroid?.coordinates
      if (!pc || pc.length < 2) return false
      return kmBetween(coords, pc) < minKm
    })
    if (!crowded) picked.push(c)
  }

  for (const c of sorted) {
    if (picked.length >= limit) break
    if (!picked.includes(c)) picked.push(c)
  }

  return picked.slice(0, limit)
}

export function buildCandidateDisplayLabel(opts: {
  rank: number
  state?: string
  lat: number
  lng: number
  candidateId: string
  finalScore?: number
  locality?: string | null
}): string {
  const { rank, state, lat, lng, candidateId, finalScore, locality } = opts
  const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`
  const lngStr = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`
  const h3Tail = candidateId.replace(/[^a-f0-9]/gi, '').slice(-6) || candidateId.slice(-6)
  if (locality && state) return `${locality}, ${state}`
  if (locality) return locality
  const scoreBit = finalScore != null ? ` · score ${finalScore}` : ''
  return `${state ?? 'Site'} #${rank} · ${latStr}, ${lngStr}${scoreBit} · …${h3Tail}`
}
