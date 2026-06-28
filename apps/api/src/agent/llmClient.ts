import { GeminiClient } from './geminiClient.js'
import { MiniMaxChatClient } from './minimaxChatClient.js'

export type LlmProvider = 'gemini' | 'minimax'

export interface LlmGenerateResult {
  text: string
  provider: LlmProvider
  model: string
}

export function isLlmAvailable(): boolean {
  return GeminiClient.isAvailable() || MiniMaxChatClient.isAvailable()
}

export function llmUnavailableReason(): string {
  if (isLlmAvailable()) return ''
  return 'Set GEMINI_API_KEY or MINIMAX_API_KEY + MINIMAX_GROUP_ID'
}

/** Strip markdown code fences and parse JSON from LLM output. */
export function parseJsonFromLlm(raw: string): Record<string, unknown> {
  let text = raw.trim()
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  if (fence) text = fence[1]!.trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) text = text.slice(start, end + 1)
  return JSON.parse(text) as Record<string, unknown>
}

/**
 * Generate text with Gemini first; fall back to MiniMax on missing config or error.
 */
export async function generateText(
  prompt: string,
  options?: { jsonMode?: boolean; modelHint?: 'fast' | 'report'; system?: string },
): Promise<LlmGenerateResult> {
  const jsonMode = options?.jsonMode ?? false

  if (GeminiClient.isAvailable()) {
    try {
      const client = new GeminiClient()
      const useReport =
        options?.modelHint === 'report' &&
        !!process.env['GEMINI_REPORT_MODEL'] &&
        process.env['GEMINI_REPORT_MODEL'] !== process.env['GEMINI_FAST_MODEL']
      const model = useReport ? client.reportModel() : client.fastModel()
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      })
      return {
        text: result.response.text(),
        provider: 'gemini',
        model: useReport ? client.reportModelName : client.fastModelName,
      }
    } catch (err) {
      if (!MiniMaxChatClient.isAvailable()) throw err
      console.warn('[LLM] Gemini failed, falling back to MiniMax:', String(err))
    }
  }

  if (!MiniMaxChatClient.isAvailable()) {
    throw new Error(llmUnavailableReason())
  }

  const mm = new MiniMaxChatClient()
  const text = await mm.generateText(prompt, { jsonMode, system: options?.system })
  return { text, provider: 'minimax', model: mm.modelName }
}
