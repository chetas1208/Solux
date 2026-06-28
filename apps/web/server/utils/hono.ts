import { loadMonorepoEnv } from './monorepo-env'
import type { H3Event } from 'h3'
import type { Hono } from 'hono'
import { getRequestURL, readRawBody } from 'h3'

export async function handleHono(event: H3Event, app: Hono) {
  loadMonorepoEnv()
  const url = getRequestURL(event)
  const body = ['GET', 'HEAD'].includes(event.method) ? undefined : await readRawBody(event)

  const init: RequestInit = {
    method: event.method,
    headers: event.headers,
  }
  if (body) init.body = body

  const request = new Request(url, init)

  return app.fetch(request)
}
