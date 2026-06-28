import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { env } from '../config/env.js'
import { weightedScoreFallback } from './scoreKernelFallback.js'

export interface ScoreKernelInput {
  scoreWeightPairs: Array<{ score: number; weight: number }>
}

export interface ScoreKernelResult {
  finalScore: number
  usedMojo: boolean
}

/**
 * Runs the Mojo score kernel binary if available, otherwise uses TS fallback.
 * Never throws — always falls back to TS on any error.
 */
export async function runScoreKernel(input: ScoreKernelInput): Promise<ScoreKernelResult> {
  const binPath = env.MOJO_SCORE_KERNEL_BIN

  if (!binPath || !existsSync(binPath)) {
    return {
      finalScore: Math.round(weightedScoreFallback(input.scoreWeightPairs)),
      usedMojo: false,
    }
  }

  const stdinData = input.scoreWeightPairs
    .map((p) => `${p.score} ${p.weight}`)
    .join(' ')

  return new Promise((resolve) => {
    let stdout = ''
    let timedOut = false

    const proc = spawn(binPath, [], { stdio: ['pipe', 'pipe', 'ignore'] })

    const timer = setTimeout(() => {
      timedOut = true
      proc.kill()
      resolve({
        finalScore: Math.round(weightedScoreFallback(input.scoreWeightPairs)),
        usedMojo: false,
      })
    }, 3000)

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    proc.on('close', () => {
      if (timedOut) return
      clearTimeout(timer)
      const parsed = parseFloat(stdout.trim())
      if (isNaN(parsed)) {
        resolve({
          finalScore: Math.round(weightedScoreFallback(input.scoreWeightPairs)),
          usedMojo: false,
        })
        return
      }
      resolve({ finalScore: Math.round(Math.max(0, Math.min(100, parsed))), usedMojo: true })
    })

    proc.on('error', () => {
      clearTimeout(timer)
      resolve({
        finalScore: Math.round(weightedScoreFallback(input.scoreWeightPairs)),
        usedMojo: false,
      })
    })

    proc.stdin.write(stdinData)
    proc.stdin.end()
  })
}
