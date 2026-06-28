import { join } from 'node:path'
import {
  ModelEndpointCapabilitiesSchema,
  writeJson,
  manifestsDir,
  envPath,
  type ModelEndpointCapabilities,
} from './config.js'

/** Routes on hpc-model-backend (Cloudflare tunnel). */
const ROUTES_TO_PROBE = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/v1/health' },
  { method: 'GET', path: '/v1/models' },
  { method: 'GET', path: '/v1/gpu/status' },
  { method: 'GET', path: '/v1/router/status' },
  {
    method: 'POST',
    path: '/v1/reason/auto',
    form: { question: 'Solux connectivity probe — reply OK', medical: 'false' },
  },
]

export async function probeModelEndpoint(): Promise<ModelEndpointCapabilities> {
  const endpointUrl = envPath('SOLUX_MODEL_ENDPOINT', '').replace(/\/$/, '').replace(/\/docs$/, '')
  const timeoutMs = Number(envPath('SOLUX_MODEL_TIMEOUT_MS', '120000'))
  const auth = envPath('SOLUX_MODEL_ENDPOINT_AUTH', '')
  const errors: string[] = []
  const warnings: string[] = []
  const supportedRoutes: string[] = []
  const supportedModels: string[] = []
  let reachable = false

  if (!endpointUrl) {
    return ModelEndpointCapabilitiesSchema.parse({
      endpointUrl: '',
      checkedAt: new Date().toISOString(),
      reachable: false,
      supportedRoutes: [],
      supportedModels: [],
      maxBatchSize: Number(envPath('SOLUX_MODEL_BATCH_SIZE', '256')),
      authRequired: false,
      errors: ['SOLUX_MODEL_ENDPOINT not configured'],
      warnings: ['Deterministic scoring only — no model reranking'],
    })
  }

  for (const route of ROUTES_TO_PROBE) {
    try {
      const headers: Record<string, string> = {}
      if (auth) headers['Authorization'] = `Bearer ${auth}`

      let body: BodyInit | undefined
      if ('form' in route && route.form) {
        const fd = new FormData()
        for (const [k, v] of Object.entries(route.form)) fd.append(k, v)
        body = fd
      }

      const res = await fetch(`${endpointUrl}${route.path}`, {
        method: route.method,
        headers,
        body,
        signal: AbortSignal.timeout(Math.min(timeoutMs, 30000)),
      })
      if (res.ok || res.status === 400 || res.status === 422 || res.status === 202) {
        supportedRoutes.push(`${route.method} ${route.path}`)
        reachable = true
        if (route.path === '/v1/models') {
          const json = (await res.json().catch(() => null)) as {
            data?: Array<{ id: string }>
            models?: Array<{ name: string; id?: string }>
          } | null
          if (json?.data) supportedModels.push(...json.data.map((m) => m.id))
          if (json?.models) supportedModels.push(...json.models.map((m) => m.id ?? m.name))
        }
      }
    } catch (err) {
      errors.push(`${route.method} ${route.path}: ${String(err)}`)
    }
  }

  if (!reachable) {
    warnings.push('Model endpoint unreachable — deterministic scoring outputs only')
  }

  const caps = ModelEndpointCapabilitiesSchema.parse({
    endpointUrl,
    checkedAt: new Date().toISOString(),
    reachable,
    supportedRoutes,
    supportedModels,
    maxBatchSize: Number(envPath('SOLUX_MODEL_BATCH_SIZE', '256')),
    authRequired: Boolean(auth),
    errors,
    warnings,
  })

  await writeJson(join(manifestsDir(), 'model_endpoint_capabilities.json'), caps)
  return caps
}

if (process.argv[1]?.endsWith('modelEndpointClient.ts')) {
  probeModelEndpoint()
    .then((c) => {
      console.log(JSON.stringify(c, null, 2))
      process.exit(c.reachable ? 0 : 2)
    })
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
