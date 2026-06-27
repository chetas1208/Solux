import { z } from 'zod'

export const AgentTraceEventSchema = z.object({
  timestamp: z.string().datetime(),
  type: z.enum([
    'tool_call',
    'tool_result',
    'model_request',
    'model_response',
    'evidence_guard_check',
    'hallucination_score',
    'error',
  ]),
  toolName: z.string().optional(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  durationMs: z.number().optional(),
  error: z.string().optional(),
})
export type AgentTraceEvent = z.infer<typeof AgentTraceEventSchema>

export const AgentTraceSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  siteId: z.string().uuid().optional(),
  runType: z.enum(['parse_prompt', 'screen_sites', 'generate_report', 'audit_report']),
  model: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  status: z.enum(['running', 'completed', 'failed']),
  events: z.array(AgentTraceEventSchema),
  /** Total tool calls made. */
  toolCallCount: z.number().int().nonnegative(),
  /** Hallucination score 0–1 (unsupportedClaims / totalClaims). */
  hallucinationScore: z.number().min(0).max(1).optional(),
  error: z.string().optional(),
})
export type AgentTrace = z.infer<typeof AgentTraceSchema>

export const BenchmarkRunSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  projectSpecId: z.string().uuid(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  siteCount: z.number().int().nonnegative(),
  goCount: z.number().int().nonnegative(),
  investigateCount: z.number().int().nonnegative(),
  killCount: z.number().int().nonnegative(),
  avgConfidence: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
})
export type BenchmarkRun = z.infer<typeof BenchmarkRunSchema>
