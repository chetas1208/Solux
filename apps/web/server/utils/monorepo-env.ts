import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'

function monorepoRoots(): string[] {
  const cwd = process.cwd()
  return [...new Set([resolve(cwd, '../..'), cwd])]
}

/** Load root .env before embedded API reads process.env (Nitro cwd is apps/web in dev). */
export function loadMonorepoEnv() {
  if (process.env['MONGODB_URI']) return

  for (const rootDir of monorepoRoots()) {
    if (
      !existsSync(resolve(rootDir, 'pnpm-workspace.yaml')) &&
      !existsSync(resolve(rootDir, '.env'))
    ) {
      continue
    }
    for (const file of ['.env', '.env.local'] as const) {
      const path = resolve(rootDir, file)
      if (existsSync(path)) {
        loadEnv({ path, override: file === '.env.local' })
      }
    }
    return
  }
}
