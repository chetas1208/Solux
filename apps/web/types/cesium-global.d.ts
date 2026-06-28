export {}

declare global {
  interface Window {
    Cesium?: typeof import('cesium')
    CESIUM_BASE_URL?: string
  }
}
