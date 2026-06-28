/** Load Cesium IIFE bundle — avoids Vite ESM issues (e.g. mersenne-twister). */
export type CesiumNamespace = typeof import('cesium')

let loadPromise: Promise<CesiumNamespace> | null = null

function ensureCesiumBaseUrl() {
  const w = window as unknown as { CESIUM_BASE_URL?: string }
  if (!w.CESIUM_BASE_URL) w.CESIUM_BASE_URL = '/cesium/'
}

function ensureCesiumCss() {
  if (document.querySelector('link[data-cesium-widgets]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = '/cesium/Widgets/widgets.css'
  link.dataset.cesiumWidgets = '1'
  document.head.appendChild(link)
}

export async function loadCesium(): Promise<CesiumNamespace> {
  if (import.meta.server) throw new Error('Cesium is client-only')

  ensureCesiumBaseUrl()
  ensureCesiumCss()

  const w = window as unknown as { Cesium?: CesiumNamespace }
  if (w.Cesium) return w.Cesium

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = '/cesium/Cesium.js'
      script.async = true
      script.onload = () => {
        if (w.Cesium) resolve(w.Cesium)
        else reject(new Error('Cesium global missing after /cesium/Cesium.js loaded'))
      }
      script.onerror = () => reject(new Error('Failed to load /cesium/Cesium.js'))
      document.head.appendChild(script)
    })
  }

  return loadPromise
}
