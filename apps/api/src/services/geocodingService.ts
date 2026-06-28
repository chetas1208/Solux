import { getDb } from '../db/mongo.js'
import { env } from '../config/env.js'

interface GeocodingCache {
  candidateId: string
  lat: number
  lng: number
  formattedAddress: string | null
  locality: string | null
  adminArea1: string | null
  adminArea2: string | null
  country: string | null
  geocodedAt: string
}

const CACHE_COL = 'geocoding_cache'

async function getCached(candidateId: string): Promise<GeocodingCache | null> {
  try {
    const db = await getDb()
    const doc = await db.collection(CACHE_COL).findOne({ candidateId })
    if (!doc) return null
    const { _id: _, ...rest } = doc as Record<string, unknown>
    return rest as unknown as GeocodingCache
  } catch {
    return null
  }
}

async function saveCache(data: GeocodingCache): Promise<void> {
  try {
    const db = await getDb()
    await db.collection(CACHE_COL).updateOne(
      { candidateId: data.candidateId },
      { $set: data },
      { upsert: true },
    )
  } catch {
    // Cache failure is non-fatal
  }
}

export interface GeocodingResult {
  displayLabel: string
  formattedAddress: string | null
  locality: string | null
  adminArea1: string | null
}

function buildDisplayLabel(
  locality: string | null,
  adminArea2: string | null,
  adminArea1: string | null,
): string | null {
  if (locality) return adminArea1 ? `${locality}, ${adminArea1}` : locality
  if (adminArea2) return adminArea1 ? `${adminArea2} area, ${adminArea1}` : adminArea2
  if (adminArea1) return `Candidate near ${adminArea1}`
  return null
}

export async function reverseGeocode(
  candidateId: string,
  lat: number,
  lng: number,
  fallbackState?: string,
): Promise<GeocodingResult> {
  const fallback: GeocodingResult = {
    displayLabel: fallbackState
      ? `Candidate near ${fallbackState}`
      : `Candidate at ${lat.toFixed(3)}°, ${lng.toFixed(3)}°`,
    formattedAddress: null,
    locality: null,
    adminArea1: fallbackState ?? null,
  }

  const cached = await getCached(candidateId)
  if (cached) {
    return {
      displayLabel:
        buildDisplayLabel(cached.locality, cached.adminArea2, cached.adminArea1) ??
        fallback.displayLabel,
      formattedAddress: cached.formattedAddress,
      locality: cached.locality,
      adminArea1: cached.adminArea1,
    }
  }

  if (!env.GOOGLE_MAPS_API_KEY) return fallback

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('latlng', `${lat},${lng}`)
    url.searchParams.set('key', env.GOOGLE_MAPS_API_KEY)
    url.searchParams.set('result_type', 'locality|administrative_area_level_2|administrative_area_level_1')

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return fallback

    const data = (await res.json()) as {
      status: string
      results: Array<{
        formatted_address: string
        address_components: Array<{ long_name: string; types: string[] }>
      }>
    }

    if (data.status !== 'OK' || !data.results.length) return fallback

    const result = data.results[0]!
    const components = result.address_components

    function getComp(types: string[]) {
      return components.find((c) => types.some((t) => c.types.includes(t)))?.long_name ?? null
    }

    const locality = getComp(['locality', 'sublocality_level_1', 'administrative_area_level_3', 'postal_town'])
    const adminArea2 = getComp(['administrative_area_level_2'])
    const adminArea1 = getComp(['administrative_area_level_1'])
    const country = getComp(['country'])

    const geocoded: GeocodingCache = {
      candidateId,
      lat,
      lng,
      formattedAddress: result.formatted_address,
      locality,
      adminArea1,
      adminArea2,
      country,
      geocodedAt: new Date().toISOString(),
    }

    await saveCache(geocoded)

    return {
      displayLabel:
        buildDisplayLabel(locality, adminArea2, adminArea1) ?? fallback.displayLabel,
      formattedAddress: result.formatted_address,
      locality,
      adminArea1,
    }
  } catch {
    return fallback
  }
}
