import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { env } from '../config/env.js'

export interface ModelRegistryEntry {
  name: string
  version: string
  type: 'mojo_kernel' | 'onnx' | 'custom'
  path: string
  checksum: string
  compiledAt: string
  description: string
}

/**
 * Reads the Solux model registry (models/manifests/).
 * Tracks compiled Mojo kernels and any other model artifacts.
 * Registry is a JSON file at MODEL_REGISTRY_DIR/registry.json.
 */
export class ModelRegistryReader {
  static isAvailable(): boolean {
    const dir = env.MODEL_REGISTRY_DIR
    if (!dir) return false
    return existsSync(join(dir, 'registry.json'))
  }

  static unavailableReason(): string | undefined {
    const dir = env.MODEL_REGISTRY_DIR
    if (!dir) return 'MODEL_REGISTRY_DIR not set — optional, used for Mojo kernel tracking'
    if (!existsSync(dir)) return `MODEL_REGISTRY_DIR "${dir}" not found`
    if (!existsSync(join(dir, 'registry.json'))) return `registry.json not found in ${dir}`
    return undefined
  }

  static readAll(): ModelRegistryEntry[] {
    if (!ModelRegistryReader.isAvailable()) return []
    try {
      const raw = readFileSync(join(env.MODEL_REGISTRY_DIR, 'registry.json'), 'utf-8')
      return JSON.parse(raw) as ModelRegistryEntry[]
    } catch {
      return []
    }
  }

  static findMojoKernel(name: string): ModelRegistryEntry | null {
    const entries = ModelRegistryReader.readAll()
    return entries.find((e) => e.type === 'mojo_kernel' && e.name === name) ?? null
  }
}
