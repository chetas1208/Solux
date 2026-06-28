/** Turn API error JSON (incl. Hono/Zod validation) into a readable string. */
export function formatApiError(body: unknown, fallback: string): { message: string; detail?: string } {
  if (!body || typeof body !== 'object') {
    return { message: fallback }
  }

  const record = body as Record<string, unknown>
  const err = record.error

  if (typeof err === 'string') {
    return { message: err, detail: typeof record.detail === 'string' ? record.detail : undefined }
  }

  if (err && typeof err === 'object') {
    const zod = err as { name?: string; issues?: Array<{ message?: string; path?: (string | number)[] }> }
    if (zod.name === 'ZodError' && Array.isArray(zod.issues) && zod.issues.length) {
      const first = zod.issues[0]!
      const path = first.path?.length ? `${first.path.join('.')}: ` : ''
      return { message: `${path}${first.message ?? 'Validation failed'}` }
    }
  }

  return { message: fallback }
}
