import { env } from '../config/env.js'

export interface MiniMaxChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * MiniMax text chat — fallback when Gemini is unavailable or errors.
 * Docs: https://platform.minimax.io/docs/api-reference/text-post
 */
export class MiniMaxChatClient {
  private readonly baseUrl = 'https://api.minimax.io/v1'

  static isAvailable(): boolean {
    return !!(env.MINIMAX_API_KEY && env.MINIMAX_GROUP_ID)
  }

  static unavailableReason(): string {
    if (!env.MINIMAX_API_KEY) return 'MINIMAX_API_KEY not set'
    if (!env.MINIMAX_GROUP_ID) return 'MINIMAX_GROUP_ID not set'
    return ''
  }

  get modelName(): string {
    return env.MINIMAX_TEXT_MODEL || 'MiniMax-M2'
  }

  async generateText(
    prompt: string,
    options?: { jsonMode?: boolean; system?: string },
  ): Promise<string> {
    if (!MiniMaxChatClient.isAvailable()) {
      throw new Error(`MiniMax not configured — ${MiniMaxChatClient.unavailableReason()}`)
    }

    const messages: MiniMaxChatMessage[] = []
    const systemParts = [
      options?.system,
      options?.jsonMode ? 'Return valid JSON only. No markdown fences or prose.' : undefined,
    ].filter(Boolean)
    if (systemParts.length) {
      messages.push({ role: 'system', content: systemParts.join('\n') })
    }
    messages.push({ role: 'user', content: prompt })

    const url = `${this.baseUrl}/text/chatcompletion_v2?GroupId=${encodeURIComponent(env.MINIMAX_GROUP_ID)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MINIMAX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.modelName,
        messages,
        max_completion_tokens: 4096,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(120_000),
    })

    const body = await res.text()
    if (!res.ok) {
      throw new Error(`MiniMax chat error ${res.status}: ${body.slice(0, 300)}`)
    }

    let json: Record<string, unknown>
    try {
      json = JSON.parse(body) as Record<string, unknown>
    } catch {
      throw new Error('MiniMax returned non-JSON response')
    }

    const baseResp = json['base_resp'] as { status_code?: number; status_msg?: string } | undefined
    if (baseResp && baseResp.status_code !== 0 && baseResp.status_code !== undefined) {
      throw new Error(`MiniMax API error: ${baseResp.status_msg ?? baseResp.status_code}`)
    }

    const choices = json['choices'] as Array<{ message?: { content?: string } }> | undefined
    const content = choices?.[0]?.message?.content
    if (!content) {
      throw new Error('MiniMax response missing choices[0].message.content')
    }
    return content
  }
}
