import type { SiteWithScore } from '~/types/api'
import type { GlobeCameraTarget } from '~/types/earth'

/** Shared fly-to target so any panel can drive the 3D Earth camera. */
export function useGlobeCamera() {
  const flyToTarget = useState<GlobeCameraTarget | null>('solux-globe-fly-to', () => null)

  function flyToSite(site: SiteWithScore, height = 25_000) {
    const c = site.centroid?.coordinates
    if (!c || c.length < 2) return
    flyToTarget.value = {
      longitude: c[0]!,
      latitude: c[1]!,
      height,
      pitch: -45,
      heading: 0,
    }
  }

  function flyToBounds(sites: SiteWithScore[]) {
    if (!sites.length) return
    const coords = sites.flatMap((s) => {
      const c = s.centroid?.coordinates
      return c && c.length >= 2 ? [[c[0]!, c[1]!] as const] : []
    })
    if (!coords.length) return
    const lons = coords.map((c) => c[0])
    const lats = coords.map((c) => c[1])
    flyToTarget.value = {
      longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      height: 120_000,
      pitch: -55,
      heading: 0,
    }
  }

  function flyToRegion(longitude: number, latitude: number, height = 500_000) {
    flyToTarget.value = { longitude, latitude, height, pitch: -60, heading: 0 }
  }

  return { flyToTarget, flyToSite, flyToBounds, flyToRegion }
}
