import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  // Bundle workspace packages (they're TypeScript source, not pre-compiled)
  noExternal: [/^@solux\//],
  splitting: false,
  sourcemap: false,
  // Silence noisy banner
  banner: {},
})
