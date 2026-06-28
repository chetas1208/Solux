import type { CapabilityState } from './ui'

export interface ClientMapProbe {
  id: string
  name: string
  state: CapabilityState
  configured: boolean
  whatWasTested: string[]
  failureReason?: string
  lastCheckedAt: string
}

export interface MapDiagnosticsSnapshot {
  backend: import('./map').MapProvidersResponse | null
  client: ClientMapProbe[]
  overall: CapabilityState
  checkedAt: string
  loading: boolean
  error: string | null
}

export function maskPublicKey(key: string): string {
  const k = key.trim()
  if (!k) return '—'
  if (k.length <= 8) return '****'
  return `${k.slice(0, 4)}…${k.slice(-4)}`
}
