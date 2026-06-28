import type { CesiumNamespace } from '~/utils/cesiumLoader'

export interface GlobeLayerState {
  ionImagery: boolean
  ionTerrain: boolean
  google3dTiles: boolean
  google3dError: string | null
}

/** Configure imagery, terrain, and optional Google 3D tiles on a Cesium Viewer. */
export async function configureGlobeLayers(
  Cesium: CesiumNamespace,
  viewer: InstanceType<CesiumNamespace['Viewer']>,
  opts: {
    ionToken: string
    googleKey: string
    google3dEnabled: boolean
  },
): Promise<GlobeLayerState> {
  const state: GlobeLayerState = {
    ionImagery: false,
    ionTerrain: false,
    google3dTiles: false,
    google3dError: null,
  }

  if (opts.ionToken) {
    Cesium.Ion.defaultAccessToken = opts.ionToken
  }

  // Replace default layer with Cesium ion Bing imagery (asset 2) when token present
  if (opts.ionToken) {
    try {
      viewer.imageryLayers.removeAll()
      const imageryProvider = await Cesium.IonImageryProvider.fromAssetId(2)
      viewer.imageryLayers.addImageryProvider(imageryProvider)
      state.ionImagery = true
    } catch (err) {
      console.warn('[Solux] Cesium ion imagery unavailable:', err)
      // OSM fallback so globe is never blank
      try {
        viewer.imageryLayers.removeAll()
        viewer.imageryLayers.addImageryProvider(
          new Cesium.OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/',
          }),
        )
      } catch {
        /* keep default */
      }
    }

    try {
      viewer.terrainProvider = await Cesium.createWorldTerrainAsync()
      state.ionTerrain = true
    } catch (err) {
      console.warn('[Solux] Cesium ion terrain unavailable:', err)
    }
  } else {
    try {
      viewer.imageryLayers.removeAll()
      viewer.imageryLayers.addImageryProvider(
        new Cesium.OpenStreetMapImageryProvider({
          url: 'https://tile.openstreetmap.org/',
        }),
      )
    } catch {
      /* default basemap */
    }
  }

  if (opts.google3dEnabled && opts.googleKey) {
    try {
      const probe = await fetch(
        `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(opts.googleKey)}`,
        { signal: AbortSignal.timeout(8000) },
      )
      if (!probe.ok) {
        const body = (await probe.json().catch(() => ({}))) as {
          error?: { message?: string }
        }
        state.google3dError =
          body.error?.message ?? `Google Map Tiles API HTTP ${probe.status}`
        console.warn('[Solux] Google 3D Tiles unavailable:', state.google3dError)
      } else if (typeof Cesium.createGooglePhotorealistic3DTileset === 'function') {
        const tileset = await Cesium.createGooglePhotorealistic3DTileset({
          key: opts.googleKey,
        })
        viewer.scene.primitives.add(tileset)
        state.google3dTiles = true
      } else {
        state.google3dError = 'Cesium build lacks createGooglePhotorealistic3DTileset'
      }
    } catch (err) {
      state.google3dError = String(err)
      console.warn('[Solux] Google Photorealistic 3D Tiles failed:', err)
    }
  }

  viewer.scene.globe.enableLighting = true
  viewer.scene.globe.depthTestAgainstTerrain = true
  viewer.scene.fog.enabled = true
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#09090b')
  viewer.scene.skyAtmosphere.show = true

  return state
}
