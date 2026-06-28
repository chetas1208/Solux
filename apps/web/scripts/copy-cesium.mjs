import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const cesiumRoot = dirname(require.resolve('cesium/package.json'))
const src = join(cesiumRoot, 'Build/Cesium')
const dest = join(fileURLToPath(new URL('..', import.meta.url)), 'public/cesium')

if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true })
console.log('Copied Cesium assets to public/cesium')
